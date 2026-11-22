import { NextRequest, NextResponse } from "next/server";
import type { VideoCategory } from "@/types/video";
import { fetchYouTubeFeedServer } from "@/lib/youtubeServer";

export const dynamic = "force-dynamic";

const ALLOWED_CATEGORIES = new Set<VideoCategory>([
  "all",
  "drama",
  "gaming",
  "vlog",
  "tech",
]);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const rawCat = (searchParams.get("category") ?? "all") as VideoCategory;
  const category: VideoCategory = ALLOWED_CATEGORIES.has(rawCat)
    ? rawCat
    : "all";

  const result = await fetchYouTubeFeedServer(q, category);

  return NextResponse.json({
    source: result.source,
    note: result.note ?? null,
    hasYoutubeKey: Boolean((process.env.YOUTUBE_API_KEY ?? "").trim()),
    hasGeminiKey: Boolean((process.env.GEMINI_API_KEY ?? "").trim()),
    videos: result.videos,
  });
}
