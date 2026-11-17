import type { ShortItem } from './types';

export function extractYouTubeVideoId(inputUrl: string): string | null {
  const trimmed = (inputUrl || '').trim();
  if (!trimmed) return null;

  // Direct 11-char video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const shortsMatch = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch) return shortsMatch[1];

    const vParam = url.searchParams.get('v');
    if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) return vParam;

    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.replace(/^\//, '').slice(0, 11);
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Best-effort extraction of public YouTube captions/subtitles for Stage 3 STT.
 * Fails gracefully with empty string if captions are disabled or blocked.
 */
export async function fetchYouTubeCaptions(videoId: string): Promise<string> {
  try {
    const pageResp = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, {
      headers: {
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(2500),
      cache: 'no-store'
    });
    if (!pageResp.ok) return '';
    const html = await pageResp.text();
    const match = html.match(/"captionTracks":(\[.*?\])/);
    if (!match) return '';

    const tracks = JSON.parse(match[1]) as Array<{
      baseUrl?: string;
      languageCode?: string;
    }>;
    const preferred =
      tracks.find((t) => t.languageCode?.startsWith('ko')) ||
      tracks.find((t) => t.languageCode?.startsWith('en')) ||
      tracks[0];
    if (!preferred?.baseUrl) return '';

    const timedTextResp = await fetch(`${preferred.baseUrl}&fmt=json3`, {
      signal: AbortSignal.timeout(2500),
      cache: 'no-store'
    });
    if (!timedTextResp.ok) return '';
    const timedData = (await timedTextResp.json()) as {
      events?: Array<{ segs?: Array<{ utf8?: string }> }>;
    };
    const words = (timedData.events || [])
      .flatMap((ev) => ev.segs || [])
      .map((s) => (s.utf8 || '').trim())
      .filter(Boolean);
    return words.join(' ').replace(/\s+/g, ' ').trim().slice(0, 400);
  } catch {
    return '';
  }
}

export interface YouTubeMetadataResult {
  shortItem: ShortItem;
  provider: 'youtube_data_api_v3' | 'youtube_oembed';
}

export async function fetchYouTubeShortMetadata(
  videoId: string,
  options: { ocr?: string; stt?: string } = {}
): Promise<YouTubeMetadataResult> {
  const apiKey = (process.env.YOUTUBE_API_KEY || '').trim();
  const canonicalUrl = `https://www.youtube.com/shorts/${videoId}`;

  // Fetch captions in parallel (best-effort, 2.5s timeout) if user didn't provide STT hint
  const captionsPromise = options.stt?.trim()
    ? Promise.resolve('')
    : fetchYouTubeCaptions(videoId);

  // 1. Prefer YouTube Data API v3 when YOUTUBE_API_KEY is configured
  if (apiKey) {
    const endpoint = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(apiKey)}`;
    const [resp, autoCaptions] = await Promise.all([
      fetch(endpoint, { signal: AbortSignal.timeout(4000), cache: 'no-store' }),
      captionsPromise
    ]);

    if (resp.ok) {
      const data = await resp.json();
      const item = data?.items?.[0];
      const snippet = item?.snippet;
      if (snippet) {
        const tags = Array.isArray(snippet.tags)
          ? snippet.tags.slice(0, 8).map((t: string) => `#${t}`).join(' ')
          : '';
        const title = `${snippet.title || ''} ${tags}`.trim();
        const descSnippet = (snippet.description || '').slice(0, 200).replace(/\s+/g, ' ').trim();
        const sttText = options.stt?.trim() || autoCaptions || descSnippet || '';
        const captionSource: ShortItem['captionSource'] = options.stt?.trim()
          ? 'user_hint'
          : autoCaptions
            ? 'youtube_captions'
            : descSnippet
              ? 'description'
              : 'none';

        return {
          provider: 'youtube_data_api_v3',
          shortItem: {
            id: videoId,
            channel: snippet.channelTitle
              ? `@${String(snippet.channelTitle).replace(/\s+/g, '_')}`
              : '@youtube_shorts',
            emoji: '🎬',
            bgGradient: 'from-rose-950 via-slate-900 to-slate-950',
            title,
            ocr: options.ocr?.trim() || descSnippet || title,
            stt: sttText,
            thumbnailUrl:
              snippet.thumbnails?.high?.url ||
              snippet.thumbnails?.default?.url ||
              `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            sourceUrl: canonicalUrl,
            isRealYouTube: true,
            publishedAt: snippet.publishedAt,
            viewCount: item?.statistics?.viewCount,
            captionSource
          }
        };
      }
    }
  }

  // 2. Zero-key YouTube oEmbed + public caption fallback
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`;
  const [oembedResp, autoCaptions] = await Promise.all([
    fetch(oembedUrl, { signal: AbortSignal.timeout(4000), cache: 'no-store' }),
    captionsPromise
  ]);

  if (!oembedResp.ok) {
    throw new Error(`유튜브 영상 메타데이터를 가져올 수 없습니다 (HTTP ${oembedResp.status})`);
  }
  const oembed = await oembedResp.json();
  const channelHandle = oembed.author_name
    ? `@${String(oembed.author_name).replace(/\s+/g, '_')}`
    : '@youtube_shorts';

  return {
    provider: 'youtube_oembed',
    shortItem: {
      id: videoId,
      channel: channelHandle,
      emoji: '🎬',
      bgGradient: 'from-indigo-950 via-slate-900 to-slate-950',
      title: String(oembed.title || ''),
      ocr: options.ocr?.trim() || '',
      stt: options.stt?.trim() || autoCaptions || '',
      thumbnailUrl:
        oembed.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      sourceUrl: canonicalUrl,
      isRealYouTube: true,
      captionSource: options.stt?.trim()
        ? 'user_hint'
        : autoCaptions
          ? 'youtube_captions'
          : 'none'
    }
  };
}

export interface YouTubeSearchResult {
  items: ShortItem[];
  provider: 'youtube_data_api_v3' | 'youtube_public_search' | 'missing_api_key';
  notice?: string;
}

export async function searchYouTubeShorts(
  query: string,
  maxResults = 6
): Promise<YouTubeSearchResult> {
  const q = query.trim();
  if (!q) {
    return { items: [], provider: 'missing_api_key', notice: '검색어를 입력해 주세요.' };
  }

  const apiKey = (process.env.YOUTUBE_API_KEY || '').trim();
  const safeMax = Math.min(10, Math.max(1, maxResults));

  // 1. Official YouTube Data API v3 Search
  if (apiKey) {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoDuration=short&maxResults=${safeMax}&q=${encodeURIComponent(`${q} shorts`)}&key=${encodeURIComponent(apiKey)}`;
    const searchResp = await fetch(searchUrl, {
      signal: AbortSignal.timeout(4000),
      cache: 'no-store'
    });
    if (searchResp.ok) {
      const searchData = await searchResp.json();
      const ids: string[] = (searchData.items || [])
        .map((it: { id?: { videoId?: string } }) => it?.id?.videoId)
        .filter((id: unknown): id is string => typeof id === 'string');

      if (ids.length > 0) {
        const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${encodeURIComponent(ids.join(','))}&key=${encodeURIComponent(apiKey)}`;
        const videosResp = await fetch(videosUrl, {
          signal: AbortSignal.timeout(4000),
          cache: 'no-store'
        });
        const videosData = videosResp.ok ? await videosResp.json() : null;
        const videoMap = new Map<string, Record<string, unknown>>();
        for (const v of videosData?.items || []) {
          if (v?.id) videoMap.set(v.id, v);
        }

        const items: ShortItem[] = (searchData.items || []).map(
          (entry: { id?: { videoId?: string }; snippet?: Record<string, unknown> }) => {
            const vid = entry.id?.videoId || '';
            const full = videoMap.get(vid) as
              | { snippet?: Record<string, unknown>; statistics?: { viewCount?: string } }
              | undefined;
            const snip = (full?.snippet || entry.snippet || {}) as {
              title?: string;
              description?: string;
              channelTitle?: string;
              publishedAt?: string;
              tags?: string[];
              thumbnails?: { high?: { url?: string }; default?: { url?: string } };
            };
            const tags = Array.isArray(snip.tags)
              ? snip.tags.slice(0, 6).map((t) => `#${t}`).join(' ')
              : '';
            const desc = (snip.description || '').slice(0, 180).replace(/\s+/g, ' ').trim();
            return {
              id: vid,
              channel: snip.channelTitle
                ? `@${String(snip.channelTitle).replace(/\s+/g, '_')}`
                : '@youtube_shorts',
              emoji: '📺',
              bgGradient: 'from-rose-950 via-slate-900 to-slate-950',
              title: `${snip.title || ''} ${tags}`.trim(),
              ocr: desc || String(snip.title || ''),
              stt: desc,
              thumbnailUrl:
                snip.thumbnails?.high?.url ||
                snip.thumbnails?.default?.url ||
                `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
              sourceUrl: `https://www.youtube.com/shorts/${vid}`,
              isRealYouTube: true,
              publishedAt: snip.publishedAt,
              viewCount: full?.statistics?.viewCount,
              captionSource: desc ? 'description' : 'none'
            };
          }
        );

        return { items, provider: 'youtube_data_api_v3' };
      }
    }
  }

  // 2. Public YouTube HTML ytInitialData fallback (no API key required)
  try {
    const htmlResp = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(`${q} shorts`)}`,
      {
        headers: {
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(3500),
        cache: 'no-store'
      }
    );
    if (htmlResp.ok) {
      const html = await htmlResp.text();
      const videoMatches = Array.from(
        html.matchAll(
          /"videoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})".*?"title":\{"runs":\[\{"text":"([^"]+)"\}\].*?"ownerText":\{"runs":\[\{"text":"([^"]+)"\}/g
        )
      ).slice(0, safeMax);

      if (videoMatches.length > 0) {
        const items: ShortItem[] = videoMatches.map((m) => {
          const vid = m[1];
          const title = m[2].replace(/\\u0026/g, '&').replace(/\\"/g, '"');
          const channel = m[3].replace(/\s+/g, '_');
          return {
            id: vid,
            channel: `@${channel}`,
            emoji: '📺',
            bgGradient: 'from-indigo-950 via-slate-900 to-slate-950',
            title,
            ocr: '',
            stt: '',
            thumbnailUrl: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
            sourceUrl: `https://www.youtube.com/shorts/${vid}`,
            isRealYouTube: true,
            captionSource: 'none'
          };
        });
        return {
          items,
          provider: 'youtube_public_search',
          notice:
            'YOUTUBE_API_KEY 미설정 상태여서 공개 검색 파서로 불러왔습니다. API 키를 설정하면 설명란·태그·조회수까지 정밀 분석됩니다.'
        };
      }
    }
  } catch {
    // Fall through to missing_api_key notice
  }

  return {
    items: [],
    provider: 'missing_api_key',
    notice:
      '실시간 유튜브 검색을 위해 .env.local에 YOUTUBE_API_KEY를 설정하거나, "유튜브 URL 검사" 탭에서 쇼츠 링크를 직접 입력해 주세요.'
  };
}
