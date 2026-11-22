"use client";

import { useRef, useState } from "react";
import { Upload, Download, RotateCcw } from "lucide-react";
import InversionCharts from "@/components/InversionCharts";
import type { InversionPair, StationSummary } from "@/lib/csvParser";
import type { RegressionModelMetrics } from "@/lib/inversionModel";

interface DataAnalysisTabProps {
  fileName: string;
  isSample: boolean;
  encodingInfo: string;
  totalRows: number;
  stationSummaries: StationSummary[];
  inversionPairs: InversionPair[];
  allPairs: InversionPair[];
  modelMetrics: RegressionModelMetrics;
  uploadError: string | null;
  onUploadFile: (file: File) => void;
  onDownloadSample: () => void;
  onResetSample: () => void;
}

export default function DataAnalysisTab({
  fileName,
  isSample,
  encodingInfo,
  totalRows,
  stationSummaries,
  inversionPairs,
  allPairs,
  modelMetrics,
  uploadError,
  onUploadFile,
  onDownloadSample,
  onResetSample,
}: DataAnalysisTabProps) {
  const [onlyInversion, setOnlyInversion] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const invStations = stationSummaries.filter((s) => s.isInversion);
  const maxDeltaStation = [...stationSummaries].sort((a, b) => b.diff - a.diff)[0];
  const tableRows = onlyInversion ? inversionPairs : allPairs;

  return (
    <div className="space-y-5">
      {/* CSV Upload & Control Panel */}
      <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-lg p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-[#0f172a]">
              분석 데이터셋: {fileName}
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-medium border border-[#e2e8f0] bg-[#f8fafc] text-[#475569]">
              {encodingInfo} · 유효 {totalRows.toLocaleString()}행
            </span>
          </div>
          <p className="text-xs text-[#64748b]">
            시간대별 대기오염 data.csv 파일을 업로드하면 UTF-8 / EUC-KR 인코딩을 자동 판별하여 코스 지도, 역전 회귀 모델, 차트를 즉시 갱신합니다.
          </p>
          {uploadError && (
            <p className="text-xs font-medium text-[#dc2626]">{uploadError}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUploadFile(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#0f172a] hover:bg-[#1e293b] text-[#ffffff] text-xs font-semibold transition"
          >
            <Upload className="w-3.5 h-3.5" />
            data.csv 업로드
          </button>

          <button
            type="button"
            onClick={onDownloadSample}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#e2e8f0] bg-[#ffffff] hover:bg-[#f8fafc] text-[#0f172a] text-xs font-medium transition"
          >
            <Download className="w-3.5 h-3.5 text-[#475569]" />
            샘플 data.csv 다운로드
          </button>

          {!isSample && (
            <button
              type="button"
              onClick={onResetSample}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#e2e8f0] bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#475569] text-xs font-medium transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              기본 샘플 복원
            </button>
          )}
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-lg p-3.5 space-y-1">
          <div className="text-xs text-[#64748b]">역전 위험 측정소 (14시 &lt; 22시)</div>
          <div className="text-xl font-bold text-[#dc2626] tabular-nums">
            {invStations.length}곳
            <span className="text-xs font-normal text-[#64748b] ml-1.5">
              / 전체 {stationSummaries.length}곳
            </span>
          </div>
          <div className="text-xs text-[#475569] truncate">
            {invStations.length
              ? invStations.map((s) => s.station).join(", ")
              : "없음"}
          </div>
        </div>

        <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-lg p-3.5 space-y-1">
          <div className="text-xs text-[#64748b]">일별 역전 발생 건수</div>
          <div className="text-xl font-bold text-[#0f172a] tabular-nums">
            {inversionPairs.length}건
            <span className="text-xs font-normal text-[#64748b] ml-1.5">
              ({allPairs.length ? Math.round((inversionPairs.length / allPairs.length) * 100) : 0}%)
            </span>
          </div>
          <div className="text-xs text-[#475569]">전체 일자·측정소 조합 기준</div>
        </div>

        <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-lg p-3.5 space-y-1">
          <div className="text-xs text-[#64748b]">최대 역전 상승폭 (22시-14시)</div>
          <div className="text-xl font-bold text-[#dc2626] tabular-nums">
            {maxDeltaStation
              ? `${maxDeltaStation.diff >= 0 ? "+" : ""}${maxDeltaStation.diff.toFixed(1)}`
              : "-"}{" "}
            <span className="text-xs font-normal text-[#64748b]">㎍/㎥</span>
          </div>
          <div className="text-xs text-[#475569]">
            {maxDeltaStation
              ? `${maxDeltaStation.station} (14시 ${maxDeltaStation.pm14.toFixed(1)} → 22시 ${maxDeltaStation.pm22.toFixed(1)})`
              : "-"}
          </div>
        </div>

        <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-lg p-3.5 space-y-1">
          <div className="text-xs text-[#64748b]">역전 예측 다중회귀 모델</div>
          <div className="text-xl font-bold text-[#0f172a] tabular-nums">
            R² {modelMetrics.rSquared.toFixed(2)}
            <span className="text-xs font-normal text-[#64748b] ml-1.5">
              (MAE {modelMetrics.mae.toFixed(1)} ㎍/㎥)
            </span>
          </div>
          <div className="text-xs text-[#475569] truncate">
            표본 {modelMetrics.sampleCount}건 기반 실시간 학습 완료
          </div>
        </div>
      </div>

      {/* Fitted Regression Weights Strip */}
      <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
        <div className="font-semibold text-[#0f172a]">
          학습된 22시 PM2.5 예측식 (Ridge 다중선형회귀)
        </div>
        <div className="font-mono text-[11px] text-[#334155] tabular-nums">
          PM2.5(22시) = {modelMetrics.weights.intercept} + ({modelMetrics.weights.pm14})×PM14 + ({modelMetrics.weights.afternoonSlope})×오후기울기 + ({modelMetrics.weights.windEvening})×풍속 + ({modelMetrics.weights.tempDrop})×기온하강폭
        </div>
      </div>

      {/* Charts Section */}
      <InversionCharts
        stationSummaries={stationSummaries}
        inversionPairs={inversionPairs}
        fileName={fileName}
      />

      {/* Extraction Table: 14시 평균 < 22시 평균 */}
      <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-[#0f172a]">
              역전 발생 측정소 및 날짜 추출 표 (14시 &lt; 22시)
            </h3>
            <p className="text-xs text-[#64748b]">
              낮 14시 대비 밤 22시 초미세먼지 농도가 상승한 측정소와 날짜 목록입니다.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-[#334155] cursor-pointer">
            <input
              type="checkbox"
              checked={onlyInversion}
              onChange={(e) => setOnlyInversion(e.target.checked)}
              className="accent-[#0f172a]"
            />
            역전 발생 건만 보기 ({inversionPairs.length}건)
          </label>
        </div>

        <div className="overflow-x-auto max-h-80 overflow-y-auto border border-[#e2e8f0] rounded-md">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-[#f8fafc] border-b border-[#e2e8f0] text-[#475569]">
              <tr>
                <th className="py-2.5 px-3 font-semibold">날짜</th>
                <th className="py-2.5 px-3 font-semibold">측정소</th>
                <th className="py-2.5 px-3 font-semibold text-right">낮 14시 (㎍/㎥)</th>
                <th className="py-2.5 px-3 font-semibold text-right">밤 22시 (㎍/㎥)</th>
                <th className="py-2.5 px-3 font-semibold text-right">역전 상승폭 (Δ)</th>
                <th className="py-2.5 px-3 font-semibold text-right">22시 풍속</th>
                <th className="py-2.5 px-3 font-semibold">판정</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0] bg-[#ffffff]">
              {tableRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-6 text-center text-[#64748b]"
                  >
                    조건에 해당하는 측정 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                tableRows.map((row) => {
                  const isHigh = row.isInversion && row.diff >= 5;
                  return (
                    <tr
                      key={`${row.date}-${row.station}`}
                      className="hover:bg-[#f8fafc]"
                    >
                      <td className="py-2 px-3 font-mono tabular-nums text-[#334155]">
                        {row.date}
                      </td>
                      <td className="py-2 px-3 font-semibold text-[#0f172a]">
                        {row.station}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-[#334155]">
                        {row.pm14.toFixed(1)}
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-mono tabular-nums font-semibold ${
                          row.isInversion ? "text-[#dc2626]" : "text-[#16a34a]"
                        }`}
                      >
                        {row.pm22.toFixed(1)}
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-mono tabular-nums font-semibold ${
                          row.diff > 0 ? "text-[#dc2626]" : "text-[#16a34a]"
                        }`}
                      >
                        {row.diff >= 0 ? "+" : ""}
                        {row.diff.toFixed(1)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-[#64748b]">
                        {row.wind22 !== null ? `${row.wind22.toFixed(1)} m/s` : "-"}
                      </td>
                      <td className="py-2 px-3">
                        {isHigh ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#dc2626]" />
                            역전 정체 위험
                          </span>
                        ) : row.isInversion ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#fffbeb] text-[#b45309] border border-[#fde68a]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#d97706]" />
                            역전 주의
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
                            안전
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
