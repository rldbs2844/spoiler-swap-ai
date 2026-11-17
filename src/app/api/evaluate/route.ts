import { NextRequest, NextResponse } from 'next/server';
import { evaluateWithOptionalLlm } from '@/lib/ai-stage4';
import { DEFAULT_THRESHOLD, DEFAULT_WATCHLIST } from '@/lib/constants';
import { buildOnDeviceReasoning, evaluateShort } from '@/lib/detector';
import type { ShortItem } from '@/lib/types';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const watchlist = Array.isArray(body.watchlist)
    ? (body.watchlist as string[])
    : DEFAULT_WATCHLIST;
  const threshold =
    typeof body.threshold === 'number' ? body.threshold : DEFAULT_THRESHOLD;

  if (Array.isArray(body.shorts)) {
    const items = body.shorts as Partial<ShortItem>[];
    const results = items.map((item) => {
      const base = evaluateShort(item, { watchlist, threshold });
      return {
        ...base,
        ai_analysis: buildOnDeviceReasoning(base)
      };
    });
    return NextResponse.json({ ok: true, count: results.length, results });
  }

  const shortItem: Partial<ShortItem> = (body.shortItem as Partial<ShortItem>) || {
    id: String(body.id || body.video_id || 'api_input_001'),
    channel: String(body.channel || '@web_api_user'),
    title: String(body.title || ''),
    ocr: String(body.ocr || ''),
    stt: String(body.stt || ''),
    thumbnailUrl: typeof body.thumbnailUrl === 'string' ? body.thumbnailUrl : undefined
  };

  const finalResult = await evaluateWithOptionalLlm(shortItem, { watchlist, threshold });
  return NextResponse.json(finalResult);
}
