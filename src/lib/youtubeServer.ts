import type { VideoCategory, YouTubeVideoItem } from "@/types/video";
import { FALLBACK_VIDEOS } from "@/lib/fallbackVideos";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

const CATEGORY_QUERY_MAP: Record<Exclude<VideoCategory, "all">, string> = {
  drama: "한국 드라마 영화 리뷰 예고편",
  gaming: "롤드컵 LCK 하이라이트 게임",
  vlog: "서울 일상 브이로그 카페",
  tech: "IT 테크 리뷰 Next.js 코딩",
};

function inferCategory(
  title: string,
  description: string,
  requested: VideoCategory
): Exclude<VideoCategory, "all"> {
  if (requested !== "all") return requested;
  const hay = `${title} ${description}`.toLowerCase();
  if (
    /롤드컵|lck|페이커|t1|게임|e스포츠|발로란트|리그 오브 레전드|worlds/.test(hay)
  ) {
    return "gaming";
  }
  if (/브이로그|vlog|일상|카페|여행|집밥/.test(hay)) {
    return "vlog";
  }
  if (/아이폰|맥북|개발|코딩|리뷰|테크|ai|next\.js|삼성|애플/.test(hay)) {
    return "tech";
  }
  return "drama";
}

export function formatIsoDuration(iso: string | undefined): string {
  if (!iso) return "05:00";
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return "05:00";
  const hours = Number(m[1] || 0);
  const mins = Number(m[2] || 0);
  const secs = Number(m[3] || 0);
  const mm = String(mins).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

export function formatKoreanViewCount(viewCountRaw: string | undefined): string {
  const num = Number(viewCountRaw || 0);
  if (!Number.isFinite(num) || num <= 0) return "조회수 집계 중";
  if (num >= 100_000_000) {
    return `조회수 ${(num / 100_000_000).toFixed(1).replace(/\.0$/, "")}억회`;
  }
  if (num >= 10_000) {
    return `조회수 ${Math.round(num / 10_000).toLocaleString()}만회`;
  }
  if (num >= 1_000) {
    return `조회수 ${(num / 1_000).toFixed(1).replace(/\.0$/, "")}천회`;
  }
  return `조회수 ${num.toLocaleString()}회`;
}

export function formatRelativeDate(publishedAt: string | undefined): string {
  if (!publishedAt) return "최근";
  const ts = Date.parse(publishedAt);
  if (Number.isNaN(ts)) return "최근";
  const diffDays = Math.max(0, Math.floor((Date.now() - ts) / 86_400_000));
  if (diffDays === 0) return "오늘";
  if (diffDays < 7) return `${diffDays}일 전`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월 전`;
  return `${Math.floor(diffDays / 365)}년 전`;
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 6000): Promise<T> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) {
      throw new Error(`YouTube API HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(id);
  }
}

interface YtSearchResponse {
  items?: Array<{ id?: { videoId?: string } }>;
}

interface YtVideosResponse {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      channelTitle?: string;
      publishedAt?: string;
      description?: string;
      tags?: string[];
      thumbnails?: {
        high?: { url?: string };
        medium?: { url?: string };
      };
    };
    contentDetails?: { duration?: string };
    statistics?: { viewCount?: string };
  }>;
}

export async function fetchYouTubeFeedServer(
  query: string,
  category: VideoCategory
): Promise<{ videos: YouTubeVideoItem[]; source: "youtube-api" | "fallback"; note?: string }> {
  const apiKey = (process.env.YOUTUBE_API_KEY ?? "").trim();

  const filterFallback = (note?: string) => {
    const cleanQ = query.trim().toLowerCase();
    const list = FALLBACK_VIDEOS.filter((v) => {
      const catMatch = category === "all" || v.category === category;
      if (!catMatch) return false;
      if (!cleanQ) return true;
      const hay = `${v.title} ${v.channelTitle} ${v.description} ${v.tags.join(" ")}`.toLowerCase();
      return hay.includes(cleanQ);
    });
    return { videos: list, source: "fallback" as const, note };
  };

  if (!apiKey) {
    return filterFallback("YOUTUBE_API_KEY 미설정 상태 — 기본 큐레이션 피드를 표시합니다.");
  }

  try {
    let ids: string[] = [];
    const cleanQuery = query.trim();

    if (cleanQuery || category !== "all") {
      const searchQ =
        cleanQuery || CATEGORY_QUERY_MAP[category as Exclude<VideoCategory, "all">];
      const searchUrl = `${YOUTUBE_API_BASE}/search?part=snippet&type=video&maxResults=12&regionCode=KR&relevanceLanguage=ko&safeSearch=moderate&q=${encodeURIComponent(
        searchQ
      )}&key=${encodeURIComponent(apiKey)}`;
      const searchData = await fetchJsonWithTimeout<YtSearchResponse>(searchUrl);
      ids = (searchData.items ?? [])
        .map((it) => it.id?.videoId)
        .filter((v): v is string => Boolean(v));
    } else {
      const popUrl = `${YOUTUBE_API_BASE}/videos?part=snippet,contentDetails,statistics&chart=mostPopular&regionCode=KR&maxResults=12&key=${encodeURIComponent(
        apiKey
      )}`;
      const popData = await fetchJsonWithTimeout<YtVideosResponse>(popUrl);
      const mapped = mapYtVideoItems(popData, category);
      if (mapped.length > 0) {
        return { videos: mapped, source: "youtube-api" };
      }
    }

    if (ids.length === 0) {
      return { videos: [], source: "youtube-api" };
    }

    const detailUrl = `${YOUTUBE_API_BASE}/videos?part=snippet,contentDetails,statistics&id=${encodeURIComponent(
      ids.join(",")
    )}&key=${encodeURIComponent(apiKey)}`;
    const detailData = await fetchJsonWithTimeout<YtVideosResponse>(detailUrl);
    const videos = mapYtVideoItems(detailData, category);
    return { videos, source: "youtube-api" };
  } catch {
    return filterFallback(
      "YouTube Data API 호출 한도 또는 연결 문제로 기본 큐레이션 피드로 자동 전환했습니다."
    );
  }
}

function mapYtVideoItems(
  data: YtVideosResponse,
  requestedCategory: VideoCategory
): YouTubeVideoItem[] {
  return (data.items ?? [])
    .map((item): YouTubeVideoItem | null => {
      const id = item.id;
      const snip = item.snippet;
      if (!id || !snip?.title) return null;
      const title = snip.title;
      const channelTitle = snip.channelTitle ?? "YouTube 채널";
      const description = snip.description ?? "";
      return {
        id,
        title,
        channelTitle,
        channelInitial: channelTitle.trim().charAt(0).toUpperCase() || "Y",
        publishedAtLabel: formatRelativeDate(snip.publishedAt),
        viewCountLabel: formatKoreanViewCount(item.statistics?.viewCount),
        duration: formatIsoDuration(item.contentDetails?.duration),
        thumbnailUrl:
          snip.thumbnails?.high?.url ||
          snip.thumbnails?.medium?.url ||
          `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        category: inferCategory(title, description, requestedCategory),
        description,
        tags: snip.tags ?? [],
        source: "youtube-api",
      };
    })
    .filter((v): v is YouTubeVideoItem => v !== null);
}

export async function fetchSingleVideoEnrichment(
  videoId: string,
  skipSnippetApi = false
): Promise<{
  description?: string;
  tags?: string[];
  sttTranscript?: string;
}> {
  const apiKey = (process.env.YOUTUBE_API_KEY ?? "").trim();
  const out: { description?: string; tags?: string[]; sttTranscript?: string } = {};

  if (apiKey && !skipSnippetApi) {
    try {
      const url = `${YOUTUBE_API_BASE}/videos?part=snippet&id=${encodeURIComponent(
        videoId
      )}&key=${encodeURIComponent(apiKey)}`;
      const data = await fetchJsonWithTimeout<YtVideosResponse>(url, 1800);
      const snip = data.items?.[0]?.snippet;
      if (snip) {
        out.description = snip.description ?? "";
        out.tags = snip.tags ?? [];
      }
    } catch {}
  }

  // Lightweight best-effort public caption track fetch (auto-times out cleanly if unavailable)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1300);
    const res = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, {
      signal: controller.signal,
      headers: { "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8" },
      cache: "no-store",
    });
    clearTimeout(timer);
    if (res.ok) {
      const html = await res.text();
      const match = html.match(/"captionTracks":(\[.*?\])/);
      if (match) {
        const tracks = JSON.parse(match[1]) as Array<{
          baseUrl?: string;
          languageCode?: string;
        }>;
        const koTrack =
          tracks.find((t) => t.languageCode?.startsWith("ko")) ?? tracks[0];
        if (koTrack?.baseUrl) {
          const capCtrl = new AbortController();
          const capTimer = setTimeout(() => capCtrl.abort(), 1100);
          const capRes = await fetch(koTrack.baseUrl, { signal: capCtrl.signal });
          clearTimeout(capTimer);
          if (capRes.ok) {
            const xml = await capRes.text();
            const textOnly = xml
              .replace(/<[^>]+>/g, " ")
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&#39;/g, "'")
              .replace(/&quot;/g, '"')
              .replace(/\s+/g, " ")
              .trim();
            if (textOnly) {
              out.sttTranscript = textOnly.slice(0, 1800);
            }
          }
        }
      }
    }
  } catch {}

  return out;
}
