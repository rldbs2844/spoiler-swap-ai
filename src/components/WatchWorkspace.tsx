"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  Home,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import YouTubeGuardPlayer from "@/components/YouTubeGuardPlayer";
import type { AnalyzeResult, YouTubeVideoItem } from "@/types/video";

interface WatchWorkspaceProps {
  video: YouTubeVideoItem;
  previousVideo: YouTubeVideoItem | null;
  relatedVideos: YouTubeVideoItem[];
  analysis: AnalyzeResult | null;
  analyzing: boolean;
  overridden: boolean;
  inspectedMap: Record<string, AnalyzeResult>;
  hasNextSafeVideo: boolean;
  onBackToPrevious: () => void;
  onBackToFeed: () => void;
  onSelectVideo: (video: YouTubeVideoItem) => void;
  onOverride: () => void;
  onRestoreShield: () => void;
  onNextSafeVideo: () => void;
}

export default function WatchWorkspace({
  video,
  previousVideo,
  relatedVideos,
  analysis,
  analyzing,
  overridden,
  inspectedMap,
  hasNextSafeVideo,
  onBackToPrevious,
  onBackToFeed,
  onSelectVideo,
  onOverride,
  onRestoreShield,
  onNextSafeVideo,
}: WatchWorkspaceProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {previousVideo && (
            <button
              type="button"
              onClick={onBackToPrevious}
              title={`이전 영상: ${previousVideo.title}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#0f172a] bg-[#0f172a] hover:bg-[#1e293b] px-3 py-1.5 text-xs font-semibold text-[#ffffff] transition cursor-pointer max-w-[260px] sm:max-w-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                이전 영상 ({previousVideo.title})
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={onBackToFeed}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-[#ffffff] hover:bg-[#f8fafc] px-3 py-1.5 text-xs font-semibold text-[#0f172a] transition cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            홈 피드
          </button>
        </div>

        {analysis && (
          <div className="inline-flex items-center gap-2 text-xs text-[#64748b] tabular-nums">
            <span className="px-2 py-0.5 rounded bg-[#f8fafc] border border-[#e2e8f0] font-medium text-[#334155]">
              {analysis.engineMode === "gemini-multimodal"
                ? `Gemini 멀티모달 (${analysis.modelUsed})`
                : "로컬 정밀 엔진"}
            </span>
            <span>판정 {analysis.durationMs}ms</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Main YouTube Player + Metadata + 4-Stage Pipeline */}
        <div className="lg:col-span-8 space-y-4">
          <YouTubeGuardPlayer
            videoId={video.id}
            analysis={analysis}
            analyzing={analyzing}
            overridden={overridden}
            hasNextSafeVideo={hasNextSafeVideo}
            onOverride={onOverride}
            onNextSafeVideo={onNextSafeVideo}
          />

          {/* Video Header Info */}
          <div className="space-y-2.5 px-0.5">
            <h1 className="text-lg sm:text-xl font-bold text-[#0f172a] leading-snug">
              {video.title}
            </h1>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-center text-xs font-bold text-[#0f172a]">
                  {video.channelInitial}
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#0f172a]">
                    {video.channelTitle}
                  </div>
                  <div className="text-xs text-[#64748b]">
                    {video.viewCountLabel} · {video.publishedAtLabel}
                  </div>
                </div>
              </div>

              {analysis && (
                <div className="flex flex-wrap items-center gap-2">
                  {analysis.isSpoiler && overridden ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border bg-[#fffbeb] text-[#b45309] border-[#fde68a]">
                        <Shield className="w-3.5 h-3.5" />
                        가림막 해제됨 (사용자 허용 · {analysis.riskScore}%)
                      </span>
                      <button
                        type="button"
                        onClick={onRestoreShield}
                        className="inline-flex items-center gap-1 rounded-full border border-[#0f172a] bg-[#0f172a] hover:bg-[#1e293b] px-3 py-1 text-xs font-semibold text-[#ffffff] transition cursor-pointer"
                      >
                        다시 가림막 씌우기
                      </button>
                    </>
                  ) : (
                    <div
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${
                        analysis.isSpoiler
                          ? "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]"
                          : "bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]"
                      }`}
                    >
                      {analysis.isSpoiler ? (
                        <ShieldAlert className="w-3.5 h-3.5" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5" />
                      )}
                      {analysis.isSpoiler
                        ? `차단 기준 초과 (${analysis.riskScore}% / ${analysis.threshold}%)`
                        : `안전 통과 (${analysis.riskScore}% / ${analysis.threshold}%)`}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 4-Stage Pipeline Inspection Card */}
          <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#0f172a]">
                실시간 4단계 스포일러 탐지 분석 결과
                {analysis ? ` (합산 위험도 ${analysis.riskScore}%)` : ""}
              </span>
              <button
                type="button"
                onClick={() => setShowDetails((v) => !v)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#475569] hover:text-[#0f172a] cursor-pointer"
              >
                {showDetails ? "설명·단서 접기" : "설명·단서 자세히 보기"}
                {showDetails ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {analyzing || !analysis ? (
              <div className="py-4 text-xs text-[#64748b]">
                제목·태그·화면 텍스트(OCR)·음성 자막(STT) 및 문맥을 분석하고 있습니다...
              </div>
            ) : (
              <>
                <p className="text-xs text-[#334155] leading-relaxed bg-[#ffffff] border border-[#e2e8f0] rounded-lg px-3 py-2.5">
                  <strong className="text-[#0f172a]">판정 요약: </strong>
                  {analysis.reason}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  <div className="rounded-lg border border-[#e2e8f0] bg-[#ffffff] p-2.5 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-[#475569]">
                        Stage 1 메타
                      </span>
                      <span className="font-mono text-[#64748b]">×0.28</span>
                    </div>
                    <div className="text-base font-bold text-[#0f172a] tabular-nums">
                      +{Math.round(analysis.stages.stage1Meta.weighted * 100)}%
                    </div>
                    <div className="text-[11px] text-[#64748b] leading-snug">
                      {analysis.stages.stage1Meta.summary}
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#e2e8f0] bg-[#ffffff] p-2.5 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-[#475569]">
                        Stage 2 화면 OCR
                      </span>
                      <span className="font-mono text-[#64748b]">×0.32</span>
                    </div>
                    <div className="text-base font-bold text-[#0f172a] tabular-nums">
                      +{Math.round(analysis.stages.stage2Ocr.weighted * 100)}%
                    </div>
                    <div className="text-[11px] text-[#64748b] leading-snug">
                      {analysis.stages.stage2Ocr.summary}
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#e2e8f0] bg-[#ffffff] p-2.5 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-[#475569]">
                        Stage 3 음성 STT
                      </span>
                      <span className="font-mono text-[#64748b]">×0.28</span>
                    </div>
                    <div className="text-base font-bold text-[#0f172a] tabular-nums">
                      +{Math.round(analysis.stages.stage3Stt.weighted * 100)}%
                    </div>
                    <div className="text-[11px] text-[#64748b] leading-snug">
                      {analysis.stages.stage3Stt.summary}
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#e2e8f0] bg-[#ffffff] p-2.5 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-[#475569]">
                        Stage 4 문맥·AI
                      </span>
                      <span className="font-mono text-[#64748b]">
                        +0.26~0.44
                      </span>
                    </div>
                    <div
                      className={`text-base font-bold tabular-nums ${
                        analysis.stages.stage4Fusion.bonus > 0
                          ? "text-[#dc2626]"
                          : "text-[#16a34a]"
                      }`}
                    >
                      +{Math.round(analysis.stages.stage4Fusion.bonus * 100)}%
                    </div>
                    <div className="text-[11px] text-[#64748b] leading-snug">
                      {analysis.stages.stage4Fusion.summary}
                    </div>
                  </div>
                </div>

                {showDetails && (
                  <div className="rounded-lg border border-[#e2e8f0] bg-[#ffffff] p-3 text-xs text-[#475569] space-y-2">
                    <div>
                      <span className="font-semibold text-[#0f172a]">
                        엔진 상태:{" "}
                      </span>
                      {analysis.stages.stage4Fusion.geminiUsed
                        ? `Gemini 멀티모달 정상 동작 (${analysis.stages.stage4Fusion.geminiModel})`
                        : analysis.stages.stage4Fusion.geminiError
                        ? `로컬 폴백 (${analysis.stages.stage4Fusion.geminiError})`
                        : "로컬 4단계 정밀 엔진"}
                    </div>
                    <div>
                      <span className="font-semibold text-[#0f172a]">
                        영상 설명:{" "}
                      </span>
                      {video.description || "설명 없음"}
                    </div>
                    <div>
                      <span className="font-semibold text-[#0f172a]">
                        Stage 2 검사 텍스트:{" "}
                      </span>
                      {analysis.stages.stage2Ocr.textChecked}
                    </div>
                    <div>
                      <span className="font-semibold text-[#0f172a]">
                        Stage 3 자막·대본:{" "}
                      </span>
                      {analysis.stages.stage3Stt.textChecked}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right: Related Videos List */}
        <aside className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-sm font-bold text-[#0f172a]">관련 영상</h2>
            <span className="text-[11px] text-[#64748b]">
              클릭 시 즉시 보호 검사
            </span>
          </div>

          <div className="space-y-2.5">
            {relatedVideos.map((item) => {
              const inspected = inspectedMap[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectVideo(item)}
                  className="w-full flex gap-2.5 text-left rounded-lg p-1.5 hover:bg-[#f8fafc] transition cursor-pointer group"
                >
                  <div className="relative w-40 aspect-video rounded-lg overflow-hidden bg-[#f1f5f9] border border-[#e2e8f0] shrink-0">
                    <Image
                      src={item.thumbnailUrl}
                      alt={item.title}
                      fill
                      unoptimized
                      sizes="160px"
                      className="object-cover"
                    />
                    {inspected && (
                      <span
                        className={`absolute top-1.5 left-1.5 rounded px-1 py-0.5 text-[10px] font-semibold ${
                          inspected.isSpoiler
                            ? "bg-[#dc2626]/90 text-[#ffffff]"
                            : "bg-[#0f172a]/75 text-[#ffffff]"
                        }`}
                      >
                        {inspected.isSpoiler ? "차단" : "안전"}
                      </span>
                    )}
                    <span className="absolute bottom-1.5 right-1.5 rounded bg-[#0f172a]/85 px-1 py-0.5 text-[10px] font-semibold text-[#ffffff] tabular-nums">
                      {item.duration}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 space-y-1 py-0.5">
                    <h3 className="text-xs font-semibold text-[#0f172a] line-clamp-2 leading-snug group-hover:text-[#334155]">
                      {item.title}
                    </h3>
                    <div className="text-[11px] text-[#64748b] truncate">
                      {item.channelTitle}
                    </div>
                    <div className="text-[11px] text-[#64748b] truncate">
                      {item.viewCountLabel} · {item.publishedAtLabel}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
