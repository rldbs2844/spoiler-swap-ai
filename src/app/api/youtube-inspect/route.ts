import { NextRequest, NextResponse } from 'next/server';
import { evaluateWithOptionalLlm } from '@/lib/ai-stage4';
import { DEFAULT_THRESHOLD, DEFAULT_WATCHLIST } from '@/lib/constants';
import { extractYouTubeVideoId, fetchYouTubeShortMetadata } from '@/lib/youtube';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const url = String(body.url || '');
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    return NextResponse.json(
      { ok: false, error: '유효한 유튜브 쇼츠 URL 또는 11자리 영상 ID를 입력해 주세요.' },
      { status: 400 }
    );
  }

  const watchlist = Array.isArray(body.watchlist)
    ? (body.watchlist as string[])
    : DEFAULT_WATCHLIST;
  const threshold =
    typeof body.threshold === 'number' ? body.threshold : DEFAULT_THRESHOLD;

  try {
    const { shortItem, provider } = await fetchYouTubeShortMetadata(videoId, {
      ocr: typeof body.ocr === 'string' ? body.ocr : undefined,
      stt: typeof body.stt === 'string' ? body.stt : undefined
    });

    const result = await evaluateWithOptionalLlm(shortItem, { watchlist, threshold });
    return NextResponse.json({
      ok: true,
      provider,
      shortItem,
      result
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '유튜브 메타데이터 조회 실패';
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
