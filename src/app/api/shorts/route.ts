import { NextResponse } from 'next/server';
import {
  CAT_MEMES,
  DEFAULT_THRESHOLD,
  DEFAULT_WATCHLIST,
  PRESET_SHORTS
} from '@/lib/constants';

export async function GET() {
  return NextResponse.json({
    ok: true,
    default_watchlist: DEFAULT_WATCHLIST,
    default_threshold: DEFAULT_THRESHOLD,
    preset_shorts: PRESET_SHORTS,
    cat_memes: CAT_MEMES
  });
}
