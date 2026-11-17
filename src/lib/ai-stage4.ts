import { buildOnDeviceReasoning, evaluateShort, type EvaluateOptions } from './detector';
import type { EvaluationResult, ShortItem } from './types';

async function fetchThumbnailBase64(url?: string): Promise<{ mimeType: string; data: string } | null> {
  if (!url || !url.startsWith('http')) return null;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(1500), cache: 'no-store' });
    if (!resp.ok) return null;
    const contentType = resp.headers.get('content-type') || 'image/jpeg';
    const buf = await resp.arrayBuffer();
    if (buf.byteLength > 1024 * 1024) return null;
    return {
      mimeType: contentType.split(';')[0].trim(),
      data: Buffer.from(buf).toString('base64')
    };
  } catch {
    return null;
  }
}

export async function evaluateWithOptionalLlm(
  shortItem: Partial<ShortItem>,
  options: EvaluateOptions = {}
): Promise<EvaluationResult> {
  const baseResult = evaluateShort(shortItem, options);
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();

  if (!geminiKey && !openaiKey) {
    return {
      ...baseResult,
      ai_analysis: buildOnDeviceReasoning(baseResult)
    };
  }

  const start = Date.now();
  const watchlistText =
    options.watchlist?.join(', ') || baseResult.matched_watchlist_entities.join(', ') || '없음';
  const prompt = [
    '당신은 숏폼(YouTube Shorts) 스포일러 탐지 AI입니다.',
    '사용자가 피하고 싶어하는 작품(Watchlist)에 대해 결말, 사망, 범인, 반전, 우승 결과 등 치명적 스포일러가 포함되어 있는지 0.00~0.99 점수로 판정하세요.',
    '반드시 아래 JSON 형식으로만 답하세요:',
    '{"is_spoiler": boolean, "score": number, "reasoning": "한국어로 1~2문장 판단 근거"}',
    `Watchlist: ${watchlistText}`,
    `제목/해시태그(Stage1): ${shortItem.title || ''}`,
    `화면텍스트/설명(Stage2): ${shortItem.ocr || ''}`,
    `음성자막/STT(Stage3): ${shortItem.stt || ''}`
  ].join('\n');

  try {
    let parsed: { score?: number; reasoning?: string } | null = null;
    let provider: 'gemini-2.5-flash' | 'gemini-2.0-flash' | 'gpt-4o-mini' = 'gemini-2.5-flash';
    let multimodalUsed = false;

    if (geminiKey) {
      const thumb = await fetchThumbnailBase64(shortItem.thumbnailUrl);
      const parts: Array<Record<string, unknown>> = [{ text: prompt }];
      if (thumb) {
        parts.push({
          inline_data: {
            mime_type: thumb.mimeType,
            data: thumb.data
          }
        });
        multimodalUsed = true;
      }

      const payload = JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseMimeType: 'application/json' }
      });

      const endpoints: Array<{ url: string; modelName: 'gemini-2.5-flash' | 'gemini-2.0-flash' }> = [
        {
          url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
          modelName: 'gemini-2.5-flash'
        },
        {
          url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
          modelName: 'gemini-2.0-flash'
        }
      ];

      if (geminiKey.startsWith('AQ.')) {
        endpoints.push({
          url: 'https://aiplatform.googleapis.com/v1beta1/publishers/google/models/gemini-2.5-flash:generateContent',
          modelName: 'gemini-2.5-flash'
        });
      }

      for (const ep of endpoints) {
        const resp = await fetch(ep.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': geminiKey
          },
          signal: AbortSignal.timeout(3500),
          body: payload
        });
        if (resp.ok) {
          const data = await resp.json();
          const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (raw) {
            parsed = JSON.parse(raw);
            provider = ep.modelName;
            break;
          }
        }
      }
    } else if (openaiKey) {
      provider = 'gpt-4o-mini';
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`
        },
        signal: AbortSignal.timeout(3500),
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        const raw = data?.choices?.[0]?.message?.content || '';
        parsed = JSON.parse(raw);
      }
    }

    if (parsed && typeof parsed.score === 'number') {
      const llmScore = Math.min(0.99, Math.max(0, parsed.score));
      const blended = Number(
        Math.min(0.99, Math.max(0.02, baseResult.confidence_score * 0.45 + llmScore * 0.55)).toFixed(2)
      );
      const elapsed = Math.max(1, Date.now() - start);
      const isSpoiler = blended >= baseResult.threshold;
      const fallbackAsset = baseResult.swap_asset || {
        asset_id: 'cat_meme_laptop_01',
        type: 'local_cached_cat_meme' as const,
        caption: '스포일러 방어 완료! 대신 야근하는 부장 고양이 보고 가세요 😎'
      };

      return {
        ...baseResult,
        confidence_score: blended,
        action: isSpoiler ? 'SWAP_TO_CAT_MEME' : 'PASS',
        swap_asset: isSpoiler ? fallbackAsset : null,
        stages: {
          ...baseResult.stages,
          stage4_kg_koelectra: {
            score: Number(llmScore.toFixed(2)),
            latency_ms: elapsed
          }
        },
        ai_analysis: {
          provider,
          multimodal_used: multimodalUsed,
          reasoning:
            typeof parsed.reasoning === 'string' && parsed.reasoning.trim()
              ? parsed.reasoning.trim()
              : buildOnDeviceReasoning(baseResult).reasoning
        }
      };
    }
  } catch {
    // Transparent fallback to on-device 4-stage engine
  }

  return {
    ...baseResult,
    ai_analysis: buildOnDeviceReasoning(baseResult)
  };
}
