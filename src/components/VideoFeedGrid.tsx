"use client";

import Image from "next/image";
import type { AnalyzeResult, YouTubeVideoItem } from "@/types/video";

interface VideoFeedGridProps {
  videos: YouTubeVideoItem[];
  loading: boolean;
  inspectedMap: Record<string, AnalyzeResult>;
  onSelectVideo: (video: YouTubeVideoItem) => void;
}

export default function VideoFeedGrid({
  videos,
  loading,
  inspectedMap,
  onSelectVideo,
}: VideoFeedGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-7">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div key={idx} className="space-y-2.5 animate-pulse">
            <div className="aspect-video w-full rounded-xl bg-[#f1f5f9]" />
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-full bg-[#f1f5f9] shrink-0" />
              <div className="flex-1 space-y-2 py-0.5">
                <div className="h-3.5 bg-[#f1f5f9] rounded w-11/12" />
                <div className="h-3 bg-[#f1f5f9] rounded w-2/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] py-16 px-4 text-center space-y-2">
        <p className="text-sm font-semibold text-[#0f172a]">
          검색 조건에 맞는 영상이 없습니다.
        </p>
        <p className="text-xs text-[#64748b]">
          다른 검색어를 입력하거나 상단 카테고리를 &apos;전체&apos;로 전환해 보세요.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-7">
      {videos.map((video) => {
        const inspected = inspectedMap[video.id];
        return (
          <button
            key={video.id}
            type="button"
            onClick={() => onSelectVideo(video)}
            className="group text-left flex flex-col gap-2.5 cursor-pointer focus:outline-none"
          >
            {/* 16:9 Thumbnail */}
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-[#f1f5f9] border border-[#e2e8f0]/80">
              <Image
                src={video.thumbnailUrl}
                alt={video.title}
                fill
                unoptimized
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
              />

              {/* Subtle status badge shown only if already inspected in current session */}
              {inspected && (
                <span
                  className={`absolute top-2 left-2 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-tight ${
                    inspected.isSpoiler
                      ? "bg-[#dc2626]/90 text-[#ffffff]"
                      : "bg-[#0f172a]/75 text-[#ffffff]"
                  }`}
                >
                  {inspected.isSpoiler
                    ? `차단됨 ${inspected.riskScore}%`
                    : "검사 안전"}
                </span>
              )}

              {/* YouTube-style duration pill */}
              <span className="absolute bottom-2 right-2 rounded bg-[#0f172a]/85 px-1.5 py-0.5 text-[11px] font-semibold text-[#ffffff] tabular-nums">
                {video.duration}
              </span>
            </div>

            {/* Metadata row */}
            <div className="flex gap-3 items-start px-0.5">
              <div className="w-9 h-9 rounded-full bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-center text-xs font-bold text-[#334155] shrink-0 mt-0.5">
                {video.channelInitial}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="text-[14px] font-semibold leading-snug text-[#0f172a] line-clamp-2 group-hover:text-[#334155]">
                  {video.title}
                </h3>
                <div className="text-xs text-[#64748b] space-y-0.5">
                  <div className="truncate">{video.channelTitle}</div>
                  <div className="truncate">
                    {video.viewCountLabel} · {video.publishedAtLabel}
                  </div>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
