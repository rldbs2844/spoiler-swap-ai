import { buildOnDeviceReasoning, evaluateShort, type EvaluateOptions } from './detector';
import type { EvaluationResult, ShortItem } from './types';

async function fetchThumbnailBase64(url?: string): Promise<{ mimeType: string; data: string } | null> {
  if (!url || !url.startsWith('http')) return null;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(1800), cache: 'no-store' });
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

function parseJsonResponse(rawText: string): { score?: number; reasoning?: string } | null {
  const cleaned = (rawText || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  if (!cleaned) return null;
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
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

  let lastFailureReason = '';

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

      const fastPayload = JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 }
        }
      });

      const compatPayload = JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseMimeType: 'application/json' }
      });

      const endpoints: Array<{
        url: string;
        modelName: 'gemini-2.5-flash' | 'gemini-2.0-flash';
        useHeader: boolean;
        body: string;
      }> = [
        {
          url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
          modelName: 'gemini-2.5-flash',
          useHeader: true,
          body: fastPayload
        },
        {
          url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
          modelName: 'gemini-2.5-flash',
          useHeader: false,
          body: fastPayload
        },
        {
          url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
          modelName: 'gemini-2.0-flash',
          useHeader: true,
          body: compatPayload
        }
      ];

      if (geminiKey.startsWith('AQ.')) {
        endpoints.push({
          url: 'https://aiplatform.googleapis.com/v1beta1/publishers/google/models/gemini-2.5-flash:generateContent',
          modelName: 'gemini-2.5-flash',
          useHeader: true,
          body: compatPayload
        });
      }

      for (const ep of endpoints) {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (ep.useHeader) headers['x-goog-api-key'] = geminiKey;

          const resp = await fetch(ep.url, {
            method: 'POST',
            headers,
            signal: AbortSignal.timeout(7000),
            body: ep.body
          });

          if (resp.ok) {
            const data = await resp.json();
            const partList = (data?.candidates?.[0]?.content?.parts || []) as Array<{
              text?: string;
              thought?: boolean;
            }>;
            const rawText = partList
              .filter((p) => !p.thought && typeof p.text === 'string')
              .map((p) => p.text)
              .join('\n');
            const candidate = parseJsonResponse(rawText);
            if (candidate && typeof candidate.score === 'number') {
              parsed = candidate;
              provider = ep.modelName;
              break;
            }
            lastFailureReason = `${ep.modelName}: invalid JSON`;
          } else {
            lastFailureReason = `${ep.modelName}: HTTP ${resp.status}`;
          }
        } catch (err) {
          lastFailureReason = `${ep.modelName}: ${err instanceof Error ? err.name : 'fetch error'}`;
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
        signal: AbortSignal.timeout(6500),
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        const raw = data?.choices?.[0]?.message?.content || '';
        parsed = parseJsonResponse(raw);
      } else {
        lastFailureReason = `openai: HTTP ${resp.status}`;
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
  } catch (err) {
    lastFailureReason = err instanceof Error ? err.message : 'LLM error';
  }

  return {
    ...baseResult,
    ai_analysis: {
      ...buildOnDeviceReasoning(baseResult),
      ...(lastFailureReason ? { fallbackReason: lastFailureReason } : {})
    }
  };
}
