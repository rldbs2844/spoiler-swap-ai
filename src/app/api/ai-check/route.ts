import { NextResponse } from 'next/server';
import {
  callGeminiModel,
  discoverAvailableGeminiModels,
  pickPreferredGeminiModels,
  shouldUseLowThinking
} from '@/lib/ai-stage4';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function GET() {
  const geminiKey = process.env.GEMINI_API_KEY?.trim() || '';
  const youtubeKey = process.env.YOUTUBE_API_KEY?.trim() || '';

  const geminiCheck: {
    configured: boolean;
    keyPrefix: string | null;
    ok: boolean;
    testedModel?: string;
    availableModels: string[];
    attempts: string[];
    error?: string;
  } = {
    configured: Boolean(geminiKey),
    keyPrefix: geminiKey ? `${geminiKey.slice(0, 5)}...` : null,
    ok: false,
    availableModels: [],
    attempts: []
  };

  if (geminiKey) {
    const disc = await discoverAvailableGeminiModels(geminiKey);
    geminiCheck.availableModels = disc.models.slice(0, 10);
    if (disc.error) {
      geminiCheck.attempts.push(`models.list: ${disc.error}`);
    }

    const candidates =
      disc.models.length > 0
        ? pickPreferredGeminiModels(disc.models)
        : ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.8-flash'];

    for (const modelId of candidates) {
      const genRes = await callGeminiModel(
        modelId,
        geminiKey,
        [{ text: 'Reply ONLY with JSON: {"score": 0.1, "reasoning": "ok"}' }],
        {
          useLowThinking: shouldUseLowThinking(modelId),
          timeoutMs: 4500
        }
      );
      if (genRes.ok) {
        geminiCheck.ok = true;
        geminiCheck.testedModel = modelId;
        geminiCheck.attempts.push(`${modelId}: 200 OK`);
        break;
      } else {
        geminiCheck.attempts.push(genRes.errorTag || `${modelId}: failed`);
        if (genRes.status === 401) break;
      }
    }

    if (!geminiCheck.ok) {
      geminiCheck.error =
        geminiCheck.attempts[geminiCheck.attempts.length - 1] ||
        disc.error ||
        'Gemini API probe failed';
    }
  }

  const youtubeCheck: {
    configured: boolean;
    keyPrefix: string | null;
    ok: boolean;
    error?: string;
  } = {
    configured: Boolean(youtubeKey),
    keyPrefix: youtubeKey ? `${youtubeKey.slice(0, 6)}...` : null,
    ok: false
  };

  if (youtubeKey) {
    try {
      const resp = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=dQw4w9WgXcQ&key=${encodeURIComponent(youtubeKey)}`,
        { signal: AbortSignal.timeout(4000), cache: 'no-store' }
      );
      if (resp.ok) {
        youtubeCheck.ok = true;
      } else {
        let msg = `HTTP ${resp.status}`;
        try {
          const j = (await resp.json()) as { error?: { message?: string } };
          if (j?.error?.message) msg = `${resp.status}: ${j.error.message.slice(0, 120)}`;
        } catch {}
        youtubeCheck.error = msg;
      }
    } catch (err) {
      youtubeCheck.error = err instanceof Error ? err.message : 'YouTube API probe failed';
    }
  }

  return NextResponse.json({
    ok: true,
    version: '2.3.0',
    gemini: geminiCheck,
    youtube: youtubeCheck
  });
}
