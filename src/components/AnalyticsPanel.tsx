'use client';

import React from 'react';
import type { ScanLogEntry } from '@/lib/types';

interface AnalyticsPanelProps {
  stats: {
    scanned: number;
    blocked: number;
    totalLatency: number;
    carbonSaved: number;
  };
  logs: ScanLogEntry[];
  logFilter: 'all' | 'SWAP_TO_CAT_MEME' | 'PASS';
  onFilterChange: (f: 'all' | 'SWAP_TO_CAT_MEME' | 'PASS') => void;
  onExportJson: () => void;
  onExportMarkdown: () => void;
  onExportCsv: () => void;
  onClearLogs: () => void;
}

export default function AnalyticsPanel({
  stats,
  logs,
  logFilter,
  onFilterChange,
  onExportJson,
  onExportMarkdown,
  onExportCsv,
  onClearLogs
}: AnalyticsPanelProps) {
  const avgMs = stats.scanned > 0 ? Math.round(stats.totalLatency / stats.scanned) : 0;
  const blockRate = stats.scanned > 0 ? ((stats.blocked / stats.scanned) * 100).toFixed(1) : '0.0';

  const filteredLogs = logs.filter((entry) => {
    if (logFilter === 'all') return true;
    return entry.result.action === logFilter;
  });

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-900/75 border border-slate-800">
          <div className="text-[11px] text-slate-400 font-medium">누적 스캔 쇼츠</div>
          <div className="text-xl font-extrabold text-white mt-1 mono">{stats.scanned}편</div>
        </div>
        <div className="p-3.5 rounded-2xl bg-slate-900/75 border border-slate-800">
          <div className="text-[11px] text-slate-400 font-medium">스포일러 차단 · 밈 스왑</div>
          <div className="text-xl font-extrabold text-rose-400 mt-1 mono">
            {stats.blocked}건 <span className="text-xs text-slate-400">({blockRate}%)</span>
          </div>
        </div>
        <div className="p-3.5 rounded-2xl bg-slate-900/75 border border-slate-800">
          <div className="text-[11px] text-slate-400 font-medium">평균 판정 응답 속도</div>
          <div className="text-xl font-extrabold text-cyan-300 mt-1 mono">{avgMs} ms</div>
        </div>
        <div className="p-3.5 rounded-2xl bg-slate-900/75 border border-slate-800">
          <div className="text-[11px] text-slate-400 font-medium">온디바이스 탄소 절감</div>
          <div className="text-xl font-extrabold text-emerald-400 mt-1 mono">
            {stats.carbonSaved.toFixed(2)} g
          </div>
        </div>
      </div>

      {/* Audit Log & Export */}
      <div className="rounded-2xl bg-slate-900/75 border border-slate-800 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white">📜 실시간 탐지 감사 로그</h3>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              {(['all', 'SWAP_TO_CAT_MEME', 'PASS'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => onFilterChange(f)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                    logFilter === f
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f === 'all' ? '전체' : f === 'SWAP_TO_CAT_MEME' ? '차단됨' : '통과됨'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={onExportJson}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition cursor-pointer"
            >
              ⬇ JSON
            </button>
            <button
              type="button"
              onClick={onExportMarkdown}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition cursor-pointer"
            >
              ⬇ Markdown
            </button>
            <button
              type="button"
              onClick={onExportCsv}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition cursor-pointer"
            >
              ⬇ CSV
            </button>
            {logs.length > 0 && (
              <button
                type="button"
                onClick={onClearLogs}
                className="px-2 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 text-xs font-medium border border-rose-800/60 transition cursor-pointer"
              >
                초기화
              </button>
            )}
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            아직 기록된 스캔 로그가 없습니다. 상단에서 쇼츠를 검색하거나 URL을 검사해 보세요.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[260px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 px-2">#</th>
                  <th className="py-2 px-2">시각</th>
                  <th className="py-2 px-2">영상 제목</th>
                  <th className="py-2 px-2">판정</th>
                  <th className="py-2 px-2">점수</th>
                  <th className="py-2 px-2">지연</th>
                  <th className="py-2 px-2">탐지 키워드</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredLogs.map((entry) => {
                  const isSwap = entry.result.action === 'SWAP_TO_CAT_MEME';
                  const cues = [
                    ...entry.result.matched_watchlist_entities,
                    ...entry.result.matched_spoiler_triggers
                  ];
                  return (
                    <tr key={`${entry.seq}-${entry.isoTime}`} className="hover:bg-slate-800/35">
                      <td className="py-2 px-2 mono text-slate-500">{entry.seq}</td>
                      <td className="py-2 px-2 mono text-slate-400">{entry.timestamp}</td>
                      <td className="py-2 px-2 text-slate-200 max-w-[220px] truncate">
                        {entry.title}
                      </td>
                      <td className="py-2 px-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isSwap
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {isSwap ? '🐱 SWAP' : '✅ PASS'}
                        </span>
                      </td>
                      <td className="py-2 px-2 mono font-bold text-slate-200">
                        {entry.result.confidence_score.toFixed(2)}
                      </td>
                      <td className="py-2 px-2 mono text-cyan-300">{entry.result.latency_ms}ms</td>
                      <td className="py-2 px-2 text-slate-400 max-w-[180px] truncate">
                        {cues.join(', ') || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
