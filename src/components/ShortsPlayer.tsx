'use client';

import React from 'react';
import { getCatMemeById } from '@/lib/detector';
import type { EvaluationResult, ShortItem } from '@/lib/types';

interface ShortsPlayerProps {
  shortItem: ShortItem;
  result: EvaluationResult;
  isSwappedView: boolean;
  isScanningFlash: boolean;
  isFinalized: boolean;
  forceOriginal: boolean;
  stagePhase: 'init' | 'ocr' | 'stt' | 'done';
  progressPct: number;
  elapsedSec: number;
  onToggleForceOriginal: () => void;
  onRescan: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  showNav?: boolean;
}

export default function ShortsPlayer({
  shortItem,
  result,
  isSwappedView,
  isScanningFlash,
  isFinalized,
  forceOriginal,
  stagePhase,
  progressPct,
  elapsedSec,
  onToggleForceOriginal,
  onRescan,
  onPrev,
  onNext,
  showNav = false
}: ShortsPlayerProps) {
  const isSpoiler = result.action === 'SWAP_TO_CAT_MEME';
  const catMeme = getCatMemeById(result.swap_asset?.asset_id);

  const stageLabel =
    stagePhase === 'init'
      ? 'Stage 1 · 메타데이터 스캔 중'
      : stagePhase === 'ocr'
        ? 'Stage 2 · 화면 텍스트(OCR) 분석 중'
        : stagePhase === 'stt'
          ? 'Stage 3~4 · 음성/AI 문맥 판정 중'
          : isSpoiler
            ? '스포일러 차단됨 · 고양이 밈 스왑'
            : '안전 콘텐츠 · 정상 재생';

  return (
    <div className="flex flex-col items-center">
      {/* 9:16 Phone Frame */}
      <div className="relative w-full max-w-[340px] aspect-[9/16] rounded-[32px] border-[6px] border-slate-800 bg-slate-950 shadow-2xl shadow-black/70 overflow-hidden select-none">
        {/* Top Notch / Status HUD */}
        <div className="absolute top-0 inset-x-0 z-30 p-3 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/85 border border-slate-700/70 backdrop-blur-md">
            <span
              className={`w-2 h-2 rounded-full ${
                !isFinalized
                  ? 'bg-amber-400 animate-pulse'
                  : isSwappedView
                    ? 'bg-rose-500'
                    : 'bg-emerald-400'
              }`}
            />
            <span className="text-[11px] font-semibold text-slate-100 truncate max-w-[180px]">
              {stageLabel}
            </span>
          </div>
          <span className="mono text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-900/85 border border-slate-700/70 text-indigo-300">
            {(result.confidence_score * 100).toFixed(0)}%
          </span>
        </div>

        {/* Scanning Flash Effect */}
        {isScanningFlash && (
          <div className="absolute inset-0 z-40 bg-rose-500/30 backdrop-blur-[2px] flex flex-col items-center justify-center animate-pulse">
            <div className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-sm shadow-lg">
              🚨 스포일러 감지! 고양이로 긴급 교체 중...
            </div>
          </div>
        )}

        {/* Scanline bar while analyzing */}
        {!isFinalized && !isSwappedView && (
          <div className="pointer-events-none absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent z-30 scan-bar opacity-80" />
        )}

        {/* Main Content: Either Cat Meme Swap OR Real YouTube Iframe / Simulated Short */}
        {isSwappedView ? (
          <div className="relative w-full h-full bg-slate-950 flex flex-col justify-between">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={catMeme.src}
              alt={catMeme.caption}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/60" />

            <div className="relative z-20 mt-14 mx-4 p-3 rounded-2xl bg-rose-500/20 border border-rose-400/40 backdrop-blur-md">
              <div className="flex items-center justify-between text-xs font-bold text-rose-200 mb-1">
                <span>🛡️ SPOILER BLOCKED</span>
                <span className="mono">{result.latency_ms} ms</span>
              </div>
              <p className="text-xs text-slate-100 leading-relaxed">
                탐지 작품:{' '}
                <strong className="text-amber-300">
                  {result.matched_watchlist_entities.join(', ') || '문맥 탐지'}
                </strong>
                {result.matched_spoiler_triggers.length > 0 && (
                  <>
                    {' '}
                    · 단서:{' '}
                    <span className="text-rose-200">
                      {result.matched_spoiler_triggers.slice(0, 3).join(', ')}
                    </span>
                  </>
                )}
              </p>
            </div>

            <div className="relative z-20 p-4 space-y-3">
              <div className="p-3 rounded-2xl bg-slate-900/85 border border-slate-700/80 backdrop-blur-md">
                <p className="text-sm font-bold text-white leading-snug">{catMeme.caption}</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  원본 쇼츠 재생을 즉시 중단하고 로컬 캐시 힐링 밈으로 교체했습니다.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onToggleForceOriginal}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-600/70 transition cursor-pointer"
                >
                  👁️ 원본 강제 보기
                </button>
                <button
                  type="button"
                  onClick={onRescan}
                  className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer"
                >
                  ↻ 재스캔
                </button>
              </div>
            </div>
          </div>
        ) : shortItem.isRealYouTube ? (
          /* Real YouTube Shorts Iframe Player */
          <div className="relative w-full h-full bg-black">
            <iframe
              key={shortItem.id}
              src={`https://www.youtube.com/embed/${encodeURIComponent(shortItem.id)}?autoplay=1&playsinline=1&rel=0&modestbranding=1`}
              title={shortItem.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full border-0"
            />
            {forceOriginal && isSpoiler && (
              <div className="absolute bottom-3 inset-x-3 z-30 flex items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-950/90 border border-amber-500/50 backdrop-blur-md">
                <span className="text-[11px] text-amber-200 font-medium">
                  ⚠️ 스포일러 원본 강제 시청 중
                </span>
                <button
                  type="button"
                  onClick={onToggleForceOriginal}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold transition cursor-pointer"
                >
                  🐱 고양이로 덮기
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Simulated Preset / Custom Short Player */
          <div
            className={`relative w-full h-full bg-gradient-to-br ${
              shortItem.bgGradient || 'from-slate-900 via-indigo-950 to-slate-950'
            } flex flex-col justify-between p-4 pt-14`}
          >
            <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
              <div className="text-6xl mb-3 drop-shadow-lg">{shortItem.emoji || '🎬'}</div>
              {shortItem.ocr && (
                <div className="px-3 py-1.5 rounded-xl bg-black/65 border border-white/15 backdrop-blur-sm text-xs font-bold text-amber-300 shadow-lg max-w-full">
                  [화면 자막] {shortItem.ocr}
                </div>
              )}
            </div>

            <div className="space-y-2.5">
              {shortItem.stt && (
                <div className="p-2.5 rounded-xl bg-black/60 border border-white/10 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="flex items-end gap-0.5 h-3">
                      <span className="w-0.5 bg-cyan-400 rounded-full eq-bar-1" />
                      <span className="w-0.5 bg-cyan-400 rounded-full eq-bar-2" />
                      <span className="w-0.5 bg-cyan-400 rounded-full eq-bar-3" />
                      <span className="w-0.5 bg-cyan-400 rounded-full eq-bar-4" />
                    </div>
                    <span className="text-[10px] font-semibold text-cyan-300">STT 음성 자막</span>
                  </div>
                  <p className="text-xs text-slate-100 leading-relaxed line-clamp-3">
                    &ldquo;{shortItem.stt}&rdquo;
                  </p>
                </div>
              )}

              <div>
                <div className="text-xs font-bold text-indigo-300 mb-0.5">{shortItem.channel}</div>
                <p className="text-xs font-semibold text-white leading-snug line-clamp-2">
                  {shortItem.title}
                </p>
              </div>

              {forceOriginal && isSpoiler && (
                <button
                  type="button"
                  onClick={onToggleForceOriginal}
                  className="w-full py-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer"
                >
                  🐱 다시 고양이 밈으로 덮기
                </button>
              )}
            </div>
          </div>
        )}

        {/* Bottom Progress Bar */}
        <div className="absolute bottom-0 inset-x-0 h-1 bg-slate-800/80 z-30">
          <div
            className={`h-full transition-all duration-100 ${
              isSwappedView ? 'bg-rose-500' : 'bg-indigo-400'
            }`}
            style={{ width: `${isFinalized ? 100 : progressPct}%` }}
          />
        </div>
      </div>

      {/* Controls below phone frame */}
      <div className="mt-3 w-full max-w-[340px] flex items-center justify-between gap-2">
        {showNav ? (
          <button
            type="button"
            onClick={onPrev}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
          >
            ◀ 이전
          </button>
        ) : (
          <span className="text-[11px] text-slate-400 mono">
            {isFinalized ? `완료 (${result.latency_ms}ms)` : `${elapsedSec.toFixed(1)}s 스캔 중`}
          </span>
        )}

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onRescan}
            className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-300 text-xs font-semibold border border-indigo-500/40 transition cursor-pointer"
          >
            ⚡ 0초부터 재스캔
          </button>
          {shortItem.sourceUrl && (
            <a
              href={shortItem.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
            >
              YouTube ↗
            </a>
          )}
        </div>

        {showNav && (
          <button
            type="button"
            onClick={onNext}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
          >
            다음 ▶
          </button>
        )}
      </div>
    </div>
  );
}
