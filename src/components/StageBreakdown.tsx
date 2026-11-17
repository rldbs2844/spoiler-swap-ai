'use client';

import React, { useState } from 'react';
import type { EvaluationResult } from '@/lib/types';

interface StageBreakdownProps {
  result: EvaluationResult;
  onCopyJson: () => void;
}

export default function StageBreakdown({ result, onCopyJson }: StageBreakdownProps) {
  const [showJson, setShowJson] = useState(false);
  const isSpoiler = result.action === 'SWAP_TO_CAT_MEME';

  const stages = [
    {
      key: 'S1',
      name: 'Stage 1 · 메타데이터',
      desc: '제목 · 해시태그 · 채널 선제 스캔',
      score: result.stages.stage1_metadata.score,
      ms: result.stages.stage1_metadata.latency_ms,
      tags: [
        ...result.stages.stage1_metadata.entities,
        ...result.stages.stage1_metadata.triggers
      ]
    },
    {
      key: 'S2',
      name: 'Stage 2 · 온디바이스 OCR',
      desc: '화면 자막 · 썸네일 텍스트 추출',
      score: result.stages.stage2_on_device_ocr.score,
      ms: result.stages.stage2_on_device_ocr.latency_ms,
      tags: result.stages.stage2_on_device_ocr.triggers
    },
    {
      key: 'S3',
      name: 'Stage 3 · 경량 STT',
      desc: '초반 2초 음성 및 유튜브 자막 분석',
      score: result.stages.stage3_lightweight_stt.score,
      ms: result.stages.stage3_lightweight_stt.latency_ms,
      tags: result.stages.stage3_lightweight_stt.triggers
    },
    {
      key: 'S4',
      name: 'Stage 4 · KG + AI 문맥 융합',
      desc:
        result.ai_analysis?.provider === 'gemini-2.5-flash'
          ? 'Gemini 2.5 Flash 멀티모달 결합'
          : result.ai_analysis?.provider === 'gemini-2.0-flash'
            ? 'Gemini 2.0 Flash 멀티모달 결합'
            : result.ai_analysis?.provider === 'gpt-4o-mini'
              ? 'OpenAI GPT-4o-mini 문맥 결합'
              : 'Knowledge Graph + KoELECTRA 가중치',
      score: result.stages.stage4_kg_koelectra.score,
      ms: result.stages.stage4_kg_koelectra.latency_ms,
      tags: []
    }
  ];

  const ai = result.ai_analysis;

  return (
    <div className="rounded-2xl bg-slate-900/75 border border-slate-800 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <span>🧠 4단계 멀티모달 판정 결과</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                isSpoiler
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}
            >
              {result.action}
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            종합 스포일러 확률{' '}
            <strong className="text-white mono">{(result.confidence_score * 100).toFixed(0)}%</strong>{' '}
            (임계치 {(result.threshold * 100).toFixed(0)}%) · 총 지연시간{' '}
            <strong className="text-cyan-300 mono">{result.latency_ms} ms</strong>
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowJson((v) => !v)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition cursor-pointer"
          >
            {showJson ? '카드 보기' : '{ } JSON'}
          </button>
          <button
            type="button"
            onClick={onCopyJson}
            className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-300 text-xs font-medium border border-indigo-500/40 transition cursor-pointer"
          >
            📋 JSON 복사
          </button>
        </div>
      </div>

      {/* AI Reasoning Box */}
      {ai && (
        <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5">
              ✨ AI 판단 근거
              <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-[10px] mono">
                {ai.provider}
              </span>
              {ai.multimodal_used && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">
                  썸네일 이미지 분석 포함
                </span>
              )}
              {ai.fallbackReason && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] mono">
                  {ai.fallbackReason}
                </span>
              )}
            </span>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed">{ai.reasoning}</p>
        </div>
      )}

      {showJson ? (
        <pre className="mono text-[11px] leading-relaxed p-3 rounded-xl bg-slate-950 border border-slate-800 text-emerald-300 overflow-x-auto max-h-[340px]">
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {stages.map((st) => {
            const pct = Math.min(100, Math.round(st.score * 100));
            return (
              <div
                key={st.key}
                className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-100">{st.name}</span>
                  <span className="mono text-[11px] text-slate-400">{st.ms} ms</span>
                </div>
                <p className="text-[11px] text-slate-400">{st.desc}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        pct >= 65 ? 'bg-rose-500' : pct >= 35 ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="mono text-[11px] font-bold text-slate-200 w-9 text-right">
                    {st.score.toFixed(2)}
                  </span>
                </div>
                {st.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {st.tags.slice(0, 5).map((tag, i) => (
                      <span
                        key={`${st.key}-${tag}-${i}`}
                        className="px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-[10px] text-rose-300"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
