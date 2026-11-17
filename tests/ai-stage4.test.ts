import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateWithOptionalLlm,
  parseGeminiJsonResponse,
  pickPreferredGeminiModels,
  resetGeminiCacheForTests
} from '../src/lib/ai-stage4';
import { PRESET_SHORTS } from '../src/lib/constants';

test('pickPreferredGeminiModels excludes tts/image/live and prioritizes fast free-tier models', () => {
  const models = [
    'gemini-3.8-flash-tts',
    'gemini-3.8-flash',
    'gemini-3.1-flash-image-preview',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash-cyber',
    'gemini-2.5-flash-lite'
  ];
  const picked = pickPreferredGeminiModels(models);
  assert.deepEqual(picked, [
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-2.5-flash-lite'
  ]);
});

test('parseGeminiJsonResponse handles markdown fences, string scores, and boolean-only objects', () => {
  const fenced = parseGeminiJsonResponse(
    '```json\n{"is_spoiler": true, "score": "0.91", "reasoning": "결말 스포일러입니다."}\n```'
  );
  assert.equal(fenced?.score, 0.91);
  assert.equal(fenced?.reasoning, '결말 스포일러입니다.');

  const boolOnly = parseGeminiJsonResponse('{"is_spoiler": true, "reasoning": "범인 공개"}');
  assert.equal(boolOnly?.score, 0.88);

  assert.equal(parseGeminiJsonResponse('not json at all'), null);
});

test('evaluateWithOptionalLlm sends AQ key header, attaches inlineData thumbnail, filters thought parts, and caches working model', async () => {
  resetGeminiCacheForTests();
  const prevGemini = process.env.GEMINI_API_KEY;
  const prevOpenai = process.env.OPENAI_API_KEY;
  const origFetch = globalThis.fetch;

  process.env.GEMINI_API_KEY = 'AQ.test_key_abc123456';
  delete process.env.OPENAI_API_KEY;

  const calls: Array<{ url: string; headers?: Record<string, string>; body?: string }> = [];

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({
      url,
      headers: init?.headers as Record<string, string> | undefined,
      body: typeof init?.body === 'string' ? init.body : undefined
    });

    if (url === 'https://generativelanguage.googleapis.com/v1beta/models') {
      return new Response(
        JSON.stringify({
          models: [
            { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-3.5-flash-lite', supportedGenerationMethods: ['generateContent'] }
          ]
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.includes('i.ytimg.com')) {
      return new Response(Uint8Array.from([1, 2, 3, 4]), {
        status: 200,
        headers: { 'content-type': 'image/jpeg' }
      });
    }

    if (url.includes('models/gemini-3.5-flash-lite:generateContent')) {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  { thought: true, text: 'internal thinking should be ignored' },
                  {
                    text: JSON.stringify({
                      is_spoiler: true,
                      score: 0.94,
                      reasoning: '제목과 썸네일에 오징어 게임 최종 생존자 결말이 노출되었습니다.'
                    })
                  }
                ]
              }
            }
          ]
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    return new Response('{}', { status: 404 });
  }) as typeof fetch;

  try {
    const res1 = await evaluateWithOptionalLlm({
      ...PRESET_SHORTS[1],
      thumbnailUrl: 'https://i.ytimg.com/vi/abc123DEF45/hqdefault.jpg'
    });

    assert.equal(res1.action, 'SWAP_TO_CAT_MEME');
    assert.equal(res1.ai_analysis?.provider, 'gemini-3.5-flash-lite');
    assert.equal(res1.ai_analysis?.multimodal_used, true);
    assert.match(res1.ai_analysis?.reasoning || '', /오징어 게임/);

    const listCall = calls.find((c) => c.url.endsWith('/v1beta/models'));
    assert.equal(listCall?.headers?.['x-goog-api-key'], 'AQ.test_key_abc123456');

    const genCall = calls.find((c) => c.url.includes(':generateContent'));
    assert.equal(genCall?.headers?.['x-goog-api-key'], 'AQ.test_key_abc123456');
    const sentBody = JSON.parse(genCall?.body || '{}');
    assert.equal(sentBody.contents?.[0]?.parts?.[1]?.inlineData?.mimeType, 'image/jpeg');

    // Second call should skip /v1beta/models due to workingModel cache
    const callsBeforeSecond = calls.length;
    const res2 = await evaluateWithOptionalLlm(PRESET_SHORTS[1]);
    assert.equal(res2.ai_analysis?.provider, 'gemini-3.5-flash-lite');
    const secondCalls = calls.slice(callsBeforeSecond);
    assert.equal(
      secondCalls.some((c) => c.url.endsWith('/v1beta/models')),
      false
    );
  } finally {
    globalThis.fetch = origFetch;
    if (prevGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevGemini;
    if (prevOpenai !== undefined) process.env.OPENAI_API_KEY = prevOpenai;
  }
});

test('evaluateWithOptionalLlm falls back on HTTP 429 and surfaces clear 401 diagnostics', async () => {
  resetGeminiCacheForTests();
  const prevGemini = process.env.GEMINI_API_KEY;
  const origFetch = globalThis.fetch;
  process.env.GEMINI_API_KEY = 'AQ.test_key_fallback';

  // Case 1: 429 on gemini-3.5-flash-lite -> succeeds on gemini-3.8-flash with LOW thinkingLevel
  let lowThinkingObserved = false;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.endsWith('/v1beta/models')) {
      return new Response(
        JSON.stringify({
          models: [
            { name: 'models/gemini-3.5-flash-lite', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] }
          ]
        }),
        { status: 200 }
      );
    }
    if (url.includes('gemini-3.5-flash-lite:generateContent')) {
      return new Response(
        JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' } }),
        { status: 429 }
      );
    }
    if (url.includes('gemini-3.8-flash:generateContent')) {
      const parsedBody = JSON.parse(String(init?.body || '{}'));
      lowThinkingObserved = parsedBody?.generationConfig?.thinkingConfig?.thinkingLevel === 'LOW';
      return new Response(
        JSON.stringify({
          candidates: [
            { content: { parts: [{ text: '{"is_spoiler": true, "score": 0.9, "reasoning": "폴백 모델 성공"}' }] } }
          ]
        }),
        { status: 200 }
      );
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;

  try {
    const resFallback = await evaluateWithOptionalLlm(PRESET_SHORTS[1]);
    assert.equal(resFallback.ai_analysis?.provider, 'gemini-3.8-flash');
    assert.equal(lowThinkingObserved, true);

    // Case 2: 401 ACCESS_TOKEN_TYPE_UNSUPPORTED on list and direct calls -> surfaces exact diagnostic
    resetGeminiCacheForTests();
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          error: {
            status: 'UNAUTHENTICATED',
            message: 'ACCESS_TOKEN_TYPE_UNSUPPORTED'
          }
        }),
        { status: 401 }
      )) as typeof fetch;

    const res401 = await evaluateWithOptionalLlm(PRESET_SHORTS[1]);
    assert.equal(res401.ai_analysis?.provider, 'on-device-kg');
    assert.match(res401.ai_analysis?.fallbackReason || '', /401/);
  } finally {
    globalThis.fetch = origFetch;
    if (prevGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevGemini;
  }
});
