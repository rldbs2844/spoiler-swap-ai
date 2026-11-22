"use client";

import { useRef, useState } from "react";
import { Download, FileJson } from "lucide-react";
import type { InversionPair, StationSummary } from "@/lib/csvParser";

interface InversionChartsProps {
  stationSummaries: StationSummary[];
  inversionPairs: InversionPair[];
  fileName: string;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadSvgAsPng(svgEl: SVGSVGElement | null, filename: string) {
  if (!svgEl) return;
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  const vb = svgEl.viewBox.baseVal;
  const width = vb && vb.width ? vb.width : 560;
  const height = vb && vb.height ? vb.height : 300;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  const xml = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();

  img.onload = () => {
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((pngBlob) => {
        if (pngBlob) {
          triggerBlobDownload(pngBlob, filename);
        } else {
          const pngUrl = canvas.toDataURL("image/png");
          const a = document.createElement("a");
          a.href = pngUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
      }, "image/png");
    }
    URL.revokeObjectURL(url);
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

export default function InversionCharts({
  stationSummaries,
  inversionPairs,
  fileName,
}: InversionChartsProps) {
  const [focusedStation, setFocusedStation] = useState<string>(
    stationSummaries[0]?.station ?? ""
  );
  const trendSvgRef = useRef<SVGSVGElement | null>(null);
  const barSvgRef = useRef<SVGSVGElement | null>(null);

  const activeStation =
    stationSummaries.find((s) => s.station === focusedStation) ??
    stationSummaries[0];

  const handleExportJson = () => {
    const payload = {
      sourceFile: fileName,
      exportedAt: new Date().toISOString(),
      condition: "mean_pm25_14h < mean_pm25_22h",
      stationSummaries,
      inversionPairs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    triggerBlobDownload(blob, "night-runner-inversion-analysis.json");
  };

  // --- Chart 1 Geometry: Hourly PM2.5 Trend ---
  const W = 560;
  const H = 300;
  const pad = { top: 28, right: 20, bottom: 42, left: 46 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const allHourlyVals = stationSummaries.flatMap((s) =>
    Object.values(s.hourlyPm25)
  );
  const maxTrendY = Math.max(55, ...(allHourlyVals.length ? allHourlyVals : [50])) * 1.12;
  const xHour = (hr: number) => pad.left + (hr / 23) * plotW;
  const yVal = (v: number, maxV: number) =>
    pad.top + plotH - (v / maxV) * plotH;

  // --- Chart 2 Geometry: Station Inversion Delta & 14h vs 22h ---
  const W_BAR = Math.max(580, stationSummaries.length * 52);
  const maxBarY =
    Math.max(
      55,
      ...stationSummaries.flatMap((s) => [s.pm14, s.pm22])
    ) * 1.18;
  const barPad = { top: 30, right: 16, bottom: 56, left: 42 };
  const barPlotW = W_BAR - barPad.left - barPad.right;
  const barPlotH = H - barPad.top - barPad.bottom;
  const groupW = barPlotW / Math.max(1, stationSummaries.length);
  const barW = Math.min(18, Math.max(8, groupW * 0.3));

  const buildYGridTicks = (maxV: number): number[] => {
    const step = maxV <= 75 ? 15 : maxV <= 130 ? 25 : 50;
    const ticks: number[] = [];
    for (let t = 0; t <= maxV; t += step) ticks.push(t);
    return ticks;
  };
  const trendTicks = buildYGridTicks(maxTrendY);
  const barTicks = buildYGridTicks(maxBarY);

  return (
    <div className="space-y-4">
      {/* Export Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[#0f172a]">
          비교 분석 차트
        </h3>
        <button
          type="button"
          onClick={handleExportJson}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#e2e8f0] bg-[#ffffff] hover:bg-[#f8fafc] text-xs font-medium text-[#0f172a] transition"
        >
          <FileJson className="w-3.5 h-3.5 text-[#475569]" />
          JSON 내보내기
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1: Hourly PM2.5 Trend */}
        <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-[#0f172a]">
                시간대별 PM2.5 추이 (0시~23시)
              </h4>
              <p className="text-xs text-[#64748b]">
                측정소를 선택하면 14시(주간) 대비 22시(야간) 상승 추이를 비교할 수 있습니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                downloadSvgAsPng(
                  trendSvgRef.current,
                  `hourly-pm25-${activeStation?.station || "all"}.png`
                )
              }
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#e2e8f0] bg-[#f8fafc] hover:bg-[#f1f5f9] text-xs font-medium text-[#0f172a] transition"
            >
              <Download className="w-3.5 h-3.5 text-[#475569]" />
              PNG 저장
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {stationSummaries.map((s) => {
              const active = s.station === activeStation?.station;
              return (
                <button
                  key={s.station}
                  type="button"
                  onClick={() => setFocusedStation(s.station)}
                  className={`px-2.5 py-1 rounded text-xs font-medium border transition ${
                    active
                      ? "bg-[#0f172a] text-[#ffffff] border-[#0f172a]"
                      : "bg-[#ffffff] text-[#475569] border-[#e2e8f0] hover:bg-[#f8fafc]"
                  }`}
                >
                  {s.station}
                </button>
              );
            })}
          </div>

          <div className="border border-[#e2e8f0] rounded-md bg-[#ffffff] p-1 overflow-hidden">
            <svg
              ref={trendSvgRef}
              viewBox={`0 0 ${W} ${H}`}
              className="w-full h-auto block"
              aria-label="시간대별 PM2.5 추이 차트"
            >
              <rect x="0" y="0" width={W} height={H} fill="#ffffff" />

              {/* Night Inversion Zone 20h~23h */}
              <rect
                x={xHour(20)}
                y={pad.top}
                width={xHour(23) - xHour(20)}
                height={plotH}
                fill="#fef2f2"
              />
              <text
                x={(xHour(20) + xHour(23)) / 2}
                y={pad.top + 14}
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                fill="#dc2626"
              >
                야간 정체대
              </text>

              {/* Y Grid */}
              {trendTicks.map((tick) => {
                const y = yVal(tick, maxTrendY);
                return (
                  <g key={tick}>
                    <line
                      x1={pad.left}
                      y1={y}
                      x2={W - pad.right}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={pad.left - 8}
                      y={y + 4}
                      textAnchor="end"
                      fontSize="11"
                      fill="#64748b"
                    >
                      {tick}
                    </text>
                  </g>
                );
              })}

              {/* 14h and 22h Reference Vertical Lines */}
              <line
                x1={xHour(14)}
                y1={pad.top}
                x2={xHour(14)}
                y2={pad.top + plotH}
                stroke="#94a3b8"
                strokeDasharray="4 3"
              />
              <line
                x1={xHour(22)}
                y1={pad.top}
                x2={xHour(22)}
                y2={pad.top + plotH}
                stroke="#dc2626"
                strokeDasharray="4 3"
                opacity="0.5"
              />

              {/* X Axis Labels */}
              {[0, 3, 6, 9, 12, 14, 18, 22].map((hr) => (
                <text
                  key={hr}
                  x={xHour(hr)}
                  y={H - 16}
                  textAnchor="middle"
                  fontSize="10.5"
                  fontWeight={hr === 14 || hr === 22 ? "700" : "400"}
                  fill={hr === 22 ? "#dc2626" : "#64748b"}
                >
                  {hr}시
                </text>
              ))}

              {/* Background comparison lines for other stations */}
              {stationSummaries
                .filter((s) => s.station !== activeStation?.station)
                .map((s) => {
                  const pts = Object.entries(s.hourlyPm25)
                    .map(([h, v]) => [Number(h), v] as [number, number])
                    .sort((a, b) => a[0] - b[0]);
                  if (pts.length < 2) return null;
                  const d = pts
                    .map(
                      ([h, v], idx) =>
                        `${idx === 0 ? "M" : "L"} ${xHour(h).toFixed(1)} ${yVal(
                          v,
                          maxTrendY
                        ).toFixed(1)}`
                    )
                    .join(" ");
                  return (
                    <path
                      key={s.station}
                      d={d}
                      fill="none"
                      stroke="#cbd5e1"
                      strokeWidth="1.3"
                    />
                  );
                })}

              {/* Highlighted Station Line */}
              {activeStation && (() => {
                const pts = Object.entries(activeStation.hourlyPm25)
                  .map(([h, v]) => [Number(h), v] as [number, number])
                  .sort((a, b) => a[0] - b[0]);
                if (pts.length < 2) return null;
                const stroke = activeStation.isInversion ? "#dc2626" : "#16a34a";
                const d = pts
                  .map(
                    ([h, v], idx) =>
                      `${idx === 0 ? "M" : "L"} ${xHour(h).toFixed(1)} ${yVal(
                        v,
                        maxTrendY
                      ).toFixed(1)}`
                  )
                  .join(" ");
                const p14 = activeStation.hourlyPm25[14];
                const p22 = activeStation.hourlyPm25[22];

                return (
                  <g>
                    <path
                      d={d}
                      fill="none"
                      stroke={stroke}
                      strokeWidth="2.6"
                      strokeLinejoin="round"
                    />
                    {p14 !== undefined && (
                      <g>
                        <circle
                          cx={xHour(14)}
                          cy={yVal(p14, maxTrendY)}
                          r="4.5"
                          fill="#0284c7"
                          stroke="#ffffff"
                          strokeWidth="1.5"
                        />
                        <text
                          x={xHour(14)}
                          y={yVal(p14, maxTrendY) - 9}
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight="700"
                          fill="#0284c7"
                        >
                          14시 {p14.toFixed(1)}
                        </text>
                      </g>
                    )}
                    {p22 !== undefined && (
                      <g>
                        <circle
                          cx={xHour(22)}
                          cy={yVal(p22, maxTrendY)}
                          r="4.5"
                          fill={stroke}
                          stroke="#ffffff"
                          strokeWidth="1.5"
                        />
                        <text
                          x={xHour(22) - 4}
                          y={yVal(p22, maxTrendY) - 9}
                          textAnchor="end"
                          fontSize="11"
                          fontWeight="700"
                          fill={stroke}
                        >
                          22시 {p22.toFixed(1)}
                        </text>
                      </g>
                    )}
                    <text
                      x={pad.left + 8}
                      y={pad.top + 14}
                      fontSize="11.5"
                      fontWeight="700"
                      fill="#0f172a"
                    >
                      선택 측정소: {activeStation.station} (단위: ㎍/㎥)
                    </text>
                  </g>
                );
              })()}
            </svg>
          </div>
        </div>

        {/* Chart 2: Station Inversion Bar Chart (14시 vs 22시 & Δ) */}
        <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-[#0f172a]">
                측정소별 14시 vs 22시 비교 및 역전폭(Δ) 막대 그래프
              </h4>
              <p className="text-xs text-[#64748b]">
                하단 수치는 밤 22시에서 낮 14시를 뺀 역전 상승폭(㎍/㎥)입니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                downloadSvgAsPng(barSvgRef.current, "station-inversion-bars.png")
              }
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#e2e8f0] bg-[#f8fafc] hover:bg-[#f1f5f9] text-xs font-medium text-[#0f172a] transition"
            >
              <Download className="w-3.5 h-3.5 text-[#475569]" />
              PNG 저장
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs text-[#475569]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#64748b]" />
              낮 14시 평균
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#dc2626]" />
              밤 22시 (역전 발생)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#16a34a]" />
              밤 22시 (역전 미발생)
            </span>
          </div>

          <div className="border border-[#e2e8f0] rounded-md bg-[#ffffff] p-1 overflow-x-auto">
            <svg
              ref={barSvgRef}
              viewBox={`0 0 ${W_BAR} ${H}`}
              className="w-full min-w-[540px] h-auto block"
              aria-label="측정소별 역전폭 막대 그래프"
            >
              <rect x="0" y="0" width={W_BAR} height={H} fill="#ffffff" />

              {barTicks.map((tick) => {
                const y = barPad.top + barPlotH - (tick / maxBarY) * barPlotH;
                return (
                  <g key={tick}>
                    <line
                      x1={barPad.left}
                      y1={y}
                      x2={W_BAR - barPad.right}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={barPad.left - 8}
                      y={y + 4}
                      textAnchor="end"
                      fontSize="11"
                      fill="#64748b"
                    >
                      {tick}
                    </text>
                  </g>
                );
              })}

              {/* 35 µg/m³ Bad Threshold */}
              {(() => {
                const y35 = barPad.top + barPlotH - (35 / maxBarY) * barPlotH;
                return (
                  <g>
                    <line
                      x1={barPad.left}
                      y1={y35}
                      x2={W_BAR - barPad.right}
                      y2={y35}
                      stroke="#dc2626"
                      strokeDasharray="5 3"
                      opacity="0.6"
                    />
                    <text
                      x={W_BAR - barPad.right}
                      y={y35 - 5}
                      textAnchor="end"
                      fontSize="10.5"
                      fontWeight="600"
                      fill="#dc2626"
                    >
                      나쁨 기준 (35 ㎍/㎥)
                    </text>
                  </g>
                );
              })()}

              {stationSummaries.map((s, idx) => {
                const cx = barPad.left + groupW * (idx + 0.5);
                const x14 = cx - barW - 2;
                const x22 = cx + 2;
                const y14 =
                  barPad.top + barPlotH - (s.pm14 / maxBarY) * barPlotH;
                const y22 =
                  barPad.top + barPlotH - (s.pm22 / maxBarY) * barPlotH;
                const h14 = barPad.top + barPlotH - y14;
                const h22 = barPad.top + barPlotH - y22;
                const nightColor = s.isInversion ? "#dc2626" : "#16a34a";
                const diffStr = `${s.diff >= 0 ? "+" : ""}${s.diff.toFixed(1)}`;

                return (
                  <g key={s.station}>
                    <rect
                      x={x14}
                      y={y14}
                      width={barW}
                      height={Math.max(2, h14)}
                      rx="2"
                      fill="#64748b"
                    />
                    <text
                      x={x14 + barW / 2}
                      y={y14 - 4}
                      textAnchor="middle"
                      fontSize="10.5"
                      fill="#475569"
                    >
                      {s.pm14.toFixed(0)}
                    </text>

                    <rect
                      x={x22}
                      y={y22}
                      width={barW}
                      height={Math.max(2, h22)}
                      rx="2"
                      fill={nightColor}
                    />
                    <text
                      x={x22 + barW / 2}
                      y={y22 - 4}
                      textAnchor="middle"
                      fontSize="10.5"
                      fontWeight="700"
                      fill={nightColor}
                    >
                      {s.pm22.toFixed(0)}
                    </text>

                    <text
                      x={cx}
                      y={H - 30}
                      textAnchor="middle"
                      fontSize="11.5"
                      fontWeight="700"
                      fill="#0f172a"
                    >
                      {s.station}
                    </text>
                    <text
                      x={cx}
                      y={H - 13}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="600"
                      fill={s.isInversion ? "#dc2626" : "#16a34a"}
                    >
                      {diffStr}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
