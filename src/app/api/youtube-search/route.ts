import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_THRESHOLD, DEFAULT_WATCHLIST } from '@/lib/constants';
import { buildOnDeviceReasoning, evaluateShort } from '@/lib/detector';
import { searchYouTubeShorts } from '@/lib/youtube';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const query = String(body.query || '').trim();
  const maxResults = typeof body.maxResults === 'number' ? body.maxResults : 6;
  const watchlist = Array.isArray(body.watchlist)
    ? (body.watchlist as string[])
    : DEFAULT_WATCHLIST;
  const threshold =
    typeof body.threshold === 'number' ? body.threshold : DEFAULT_THRESHOLD;

  const searchRes = await searchYouTubeShorts(query, maxResults);
  const evaluatedItems = searchRes.items.map((item) => {
    const res = evaluateShort(item, { watchlist, threshold });
    return {
      shortItem: item,
      result: {
        ...res,
        ai_analysis: buildOnDeviceReasoning(res)
      }
    };
  });

  return NextResponse.json({
    ok: true,
    provider: searchRes.provider,
    notice: searchRes.notice,
    count: evaluatedItems.length,
    items: evaluatedItems
  });
}
