"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Search, SlidersHorizontal, ClipboardList, X } from "lucide-react";
import VideoFeedGrid from "@/components/VideoFeedGrid";
import WatchWorkspace from "@/components/WatchWorkspace";
import KeywordSettingsModal from "@/components/KeywordSettingsModal";
import DetectionLogModal from "@/components/DetectionLogModal";
import { FALLBACK_VIDEOS } from "@/lib/fallbackVideos";
import { evaluateFourStageSpoiler } from "@/lib/spoilerEngine";
import {
  CATEGORY_LABELS,
  DEFAULT_KEYWORD_RULES,
  type AnalyzeResult,
  type DetectionLogEntry,
  type KeywordRule,
  type VideoCategory,
  type YouTubeVideoItem,
} from "@/types/video";

interface YouTubeApiPayload {
  source: "youtube-api" | "fallback";
  note: string | null;
  hasYoutubeKey: boolean;
  hasGeminiKey: boolean;
  videos: YouTubeVideoItem[];
}

export default function HomePage() {
  const [category, setCategory] = useState<VideoCategory>("all");
  const [searchInput, setSearchInput] = useState<string>("");
  const [activeQuery, setActiveQuery] = useState<string>("");

  const [videos, setVideos] = useState<YouTubeVideoItem[]>(FALLBACK_VIDEOS);
  const [loadedFeedKey, setLoadedFeedKey] = useState<string>("");
  const [feedSource, setFeedSource] = useState<"youtube-api" | "fallback">(
    "fallback"
  );
  const [apiStatus, setApiStatus] = useState<{
    hasYoutubeKey: boolean;
    hasGeminiKey: boolean;
    note: string | null;
  }>({
    hasYoutubeKey: false,
    hasGeminiKey: false,
    note: null,
  });

  const [watchStack, setWatchStack] = useState<YouTubeVideoItem[]>([]);
  const selectedVideo =
    watchStack.length > 0 ? watchStack[watchStack.length - 1] : null;
  const previousVideo =
    watchStack.length > 1 ? watchStack[watchStack.length - 2] : null;

  const watchStackRef = useRef<YouTubeVideoItem[]>([]);
  const historySnapshotsRef = useRef<Record<number, YouTubeVideoItem[]>>({
    0: [],
  });

  useEffect(() => {
    watchStackRef.current = watchStack;
  }, [watchStack]);

  const initialUrlHandledRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.history.state?.sgDepth !== "number") {
      window.history.replaceState(
        { sgDepth: 0 },
        "",
        window.location.pathname + window.location.search
      );
    }

    const onPopState = (ev: PopStateEvent) => {
      const depth =
        typeof ev.state?.sgDepth === "number" ? ev.state.sgDepth : 0;
      if (depth <= 0) {
        setWatchStack([]);
        return;
      }
      const snapshot = historySnapshotsRef.current[depth];
      if (snapshot && snapshot.length > 0) {
        setWatchStack(snapshot);
      } else {
        setWatchStack((prev) => prev.slice(0, depth));
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const openVideo = useCallback((video: YouTubeVideoItem) => {
    const current = watchStackRef.current;
    const last = current[current.length - 1];
    if (last && last.id === video.id) return;

    const nextStack = [...current, video];
    const nextDepth = nextStack.length;
    historySnapshotsRef.current[nextDepth] = nextStack;
    setWatchStack(nextStack);

    if (typeof window !== "undefined") {
      window.history.pushState(
        { sgDepth: nextDepth, videoId: video.id },
        "",
        `?v=${encodeURIComponent(video.id)}`
      );
    }
  }, []);

  const goBackOneVideo = useCallback(() => {
    const current = watchStackRef.current;
    if (current.length === 0) return;

    if (
      typeof window !== "undefined" &&
      window.history.state?.sgDepth === current.length &&
      current.length > 0
    ) {
      window.history.back();
      return;
    }

    const nextStack = current.slice(0, -1);
    setWatchStack(nextStack);
  }, []);

  const goToFeed = useCallback(() => {
    if (watchStackRef.current.length === 0) return;
    setWatchStack([]);
    if (typeof window !== "undefined") {
      window.history.pushState({ sgDepth: 0 }, "", window.location.pathname);
    }
  }, []);

  const [keywords, setKeywords] = useState<KeywordRule[]>(DEFAULT_KEYWORD_RULES);
  const [threshold, setThreshold] = useState<number>(70);

  const [analysisState, setAnalysisState] = useState<{
    sig: string;
    result: AnalyzeResult;
  } | null>(null);
  const [overriddenIds, setOverriddenIds] = useState<Record<string, boolean>>(
    {}
  );
  const overriddenIdsRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    overriddenIdsRef.current = overriddenIds;
  }, [overriddenIds]);

  const [lastObservedEngine, setLastObservedEngine] = useState<
    "gemini-multimodal" | "local-fallback" | null
  >(null);
  const [inspectedMap, setInspectedMap] = useState<
    Record<string, AnalyzeResult>
  >({});
  const [logs, setLogs] = useState<DetectionLogEntry[]>([]);

  const [showKeywordModal, setShowKeywordModal] = useState<boolean>(false);
  const [showLogModal, setShowLogModal] = useState<boolean>(false);

  const activeKeywords = useMemo(
    () => keywords.filter((k) => k.enabled).map((k) => k.term),
    [keywords]
  );

  const currentFeedKey = `${category}::${activeQuery}`;
  const loadingFeed = loadedFeedKey !== currentFeedKey;

  // Fetch /api/youtube whenever category or active search query changes
  useEffect(() => {
    let cancelled = false;
    const reqKey = currentFeedKey;

    const url = `/api/youtube?category=${encodeURIComponent(
      category
    )}&q=${encodeURIComponent(activeQuery)}`;

    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error("YouTube API fetch error");
        return (await res.json()) as YouTubeApiPayload;
      })
      .then((data) => {
        if (cancelled) return;
        setVideos(data.videos);
        setFeedSource(data.source);
        setApiStatus({
          hasYoutubeKey: data.hasYoutubeKey,
          hasGeminiKey: data.hasGeminiKey,
          note: data.note,
        });
      })
      .catch(() => {
        if (cancelled) return;
        const cleanQ = activeQuery.trim().toLowerCase();
        const localFiltered = FALLBACK_VIDEOS.filter((v) => {
          const catOk = category === "all" || v.category === category;
          if (!catOk) return false;
          if (!cleanQ) return true;
          return `${v.title} ${v.channelTitle} ${v.tags.join(" ")}`
            .toLowerCase()
            .includes(cleanQ);
        });
        setVideos(localFiltered);
        setFeedSource("fallback");
      })
      .finally(() => {
        if (!cancelled) setLoadedFeedKey(reqKey);
      });

    return () => {
      cancelled = true;
    };
  }, [category, activeQuery, currentFeedKey]);

  useEffect(() => {
    if (initialUrlHandledRef.current || loadingFeed || typeof window === "undefined") {
      return;
    }
    initialUrlHandledRef.current = true;
    const vid = new URLSearchParams(window.location.search).get("v")?.trim();
    if (!vid || watchStackRef.current.length > 0) return;

    const found =
      videos.find((v) => v.id === vid) ??
      FALLBACK_VIDEOS.find((v) => v.id === vid);

    const target: YouTubeVideoItem = found ?? {
      id: vid,
      title: `YouTube 영상 (${vid})`,
      channelTitle: "YouTube",
      channelInitial: "Y",
      publishedAtLabel: "최근",
      viewCountLabel: "공유 링크",
      duration: "00:00",
      thumbnailUrl: `https://i.ytimg.com/vi/${encodeURIComponent(vid)}/hqdefault.jpg`,
      category: "drama",
      description: "",
      tags: [],
      source: "youtube-api",
    };

    const nextStack = [target];
    historySnapshotsRef.current[1] = nextStack;
    setWatchStack(nextStack);
    window.history.replaceState(
      { sgDepth: 1, videoId: target.id },
      "",
      `?v=${encodeURIComponent(target.id)}`
    );
  }, [loadingFeed, videos]);

  const currentAnalyzeSig = selectedVideo
    ? `${selectedVideo.id}::${threshold}::${activeKeywords.join("|")}`
    : "";
  const analysis =
    selectedVideo && analysisState?.sig === currentAnalyzeSig
      ? analysisState.result
      : null;
  const analyzing = Boolean(selectedVideo && !analysis);

  // Run /api/analyze automatically whenever selectedVideo, keywords, or threshold changes
  const lastLogSigRef = useRef<string>("");

  useEffect(() => {
    if (!selectedVideo) return;

    let cancelled = false;
    const controller = new AbortController();
    const abortTimer = window.setTimeout(() => controller.abort(), 7000);
    const targetVideo = selectedVideo;
    const targetSig = currentAnalyzeSig;
    const targetKeywords = [...activeKeywords];
    const targetThreshold = threshold;

    fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        videoId: targetVideo.id,
        title: targetVideo.title,
        channelTitle: targetVideo.channelTitle,
        description: targetVideo.description,
        tags: targetVideo.tags,
        thumbnailUrl: targetVideo.thumbnailUrl,
        ocrText: targetVideo.ocrSampleText,
        sttText: targetVideo.sttSampleText,
        protectedKeywords: targetKeywords,
        threshold: targetThreshold,
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Analyze request failed");
        return (await res.json()) as AnalyzeResult;
      })
      .catch(() => {
        // Guaranteed resilient local evaluation even on network failure
        return evaluateFourStageSpoiler(
          {
            videoId: targetVideo.id,
            title: targetVideo.title,
            channelTitle: targetVideo.channelTitle,
            description: targetVideo.description,
            tags: targetVideo.tags,
            thumbnailUrl: targetVideo.thumbnailUrl,
            ocrText: targetVideo.ocrSampleText,
            sttText: targetVideo.sttSampleText,
            protectedKeywords: targetKeywords,
            threshold: targetThreshold,
          },
          null,
          18
        );
      })
      .then((result) => {
        if (cancelled) return;
        setAnalysisState({ sig: targetSig, result });
        setLastObservedEngine(result.engineMode);
        setInspectedMap((prev) => ({ ...prev, [targetVideo.id]: result }));

        const logSig = `${targetVideo.id}:${result.threshold}:${result.riskScore}:${targetKeywords.join(",")}`;
        if (lastLogSigRef.current !== logSig) {
          lastLogSigRef.current = logSig;
          const nowStr = new Date().toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
          const entry: DetectionLogEntry = {
            id: `${targetVideo.id}-${Date.now()}`,
            timestamp: nowStr,
            videoId: targetVideo.id,
            videoTitle: targetVideo.title,
            channelTitle: targetVideo.channelTitle,
            blocked: result.isSpoiler,
            overriddenByUser: Boolean(overriddenIdsRef.current[targetVideo.id]),
            riskScore: result.riskScore,
            threshold: result.threshold,
            durationMs: result.durationMs,
            matchedKeywords: result.matchedKeywords,
            matchedStateWords: result.matchedStateWords,
            stage1Score: Math.round(result.stages.stage1Meta.weighted * 100),
            stage2Score: Math.round(result.stages.stage2Ocr.weighted * 100),
            stage3Score: Math.round(result.stages.stage3Stt.weighted * 100),
            stage4Bonus: Math.round(result.stages.stage4Fusion.bonus * 100),
            engineMode: result.engineMode,
            reason: result.reason,
          };
          // Upsert by videoId so revisiting or slider tuning keeps 1 latest log per video
          setLogs((prev) =>
            [entry, ...prev.filter((item) => item.videoId !== targetVideo.id)].slice(
              0,
              100
            )
          );
        }
      })
      .finally(() => {
        window.clearTimeout(abortTimer);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(abortTimer);
      controller.abort();
    };
  }, [selectedVideo, activeKeywords, threshold, currentAnalyzeSig]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    goToFeed();
    setCategory("all");
    setActiveQuery(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setActiveQuery("");
    setCategory("all");
    goToFeed();
  };

  const handleToggleKeyword = (id: string) => {
    setKeywords((prev) =>
      prev.map((k) => (k.id === id ? { ...k, enabled: !k.enabled } : k))
    );
  };

  const handleAddKeyword = (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    setKeywords((prev) => {
      const exists = prev.some(
        (k) => k.term.replace(/\s+/g, "").toLowerCase() === clean.replace(/\s+/g, "").toLowerCase()
      );
      if (exists) {
        return prev.map((k) =>
          k.term.replace(/\s+/g, "").toLowerCase() === clean.replace(/\s+/g, "").toLowerCase()
            ? { ...k, enabled: true }
            : k
        );
      }
      return [
        ...prev,
        {
          id: `kw-custom-${Date.now()}`,
          term: clean,
          enabled: true,
          isDefault: false,
        },
      ];
    });
  };

  const handleRemoveKeyword = (id: string) => {
    setKeywords((prev) => prev.filter((k) => k.id !== id));
  };

  const relatedVideos = useMemo(() => {
    if (!selectedVideo) return [];
    const pool = videos.length > 1 ? videos : FALLBACK_VIDEOS;
    return pool.filter((v) => v.id !== selectedVideo.id).slice(0, 10);
  }, [selectedVideo, videos]);

  const nextSafeCandidate = useMemo(() => {
    if (!selectedVideo) return null;
    const pool = [...relatedVideos, ...FALLBACK_VIDEOS].filter(
      (v, idx, arr) =>
        v.id !== selectedVideo.id &&
        arr.findIndex((x) => x.id === v.id) === idx
    );

    // Prioritize videos that pass local 4-stage check cleanly
    for (const candidate of pool) {
      const cached = inspectedMap[candidate.id];
      if (cached && !cached.isSpoiler) return candidate;
      const quickCheck = evaluateFourStageSpoiler(
        {
          videoId: candidate.id,
          title: candidate.title,
          channelTitle: candidate.channelTitle,
          description: candidate.description,
          tags: candidate.tags,
          ocrText: candidate.ocrSampleText,
          sttText: candidate.sttSampleText,
          protectedKeywords: activeKeywords,
          threshold,
        },
        null,
        5
      );
      if (!quickCheck.isSpoiler) return candidate;
    }
    return pool[0] ?? null;
  }, [selectedVideo, relatedVideos, inspectedMap, activeKeywords, threshold]);

  const handleOverride = useCallback(() => {
    if (!selectedVideo) return;
    setOverriddenIds((prev) => ({ ...prev, [selectedVideo.id]: true }));
    setLogs((prev) =>
      prev.map((item) =>
        item.videoId === selectedVideo.id
          ? { ...item, overriddenByUser: true }
          : item
      )
    );
  }, [selectedVideo]);

  const handleRestoreShield = useCallback(() => {
    if (!selectedVideo) return;
    setOverriddenIds((prev) => {
      const next = { ...prev };
      delete next[selectedVideo.id];
      return next;
    });
    setLogs((prev) =>
      prev.map((item) =>
        item.videoId === selectedVideo.id
          ? { ...item, overriddenByUser: false }
          : item
      )
    );
  }, [selectedVideo]);

  const handleNextSafeVideo = useCallback(() => {
    if (nextSafeCandidate) {
      openVideo(nextSafeCandidate);
    }
  }, [nextSafeCandidate, openVideo]);

  const handleSelectVideoById = useCallback(
    (videoId: string) => {
      const found =
        videos.find((v) => v.id === videoId) ??
        FALLBACK_VIDEOS.find((v) => v.id === videoId);
      if (found) {
        openVideo(found);
      }
    },
    [videos, openVideo]
  );

  const blockedCount = useMemo(
    () => logs.filter((l) => l.blocked).length,
    [logs]
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#ffffff] text-[#0f172a]">
      {/* Sticky Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#ffffff]/95 backdrop-blur-xs border-b border-[#e2e8f0]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Left: Clean Brand Logo */}
          <button
            type="button"
            onClick={() => {
              goToFeed();
              setCategory("all");
              setSearchInput("");
              setActiveQuery("");
            }}
            className="flex items-center gap-2.5 shrink-0 cursor-pointer"
          >
            <span className="w-8 h-8 rounded-lg bg-[#0f172a] text-[#ffffff] flex items-center justify-center">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M12 2.5L4.5 5.8V11.5C4.5 16.4 7.7 20.9 12 22.3C16.3 20.9 19.5 16.4 19.5 11.5V5.8L12 2.5Z"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinejoin="round"
                />
                <path
                  d="M10.2 9.1L15.2 12L10.2 14.9V9.1Z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <div className="text-left hidden sm:block">
              <div className="text-sm font-bold tracking-tight text-[#0f172a] leading-none">
                스포가드
              </div>
              <div className="text-[11px] text-[#64748b] mt-0.5 leading-none">
                실시간 유튜브 스포일러 차단
              </div>
            </div>
          </button>

          {/* Center: YouTube Search Bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="flex-1 max-w-xl flex items-center"
          >
            <div className="relative flex-1 flex items-center">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="유튜브 영상 검색 (예: 오징어 게임, 롤드컵, 브이로그)"
                className="w-full h-10 pl-4 pr-9 rounded-l-full border border-[#cbd5e1] bg-[#ffffff] text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:border-[#0f172a]"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  aria-label="검색어 지우기"
                  className="absolute right-2.5 p-1 text-[#64748b] hover:text-[#0f172a] rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="submit"
              aria-label="검색"
              className="h-10 px-4 sm:px-5 rounded-r-full border border-l-0 border-[#cbd5e1] bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#0f172a] flex items-center justify-center transition cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>

          {/* Right: Keyword Rules & Detection Logs Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowKeywordModal(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#e2e8f0] bg-[#ffffff] hover:bg-[#f8fafc] text-xs font-semibold text-[#0f172a] transition cursor-pointer whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#475569]" />
              <span className="hidden md:inline">차단 키워드</span>
              <span className="rounded-full bg-[#f1f5f9] border border-[#e2e8f0] px-1.5 py-0.2 text-[11px] font-bold text-[#0f172a] tabular-nums">
                {activeKeywords.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowLogModal(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#e2e8f0] bg-[#ffffff] hover:bg-[#f8fafc] text-xs font-semibold text-[#0f172a] transition cursor-pointer whitespace-nowrap"
            >
              <ClipboardList className="w-3.5 h-3.5 text-[#475569]" />
              <span className="hidden md:inline">탐지 기록</span>
              <span className="rounded-full bg-[#f1f5f9] border border-[#e2e8f0] px-1.5 py-0.2 text-[11px] font-bold text-[#0f172a] tabular-nums">
                {logs.length}
              </span>
              {blockedCount > 0 && (
                <span className="hidden sm:inline rounded-full bg-[#fef2f2] border border-[#fecaca] px-1.5 py-0.2 text-[10px] font-bold text-[#b91c1c] tabular-nums">
                  차단 {blockedCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5 space-y-5">
        {!selectedVideo ? (
          <>
            {/* Category Bar + Subtle Engine Indicator */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {(Object.keys(CATEGORY_LABELS) as VideoCategory[]).map(
                  (catKey) => {
                    const active = category === catKey;
                    return (
                      <button
                        key={catKey}
                        type="button"
                        onClick={() => setCategory(catKey)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                          active
                            ? "bg-[#0f172a] text-[#ffffff]"
                            : "bg-[#f8fafc] text-[#334155] border border-[#e2e8f0] hover:bg-[#f1f5f9]"
                        }`}
                      >
                        {CATEGORY_LABELS[catKey]}
                      </button>
                    );
                  }
                )}
              </div>

              <div className="flex items-center gap-2 text-[11px] text-[#64748b] tabular-nums">
                {activeQuery && (
                  <span className="text-[#0f172a] font-semibold">
                    &apos;{activeQuery}&apos; 검색 결과 {videos.length}건 ·
                  </span>
                )}
                <span>
                  피드:{" "}
                  {feedSource === "youtube-api"
                    ? "YouTube API 실시간"
                    : "기본 큐레이션"}
                </span>
                <span>·</span>
                <span>
                  판정:{" "}
                  {lastObservedEngine === "gemini-multimodal"
                    ? "하이브리드 판정 엔진 (Gemini · 로컬)"
                    : lastObservedEngine === "local-fallback"
                    ? apiStatus.hasGeminiKey
                      ? "로컬 정밀 엔진 (Gemini 폴백)"
                      : "로컬 정밀 엔진"
                    : apiStatus.hasGeminiKey
                    ? "하이브리드 판정 엔진 (Gemini · 로컬)"
                    : "로컬 정밀 엔진"}
                </span>
                <span>·</span>
                <span>민감도 {threshold}%</span>
              </div>
            </div>

            {/* Video Grid */}
            <VideoFeedGrid
              videos={videos}
              loading={loadingFeed}
              inspectedMap={inspectedMap}
              onSelectVideo={openVideo}
            />
          </>
        ) : (
          <WatchWorkspace
            video={selectedVideo}
            previousVideo={previousVideo}
            relatedVideos={relatedVideos}
            analysis={analysis}
            analyzing={analyzing}
            overridden={Boolean(overriddenIds[selectedVideo.id])}
            inspectedMap={inspectedMap}
            hasNextSafeVideo={Boolean(nextSafeCandidate)}
            onBackToPrevious={goBackOneVideo}
            onBackToFeed={goToFeed}
            onSelectVideo={openVideo}
            onOverride={handleOverride}
            onRestoreShield={handleRestoreShield}
            onNextSafeVideo={handleNextSafeVideo}
          />
        )}
      </main>

      {/* Quiet Minimal Footer */}
      <footer className="border-t border-[#e2e8f0] bg-[#f8fafc] py-3">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[11px] text-[#64748b]">
          <span>
            4단계 탐지 파이프라인: Stage 1 메타(0.28) · Stage 2 화면 OCR(0.32) · Stage 3 자막 STT(0.28) · Stage 4 문맥·Gemini(+0.26~0.44)
          </span>
          <span>
            {apiStatus.note
              ? apiStatus.note
              : "서버 API 라우트(/api/youtube, /api/analyze)를 통해 안전하게 처리됩니다."}
          </span>
        </div>
      </footer>

      {/* Keyword Settings Modal */}
      <KeywordSettingsModal
        open={showKeywordModal}
        keywords={keywords}
        threshold={threshold}
        onClose={() => setShowKeywordModal(false)}
        onToggleKeyword={handleToggleKeyword}
        onAddKeyword={handleAddKeyword}
        onRemoveKeyword={handleRemoveKeyword}
        onChangeThreshold={setThreshold}
      />

      {/* Detection Logs Modal (opened ONLY via top-right button) */}
      <DetectionLogModal
        open={showLogModal}
        logs={logs}
        threshold={threshold}
        activeKeywordCount={activeKeywords.length}
        onClose={() => setShowLogModal(false)}
        onClearLogs={() => setLogs([])}
        onSelectVideoById={handleSelectVideoById}
      />
    </div>
  );
}
