"use client";

import { Download, FileJson, Trash2, X, ClipboardList } from "lucide-react";
import type { DetectionLogEntry } from "@/types/video";

interface DetectionLogModalProps {
  open: boolean;
  logs: DetectionLogEntry[];
  threshold: number;
  activeKeywordCount: number;
  onClose: () => void;
  onClearLogs: () => void;
  onSelectVideoById: (videoId: string) => void;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeCsvCell(value: string | number | boolean): string {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function DetectionLogModal({
  open,
  logs,
  threshold,
  activeKeywordCount,
  onClose,
  onClearLogs,
  onSelectVideoById,
}: DetectionLogModalProps) {
  if (!open) return null;

  const totalCount = logs.length;
  const blockedCount = logs.filter((l) => l.blocked).length;
  const avgMs =
    totalCount > 0
      ? Math.round(
          logs.reduce((acc, item) => acc + item.durationMs, 0) / totalCount
        )
      : 0;

  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      summary: {
        totalInspected: totalCount,
        blockedCount,
        averageDurationMs: avgMs,
        currentThreshold: threshold,
      },
      logs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    triggerDownload(blob, "spoilerguard-detection-logs.json");
  };

  const handleExportCsv = () => {
    const headers = [
      "시각",
      "영상ID",
      "제목",
      "채널",
      "판정",
      "위험도(%)",
      "임계치(%)",
      "Stage1_메타(%)",
      "Stage2_OCR(%)",
      "Stage3_STT(%)",
      "Stage4_보너스(%)",
      "판정시간(ms)",
      "감지키워드",
      "판단사유",
    ];
    const rows = logs.map((l) => [
      l.timestamp,
      l.videoId,
      l.videoTitle,
      l.channelTitle,
      l.blocked ? (l.overriddenByUser ? "차단(해제됨)" : "차단") : "안전 통과",
      l.riskScore,
      l.threshold,
      l.stage1Score,
      l.stage2Score,
      l.stage3Score,
      l.stage4Bonus,
      l.durationMs,
      l.matchedKeywords.join("|"),
      l.reason,
    ]);
    const csv = [
      headers.map(escapeCsvCell).join(","),
      ...rows.map((r) => r.map(escapeCsvCell).join(",")),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    triggerDownload(blob, "spoilerguard-detection-logs.csv");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="스포일러 탐지 기록"
        className="w-full max-w-5xl max-h-[88vh] flex flex-col rounded-xl border border-[#e2e8f0] bg-[#ffffff] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-[#e2e8f0] bg-[#f8fafc]">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-[#0f172a]" />
            <h2 className="text-sm font-bold text-[#0f172a]">
              실시간 스포일러 탐지 기록
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={logs.length === 0}
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-[#ffffff] hover:bg-[#f1f5f9] disabled:opacity-45 px-3 py-1.5 text-xs font-medium text-[#0f172a] transition cursor-pointer"
            >
              <FileJson className="w-3.5 h-3.5 text-[#475569]" />
              JSON 내보내기
            </button>
            <button
              type="button"
              disabled={logs.length === 0}
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-[#ffffff] hover:bg-[#f1f5f9] disabled:opacity-45 px-3 py-1.5 text-xs font-medium text-[#0f172a] transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#475569]" />
              CSV 내보내기
            </button>
            {logs.length > 0 && (
              <button
                type="button"
                onClick={onClearLogs}
                className="inline-flex items-center gap-1 rounded-lg border border-[#fecaca] bg-[#fef2f2] hover:bg-[#fee2e2] px-2.5 py-1.5 text-xs font-medium text-[#b91c1c] transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                초기화
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="탐지 기록 창 닫기"
              className="p-1 rounded-md text-[#64748b] hover:text-[#0f172a] hover:bg-[#e2e8f0]/60 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="p-5 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
            <div className="text-[11px] text-[#64748b]">총 검사 수</div>
            <div className="text-xl font-bold text-[#0f172a] tabular-nums mt-0.5">
              {totalCount}건
            </div>
          </div>
          <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
            <div className="text-[11px] text-[#64748b]">스포일러 차단 건수</div>
            <div className="text-xl font-bold text-[#dc2626] tabular-nums mt-0.5">
              {blockedCount}건
              <span className="ml-1.5 text-xs font-normal text-[#64748b]">
                ({totalCount > 0 ? Math.round((blockedCount / totalCount) * 100) : 0}%)
              </span>
            </div>
          </div>
          <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
            <div className="text-[11px] text-[#64748b]">평균 판정 시간</div>
            <div className="text-xl font-bold text-[#0f172a] tabular-nums mt-0.5">
              {avgMs} ms
            </div>
          </div>
          <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
            <div className="text-[11px] text-[#64748b]">현재 감시 기준</div>
            <div className="text-xl font-bold text-[#0f172a] tabular-nums mt-0.5">
              {threshold}%
              <span className="ml-1.5 text-xs font-normal text-[#64748b]">
                · 키워드 {activeKeywordCount}개
              </span>
            </div>
          </div>
        </div>

        {/* Clean Stage Average & Block Summary Chart */}
        {(() => {
          const safeCount = Math.max(0, totalCount - blockedCount);
          const blockedPct =
            totalCount > 0 ? Math.round((blockedCount / totalCount) * 100) : 0;
          const safePct = totalCount > 0 ? 100 - blockedPct : 0;
          const avgS1 =
            totalCount > 0
              ? Number(
                  (
                    logs.reduce((acc, r) => acc + r.stage1Score, 0) / totalCount
                  ).toFixed(1)
                )
              : 0;
          const avgS2 =
            totalCount > 0
              ? Number(
                  (
                    logs.reduce((acc, r) => acc + r.stage2Score, 0) / totalCount
                  ).toFixed(1)
                )
              : 0;
          const avgS3 =
            totalCount > 0
              ? Number(
                  (
                    logs.reduce((acc, r) => acc + r.stage3Score, 0) / totalCount
                  ).toFixed(1)
                )
              : 0;
          const avgS4 =
            totalCount > 0
              ? Number(
                  (
                    logs.reduce((acc, r) => acc + r.stage4Bonus, 0) / totalCount
                  ).toFixed(1)
                )
              : 0;

          const stageBars = [
            {
              label: "S1 메타 (최대 28%)",
              avg: avgS1,
              max: 28,
              color: "#334155",
            },
            {
              label: "S2 OCR (최대 32%)",
              avg: avgS2,
              max: 32,
              color: "#475569",
            },
            {
              label: "S3 STT (최대 28%)",
              avg: avgS3,
              max: 28,
              color: "#64748b",
            },
            {
              label: "S4 문맥·AI (보너스)",
              avg: avgS4,
              max: 44,
              color: "#dc2626",
            },
          ];

          return (
            <div className="px-5 pb-4 grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Left: Block Ratio Bar */}
              <div className="md:col-span-5 rounded-lg border border-[#e2e8f0] bg-[#ffffff] p-3.5 flex flex-col justify-between space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#0f172a]">
                    차단 vs 안전 판정 비율
                  </span>
                  <span className="text-[11px] text-[#64748b] tabular-nums">
                    총 {totalCount}건
                  </span>
                </div>

                <div className="w-full h-4 rounded-md bg-[#f1f5f9] overflow-hidden flex border border-[#e2e8f0]">
                  {totalCount > 0 && (
                    <>
                      <div
                        style={{ width: `${blockedPct}%` }}
                        className="h-full bg-[#dc2626] transition-all"
                        title={`차단됨 ${blockedCount}건`}
                      />
                      <div
                        style={{ width: `${safePct}%` }}
                        className="h-full bg-[#16a34a] transition-all"
                        title={`안전 통과 ${safeCount}건`}
                      />
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] tabular-nums">
                  <span className="inline-flex items-center gap-1.5 text-[#334155]">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#dc2626]" />
                    차단됨 <strong className="text-[#0f172a]">{blockedCount}건</strong> ({blockedPct}%)
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[#334155]">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#16a34a]" />
                    안전 통과 <strong className="text-[#0f172a]">{safeCount}건</strong> ({safePct}%)
                  </span>
                </div>
              </div>

              {/* Right: Stage Average Contribution Horizontal Bar Chart */}
              <div className="md:col-span-7 rounded-lg border border-[#e2e8f0] bg-[#ffffff] p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#0f172a]">
                    단계별 평균 위험도 기여 점수
                  </span>
                  <span className="text-[11px] text-[#64748b]">
                    검사 영상 전체 평균 (%p)
                  </span>
                </div>

                <div className="space-y-1.5">
                  {stageBars.map((bar) => {
                    const widthPct = Math.min(
                      100,
                      Math.round((bar.avg / bar.max) * 100)
                    );
                    return (
                      <div
                        key={bar.label}
                        className="grid grid-cols-12 items-center gap-2 text-[11px]"
                      >
                        <span className="col-span-5 sm:col-span-4 text-[#475569] truncate">
                          {bar.label}
                        </span>
                        <div className="col-span-5 sm:col-span-6 h-2.5 rounded-full bg-[#f1f5f9] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${widthPct}%`,
                              backgroundColor: bar.color,
                            }}
                          />
                        </div>
                        <span className="col-span-2 text-right font-mono font-semibold text-[#0f172a] tabular-nums">
                          +{bar.avg}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Log Table */}
        <div className="px-5 pb-5 flex-1 overflow-auto">
          <div className="border border-[#e2e8f0] rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#475569]">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold whitespace-nowrap">시각</th>
                    <th className="py-2.5 px-3 font-semibold">영상 제목</th>
                    <th className="py-2.5 px-3 font-semibold whitespace-nowrap">판정</th>
                    <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">위험도</th>
                    <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">S1(0.28)</th>
                    <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">S2(0.32)</th>
                    <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">S3(0.28)</th>
                    <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">S4(+보너스)</th>
                    <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">속도</th>
                    <th className="py-2.5 px-3 font-semibold">감지 내용 및 사유</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0] bg-[#ffffff]">
                  {logs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="py-10 text-center text-xs text-[#64748b]"
                      >
                        아직 검사된 영상 기록이 없습니다. 피드에서 영상을 재생하면 4단계 탐지 결과가 이곳에 누적됩니다.
                      </td>
                    </tr>
                  ) : (
                    logs.map((row) => (
                      <tr key={row.id} className="hover:bg-[#f8fafc] align-top">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#64748b] whitespace-nowrap">
                          {row.timestamp}
                        </td>
                        <td className="py-2.5 px-3 max-w-[200px]">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectVideoById(row.videoId);
                              onClose();
                            }}
                            className="font-semibold text-[#0f172a] hover:underline text-left line-clamp-2 cursor-pointer"
                          >
                            {row.videoTitle}
                          </button>
                          <div className="text-[11px] text-[#64748b] mt-0.5">
                            {row.channelTitle}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {row.blocked ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]">
                              {row.overriddenByUser ? "차단 (해제)" : "차단됨"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]">
                              안전 통과
                            </span>
                          )}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                            row.blocked ? "text-[#dc2626]" : "text-[#16a34a]"
                          }`}
                        >
                          {row.riskScore}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#334155]">
                          +{row.stage1Score}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#334155]">
                          +{row.stage2Score}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#334155]">
                          +{row.stage3Score}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-[#0f172a]">
                          +{row.stage4Bonus}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#64748b] whitespace-nowrap">
                          {row.durationMs}ms
                        </td>
                        <td className="py-2.5 px-3 min-w-[220px] max-w-[300px] text-[#334155] leading-relaxed">
                          {row.matchedKeywords.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1">
                              {row.matchedKeywords.map((k) => (
                                <span
                                  key={k}
                                  className="px-1.5 py-0.2 rounded bg-[#f1f5f9] border border-[#e2e8f0] text-[10px] font-semibold text-[#0f172a]"
                                >
                                  {k}
                                </span>
                              ))}
                            </div>
                          )}
                          <span>{row.reason}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
