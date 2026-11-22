import { NextRequest, NextResponse } from "next/server";
import { FALLBACK_VIDEOS } from "@/lib/fallbackVideos";
import { evaluateFourStageSpoiler } from "@/lib/spoilerEngine";
import { fetchSingleVideoEnrichment } from "@/lib/youtubeServer";
import {
  analyzeWithGeminiMultimodal,
  fetchThumbnailBase64,
} from "@/lib/geminiServer";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

interface AnalyzeRequestBody {
  videoId?: string;
  title?: string;
  channelTitle?: string;
  description?: string;
  tags?: string[];
  thumbnailUrl?: string;
  ocrText?: string;
  sttText?: string;
  protectedKeywords?: string[];
  threshold?: number;
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  try {
    const body = (await req.json()) as AnalyzeRequestBody;
    const videoId = (body.videoId ?? "").trim();
    if (!videoId) {
      return NextResponse.json(
        { error: "videoId가 필요합니다." },
        { status: 400 }
      );
    }

    const fallbackMatch = FALLBACK_VIDEOS.find((v) => v.id === videoId);
    let description = body.description ?? fallbackMatch?.description ?? "";
    let tags = body.tags ?? fallbackMatch?.tags ?? [];
    const ocrText = body.ocrText ?? fallbackMatch?.ocrSampleText ?? "";
    let sttText = body.sttText ?? fallbackMatch?.sttSampleText ?? "";
    const title = body.title ?? fallbackMatch?.title ?? "";
    const channelTitle =
      body.channelTitle ?? fallbackMatch?.channelTitle ?? "YouTube";
    const thumbnailUrl =
      body.thumbnailUrl ||
      fallbackMatch?.thumbnailUrl ||
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    const protectedKeywords = Array.isArray(body.protectedKeywords)
      ? body.protectedKeywords
      : [];
    const threshold =
      typeof body.threshold === "number" ? body.threshold : 70;

    // Enrich metadata/captions and prefetch thumbnail concurrently for low latency
    const needsEnrichment = !sttText || (!description && tags.length === 0);
    const hasSnippetAlready = Boolean(description && tags.length > 0);
    const [enriched, preFetchedImage] = await Promise.all([
      needsEnrichment
        ? fetchSingleVideoEnrichment(videoId, hasSnippetAlready)
        : Promise.resolve(null),
      protectedKeywords.length > 0
        ? fetchThumbnailBase64(videoId, thumbnailUrl)
        : Promise.resolve(null),
    ]);

    if (enriched) {
      if (!description && enriched.description) {
        description = enriched.description;
      }
      if (tags.length === 0 && enriched.tags) {
        tags = enriched.tags;
      }
      if (!sttText && enriched.sttTranscript) {
        sttText = enriched.sttTranscript;
      }
    }

    // Call Gemini Multimodal when GEMINI_API_KEY is configured on server
    const geminiOutcome = await analyzeWithGeminiMultimodal({
      videoId,
      title,
      channelTitle,
      description,
      tags,
      thumbnailUrl,
      ocrText,
      sttText,
      protectedKeywords,
      preFetchedImage,
    });

    const elapsedMs = Math.max(12, Date.now() - startedAt);
    const analysis = evaluateFourStageSpoiler(
      {
        videoId,
        title,
        channelTitle,
        description,
        tags,
        thumbnailUrl,
        ocrText,
        sttText,
        protectedKeywords,
        threshold,
      },
      geminiOutcome.decision,
      elapsedMs,
      geminiOutcome.errorReason
    );

    return NextResponse.json(analysis);
  } catch {
    return NextResponse.json(
      { error: "영상 스포일러 분석 요청 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
