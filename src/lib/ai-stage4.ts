import { buildOnDeviceReasoning, evaluateShort, type EvaluateOptions } from './detector';
import type { AiAnalysis, EvaluationResult, ShortItem } from './types';

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

export function parseGeminiJsonResponse(
  rawText: string
): { score?: number; is_spoiler?: boolean; reasoning?: string } | null {
  const cleaned = (rawText || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  if (!cleaned) return null;

  let obj: Record<string, unknown> | null = null;
  try {
    obj = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      obj = JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== 'object') return null;

  const rawScore = obj.score ?? obj.confidence_score ?? obj.probability;
  let scoreNum: number | undefined;
  if (typeof rawScore === 'number' && Number.isFinite(rawScore)) {
    scoreNum = rawScore > 1 && rawScore <= 100 ? rawScore / 100 : rawScore;
  } else if (typeof rawScore === 'string' && rawScore.trim() !== '') {
    const parsedNum = Number(rawScore.trim());
    if (Number.isFinite(parsedNum)) {
      scoreNum = parsedNum > 1 && parsedNum <= 100 ? parsedNum / 100 : parsedNum;
    }
  }

  const isSpoiler = typeof obj.is_spoiler === 'boolean' ? obj.is_spoiler : undefined;
  if (scoreNum === undefined && isSpoiler !== undefined) {
    scoreNum = isSpoiler ? 0.88 : 0.12;
  }
  if (scoreNum === undefined) return null;

  return {
    score: Math.min(0.99, Math.max(0, scoreNum)),
    is_spoiler: isSpoiler,
    reasoning: typeof obj.reasoning === 'string' ? obj.reasoning.trim() : undefined
  };
}

export function shouldUseLowThinking(modelId: string): boolean {
  // Gemini 3.5 Flash-Lite / 3.1 Flash-Lite default to minimal thinking already;
  // 3.8 / 3.6 / 4 default to medium/high thinking so we explicitly request LOW to minimize latency.
  if (modelId.includes('lite') || modelId.startsWith('gemini-2.')) return false;
  return modelId.startsWith('gemini-3.') || modelId.startsWith('gemini-4');
}

async function sendGenerateContent(
  modelId: string,
  geminiKey: string,
  parts: Array<Record<string, unknown>>,
  generationConfig: Record<string, unknown>,
  timeoutMs: number
): Promise<Response> {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiKey
      },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig
      })
    }
  );
}

export async function callGeminiModel(
  modelId: string,
  geminiKey: string,
  parts: Array<Record<string, unknown>>,
  options: { useLowThinking?: boolean; timeoutMs?: number } = {}
): Promise<{
  ok: boolean;
  status?: number;
  parsed?: { score?: number; is_spoiler?: boolean; reasoning?: string };
  errorTag?: string;
}> {
  const timeoutMs = options.timeoutMs ?? 5500;
  const generationConfig: Record<string, unknown> = {
    responseMimeType: 'application/json',
    maxOutputTokens: 320
  };
  if (options.useLowThinking) {
    generationConfig.thinkingConfig = { thinkingLevel: 'LOW' };
  }

  try {
    let resp = await sendGenerateContent(modelId, geminiKey, parts, generationConfig, timeoutMs);

    // If thinkingConfig or responseMimeType triggers HTTP 400 on a specific model revision, retry plain JSON call once
    if (resp.status === 400 && (generationConfig.thinkingConfig || generationConfig.responseMimeType)) {
      resp = await sendGenerateContent(
        modelId,
        geminiKey,
        parts,
        { maxOutputTokens: 320 },
        timeoutMs
      );
    }

    if (resp.ok) {
      const data = (await resp.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string; thought?: boolean }>;
          };
        }>;
      };
      const partList = data?.candidates?.[0]?.content?.parts || [];
      const rawText = partList
        .filter((p) => !p.thought && typeof p.text === 'string')
        .map((p) => p.text)
        .join('\n');
      const parsed = parseGeminiJsonResponse(rawText);
      if (parsed && typeof parsed.score === 'number') {
        return { ok: true, status: resp.status, parsed };
      }
      return {
        ok: false,
        status: resp.status,
        errorTag: `${modelId}:bad-json(${rawText.slice(0, 32).replace(/\s+/g, ' ')})`
      };
    }

    let detail = `HTTP ${resp.status}`;
    try {
      const errJson = (await resp.json()) as { error?: { status?: string; message?: string } };
      if (errJson?.error?.status || errJson?.error?.message) {
        detail = `${resp.status} ${errJson.error.status || ''} ${(errJson.error.message || '').slice(0, 110)}`.trim();
      }
    } catch {}
    return { ok: false, status: resp.status, errorTag: `${modelId}:${detail}` };
  } catch (err) {
    return {
      ok: false,
      errorTag: `${modelId}:${err instanceof Error ? err.name : 'err'}`
    };
  }
}

const MODEL_CACHE_TTL_MS = 5 * 60 * 1000;
let cachedDiscovery: {
  keyFingerprint: string;
  models: string[];
  workingModel?: string;
  fetchedAt: number;
} | null = null;

export function resetGeminiCacheForTests() {
  cachedDiscovery = null;
}

export function pickPreferredGeminiModels(models: string[]): string[] {
  const usable = models.filter(
    (m) =>
      m.includes('flash') &&
      !m.includes('tts') &&
      !m.includes('image') &&
      !m.includes('live') &&
      !m.includes('audio') &&
      !m.includes('robotics') &&
      !m.includes('cyber')
  );
  // Prioritize high-quota, ultra-low-latency multimodal free-tier Flash-Lite models first,
  // followed by Flash workhorse models.
  const priority = [
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash'
  ];
  const ordered: string[] = [];
  for (const p of priority) {
    const exact =
      usable.find((m) => m === p) || usable.find((m) => m.startsWith(`${p}-`) || m.startsWith(p));
    if (exact && !ordered.includes(exact)) ordered.push(exact);
  }
  for (const m of usable) {
    if (!ordered.includes(m)) ordered.push(m);
  }
  return ordered.slice(0, 4);
}

export async function discoverAvailableGeminiModels(geminiKey: string): Promise<{
  models: string[];
  error?: string;
}> {
  try {
    const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
      headers: { 'x-goog-api-key': geminiKey },
      signal: AbortSignal.timeout(3500),
      cache: 'no-store'
    });
    if (!resp.ok) {
      let msg = `HTTP ${resp.status}`;
      try {
        const j = (await resp.json()) as { error?: { status?: string; message?: string } };
        if (j?.error?.message) {
          msg = `${resp.status} ${j.error.status || ''}: ${j.error.message.slice(0, 140)}`.trim();
        }
      } catch {}
      return { models: [], error: msg };
    }
    const data = (await resp.json()) as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
    };
    const names = (data.models || [])
      .filter(
        (m) =>
          m.name &&
          m.supportedGenerationMethods?.includes('generateContent') &&
          m.name.includes('gemini')
      )
      .map((m) => m.name!.replace(/^models\//, ''));
    return { models: names };
  } catch (err) {
    return { models: [], error: err instanceof Error ? err.message : 'models list failed' };
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

  const failures: string[] = [];

  try {
    let parsed: { score?: number; reasoning?: string } | null = null;
    let provider: AiAnalysis['provider'] = 'gemini-3.5-flash-lite';
    let multimodalUsed = false;

    if (geminiKey) {
      const keyFingerprint = geminiKey.slice(0, 12);
      const cacheValid =
        cachedDiscovery &&
        cachedDiscovery.keyFingerprint === keyFingerprint &&
        Date.now() - cachedDiscovery.fetchedAt < MODEL_CACHE_TTL_MS;

      let candidateModels: string[] = [];

      if (cacheValid && cachedDiscovery) {
        candidateModels = cachedDiscovery.workingModel
          ? [
              cachedDiscovery.workingModel,
              ...cachedDiscovery.models.filter((m) => m !== cachedDiscovery!.workingModel)
            ]
          : cachedDiscovery.models;
      } else {
        const disc = await discoverAvailableGeminiModels(geminiKey);
        if (disc.error) {
          failures.push(`list:${disc.error}`);
        } else if (disc.models.length > 0) {
          candidateModels = pickPreferredGeminiModels(disc.models);
          if (candidateModels.length > 0) {
            cachedDiscovery = {
              keyFingerprint,
              models: candidateModels,
              fetchedAt: Date.now()
            };
          }
        }
      }

      // Even if model listing failed or returned empty (e.g., restricted ListModels permission),
      // attempt direct generateContent against active 2026 free-tier models.
      if (candidateModels.length === 0) {
        candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.8-flash'];
      }

      const thumb = await fetchThumbnailBase64(shortItem.thumbnailUrl);
      const textParts: Array<Record<string, unknown>> = [{ text: prompt }];
      const multimodalParts: Array<Record<string, unknown>> = thumb
        ? [
            { text: prompt },
            { inlineData: { mimeType: thumb.mimeType, data: thumb.data } }
          ]
        : textParts;

      for (let idx = 0; idx < candidateModels.length; idx++) {
        const modelId = candidateModels[idx];
        const useLowThinking = shouldUseLowThinking(modelId);
        const parts = idx === 0 ? multimodalParts : textParts;

        let res = await callGeminiModel(modelId, geminiKey, parts, {
          useLowThinking,
          timeoutMs: 4800
        });

        // If multimodal request failed on first attempt due to payload/400/timeout, immediately retry text-only on same model
        if (!res.ok && parts.length > 1 && res.status !== 401 && res.status !== 403) {
          res = await callGeminiModel(modelId, geminiKey, textParts, {
            useLowThinking,
            timeoutMs: 4200
          });
          if (res.ok && res.parsed) {
            parsed = res.parsed;
            provider = modelId;
            multimodalUsed = false;
            if (cachedDiscovery && cachedDiscovery.keyFingerprint === keyFingerprint) {
              cachedDiscovery.workingModel = modelId;
            }
            break;
          }
        }

        if (res.ok && res.parsed) {
          parsed = res.parsed;
          provider = modelId;
          multimodalUsed = parts.length > 1;
          if (cachedDiscovery && cachedDiscovery.keyFingerprint === keyFingerprint) {
            cachedDiscovery.workingModel = modelId;
          }
          break;
        }
        if (res.errorTag) failures.push(res.errorTag);

        // Hard auth error won't succeed on another model with the same key; fail fast cleanly
        if (res.status === 401) break;
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
        parsed = parseGeminiJsonResponse(raw);
      } else {
        failures.push(`openai:HTTP ${resp.status}`);
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
    failures.push(err instanceof Error ? err.message : 'LLM error');
  }

  return {
    ...baseResult,
    ai_analysis: {
      ...buildOnDeviceReasoning(baseResult),
      ...(failures.length > 0 ? { fallbackReason: failures.slice(0, 2).join(' | ') } : {})
    }
  };
}
