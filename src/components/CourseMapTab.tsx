"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  Clock,
  Download,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { REGIONS, type CourseVariant } from "@/lib/courses";
import {
  classifyCourseStatus,
  type StationSummary,
  type TrafficStatus,
} from "@/lib/csvParser";
import type {
  RegressionModelMetrics,
  StationPrediction,
} from "@/lib/inversionModel";
import type { MapCourseItem } from "@/components/LeafletMap";
import KakaoMap from "@/components/KakaoMap";

type MapViewMode = "osm" | "satellite" | "kakao";

const LeafletMap = dynamic(() => import("@/components/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[460px] sm:h-[530px] rounded-lg border border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-center text-sm text-[#64748b]">
      지도를 불러오는 중입니다...
    </div>
  ),
});

interface CourseMapTabProps {
  stationSummaries: StationSummary[];
  modelMetrics: RegressionModelMetrics;
  predictions: Map<string, StationPrediction>;
}

const STATUS_BADGE: Record<
  TrafficStatus,
  { label: string; dot: string; bg: string; text: string; border: string }
> = {
  safe: {
    label: "안전",
    dot: "bg-[#16a34a]",
    bg: "bg-[#f0fdf4]",
    text: "text-[#15803d]",
    border: "border-[#bbf7d0]",
  },
  caution: {
    label: "주의",
    dot: "bg-[#d97706]",
    bg: "bg-[#fffbeb]",
    text: "text-[#b45309]",
    border: "border-[#fde68a]",
  },
  danger: {
    label: "역전 위험",
    dot: "bg-[#dc2626]",
    bg: "bg-[#fef2f2]",
    text: "text-[#b91c1c]",
    border: "border-[#fecaca]",
  },
};

const ENV_KAKAO_KEY = (process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "").trim();

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export default function CourseMapTab({
  stationSummaries,
  modelMetrics,
  predictions,
}: CourseMapTabProps) {
  const [selectedHour, setSelectedHour] = useState<number>(22);
  const [selectedRegionId, setSelectedRegionId] =
    useState<string>("dongducheon");
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    "dongducheon-sincheon"
  );
  const [showModelDetail, setShowModelDetail] = useState<boolean>(false);

  // Never persist map mode in localStorage; start on Kakao Map when key exists, otherwise OSM
  const [mapProvider, setMapProvider] = useState<MapViewMode>(
    ENV_KAKAO_KEY ? "kakao" : "osm"
  );
  const [mapToast, setMapToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.removeItem("nr_map_provider");
    } catch {}
  }, []);

  useEffect(() => {
    if (!mapToast) return;
    const t = window.setTimeout(() => setMapToast(null), 5000);
    return () => window.clearTimeout(t);
  }, [mapToast]);

  const handleChangeProvider = (next: MapViewMode) => {
    if (next === "kakao" && !ENV_KAKAO_KEY) {
      setMapProvider("osm");
      setMapToast(
        "카카오맵 키가 없어 기본 지도(OpenStreetMap)로 표시합니다. 위성 보기는 '위성 지도'를 이용해 주세요."
      );
      return;
    }
    setMapToast(null);
    setMapProvider(next);
  };

  const handleKakaoFallback = useCallback((reason: string) => {
    setMapProvider("osm");
    setMapToast(reason);
  }, []);

  const summaryMap = useMemo(() => {
    const map = new Map<string, StationSummary>();
    stationSummaries.forEach((s) => map.set(s.station, s));
    return map;
  }, [stationSummaries]);

  const regionMetrics = useMemo(() => {
    return REGIONS.map((region) => {
      const st = summaryMap.get(region.stationName);
      const pred = predictions.get(region.stationName);
      const basePm14 = st?.pm14 ?? 21.0;
      const basePm22 = st?.pm22 ?? 21.0;
      const basePmAtHour = st?.hourlyPm25[selectedHour] ?? basePm22;
      const baseWindAtHour =
        st?.hourlyWind[selectedHour] ?? st?.wind22 ?? 1.2;
      const basePred22 = pred?.predictedPm22 ?? basePm22;

      const computedCourses = region.courses.map((variant: CourseVariant) => {
        const pm14 = Math.round(basePm14 * variant.exposureFactor * 10) / 10;
        const pm22 = Math.round(basePm22 * variant.exposureFactor * 10) / 10;
        const pmAtHour =
          Math.round(basePmAtHour * variant.exposureFactor * 10) / 10;
        const predictedPm22 =
          Math.round(basePred22 * variant.exposureFactor * 10) / 10;
        const diff = Math.round((pm22 - pm14) * 10) / 10;
        const isInversion = variant.isWindCorridor ? false : pm14 < pm22;
        const windAtHour =
          baseWindAtHour !== null
            ? Math.round(baseWindAtHour * variant.windFactor * 10) / 10
            : null;
        const status = classifyCourseStatus(
          pmAtHour,
          isInversion,
          diff,
          selectedHour
        );
        const cigaretteEq = Math.max(
          0.2,
          Math.round((pmAtHour / 16.5) * 10) / 10
        );

        const eveningSeries = Array.from({ length: 10 }, (_, idx) => {
          const hr = 14 + idx;
          const raw = st?.hourlyPm25[hr] ?? basePmAtHour;
          return {
            hour: hr,
            pm25: Math.round(raw * variant.exposureFactor * 10) / 10,
          };
        });

        const baseProb = pred?.inversionProbPct ?? (isInversion ? 85 : 15);
        const courseInversionProb = variant.isWindCorridor
          ? Math.max(4, Math.round(baseProb * variant.exposureFactor * 0.45))
          : baseProb;

        return {
          variant,
          pm14,
          pm22,
          pmAtHour,
          predictedPm22,
          inversionProbPct: courseInversionProb,
          diff,
          isInversion,
          windAtHour,
          status,
          cigaretteEq,
          eveningSeries,
        };
      });

      const rankedCourses = [...computedCourses].sort((a, b) => {
        const order = { safe: 0, caution: 1, danger: 2 };
        if (order[a.status] !== order[b.status]) {
          return order[a.status] - order[b.status];
        }
        return a.pmAtHour - b.pmAtHour;
      });

      const primaryCourseStatus = computedCourses[0]?.status ?? "safe";

      return {
        region,
        stationSummary: st,
        stationPrediction: pred,
        courses: computedCourses,
        rankedCourses,
        bestCourse: rankedCourses[0],
        primaryCourseStatus,
      };
    });
  }, [summaryMap, predictions, selectedHour]);

  const mapCourses: MapCourseItem[] = useMemo(() => {
    const items: MapCourseItem[] = [];
    regionMetrics.forEach(({ region, courses }) => {
      courses.forEach((c) => {
        items.push({
          regionId: region.id,
          regionLabel: region.label,
          courseId: c.variant.id,
          courseName: c.variant.name,
          distanceKm: c.variant.distanceKm,
          pmAtHour: c.pmAtHour,
          status: c.status,
          isWindCorridor: c.variant.isWindCorridor,
          coordinates: c.variant.coordinates,
        });
      });
    });
    return items;
  }, [regionMetrics]);

  const activeRegionMetric =
    regionMetrics.find((m) => m.region.id === selectedRegionId) ??
    regionMetrics[0];
  const activeCourse =
    activeRegionMetric.courses.find(
      (c) => c.variant.id === selectedCourseId
    ) ?? activeRegionMetric.courses[0];
  const activeBadge = STATUS_BADGE[activeCourse.status];
  const bestCourse = activeRegionMetric.bestCourse;

  const handleSelectRegion = (regionId: string) => {
    setSelectedRegionId(regionId);
    const targetRegion = regionMetrics.find((m) => m.region.id === regionId);
    if (targetRegion && targetRegion.courses[0]) {
      setSelectedCourseId(targetRegion.courses[0].variant.id);
    }
  };

  const handleDownloadGpx = () => {
    const v = activeCourse.variant;
    const trkpts = v.coordinates
      .map(([lat, lon]) => `      <trkpt lat="${lat}" lon="${lon}"></trkpt>`)
      .join("\n");
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="NightRunner" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(v.name)}</name>
    <desc>${escapeXml(activeRegionMetric.region.label)} (${v.distanceKm}km) · ${escapeXml(v.terrainNote)}</desc>
  </metadata>
  <trk>
    <name>${escapeXml(v.name)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;

    const blob = new Blob([gpx], { type: "application/gpx+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${v.id}.gpx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleSelectCourseFromMap = useCallback(
    (regionId: string, courseId: string) => {
      setSelectedRegionId(regionId);
      setSelectedCourseId(courseId);
    },
    []
  );

  const useKakao = mapProvider === "kakao" && Boolean(ENV_KAKAO_KEY);

  return (
    <div className="space-y-4">
      {/* Top Control Bar: Hour Slider + 14 Region Buttons */}
      <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-lg p-4">
        <div className="grid grid-cols-1 xl:grid-cols-12 xl:items-center gap-4">
          {/* Hour Slider */}
          <div className="xl:col-span-5 space-y-1.5 min-w-0">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#0f172a] whitespace-nowrap">
                <Clock className="w-3.5 h-3.5 text-[#475569] shrink-0" />
                러닝 시각 선택
              </span>
              <span className="font-bold text-[#0f172a] tabular-nums whitespace-nowrap">
                {selectedHour}시
                <span className="ml-1.5 font-normal text-[#64748b]">
                  {selectedHour <= 16
                    ? "주간 (공기 순환)"
                    : selectedHour <= 19
                    ? "일몰 전후"
                    : "야간 역전 주의"}
                </span>
              </span>
            </div>
            <input
              type="range"
              min={14}
              max={23}
              step={1}
              value={selectedHour}
              onChange={(e) => setSelectedHour(Number(e.target.value))}
              className="w-full cursor-pointer"
              aria-label="시간대 선택 (14시~23시)"
            />
            <div className="flex justify-between gap-2 text-[11px] text-[#64748b] tabular-nums">
              <span className="whitespace-nowrap">14시 (낮)</span>
              <span className="whitespace-nowrap">18시 (일몰)</span>
              <span className="font-semibold text-[#0f172a] whitespace-nowrap">
                21~22시 (야간 피크)
              </span>
              <span className="whitespace-nowrap">23시</span>
            </div>
          </div>

          {/* 14 Region Buttons */}
          <div className="xl:col-span-7 space-y-1.5">
            <div className="text-xs font-semibold text-[#475569] whitespace-nowrap">
              지역 선택 (수도권 8 · 전국 6)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {regionMetrics.map(({ region, primaryCourseStatus }) => {
                const isSelected = region.id === selectedRegionId;
                const badge = STATUS_BADGE[primaryCourseStatus];
                return (
                  <button
                    key={region.id}
                    type="button"
                    onClick={() => handleSelectRegion(region.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition ${
                      isSelected
                        ? "bg-[#0f172a] text-[#ffffff] border-[#0f172a]"
                        : "bg-[#ffffff] text-[#334155] border-[#e2e8f0] hover:bg-[#f8fafc]"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                    <span>{region.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Split: Left Map + Right Clean Decision Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left: Map */}
        <div className="lg:col-span-7 bg-[#ffffff] border border-[#e2e8f0] rounded-lg p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="text-xs font-semibold text-[#0f172a]">
              {activeRegionMetric.region.label} 코스 지도
              <span className="ml-2 font-normal text-[#64748b]">
                {activeRegionMetric.region.terrainSummary}
              </span>
            </div>

            <div className="inline-flex rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-0.5 text-[11px]">
              {(
                [
                  ["kakao", "카카오맵"],
                  ["osm", "기본 지도"],
                  ["satellite", "위성 지도"],
                ] as [MapViewMode, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleChangeProvider(key)}
                  className={`px-2.5 py-1 rounded font-medium whitespace-nowrap transition ${
                    mapProvider === key
                      ? "bg-[#ffffff] text-[#0f172a] border border-[#e2e8f0]"
                      : "text-[#64748b] hover:text-[#0f172a] border border-transparent"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {mapToast && (
            <div
              role="status"
              className="flex items-center justify-between gap-2 rounded-md border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-xs text-[#b45309]"
            >
              <span>{mapToast}</span>
              <button
                type="button"
                onClick={() => setMapToast(null)}
                aria-label="알림 닫기"
                className="shrink-0 p-0.5 rounded hover:bg-[#fef3c7]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="relative">
            {/* Fixed top-left badge so course title/PM never collides with route or finish markers */}
            <div className="pointer-events-none absolute top-3 left-3 z-[450] max-w-[calc(100%-4.5rem)] rounded-md border border-[#cbd5e1] bg-[#ffffff]/95 px-2.5 py-1.5 shadow-sm flex items-center gap-2 text-xs">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${activeBadge.dot}`}
              />
              <span className="font-semibold text-[#0f172a] truncate">
                {activeCourse.variant.name}
              </span>
              <span className="text-[#64748b] shrink-0">
                {activeCourse.variant.distanceKm.toFixed(1)}km
              </span>
              <span className="font-bold text-[#0f172a] tabular-nums shrink-0">
                {activeCourse.pmAtHour.toFixed(1)} ㎍/㎥
              </span>
            </div>

            {useKakao ? (
              <KakaoMap
                kakaoKey={ENV_KAKAO_KEY}
                mapType="roadmap"
                regions={REGIONS}
                courses={mapCourses}
                selectedRegionId={selectedRegionId}
                selectedCourseId={activeCourse.variant.id}
                onSelectCourse={handleSelectCourseFromMap}
                onFallback={handleKakaoFallback}
              />
            ) : (
              <LeafletMap
                tileMode={mapProvider === "satellite" ? "satellite" : "osm"}
                regions={REGIONS}
                courses={mapCourses}
                selectedRegionId={selectedRegionId}
                selectedCourseId={activeCourse.variant.id}
                onSelectCourse={handleSelectCourseFromMap}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <p className="text-[11px] text-[#64748b]">
              실선: 현재 선택한 코스 · 점선: 같은 지역 다른 코스
            </p>
            <div className="flex items-center gap-3 text-xs text-[#475569]">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#16a34a]" />
                안전
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#d97706]" />
                주의
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#dc2626]" />
                역전 위험
              </span>
            </div>
          </div>
        </div>

        {/* Right: Scannable 4-Block Summary Panel */}
        <div className="lg:col-span-5 bg-[#ffffff] border border-[#e2e8f0] rounded-lg p-4 space-y-4">
          {/* 1. Ranked Course List */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#0f172a]">
                {selectedHour}시 추천 코스 순위
              </span>
              <span className="text-[11px] text-[#64748b]">
                숫자는 미세먼지(㎍/㎥)
              </span>
            </div>
            <div className="space-y-1.5">
              {activeRegionMetric.rankedCourses.map((c, idx) => {
                const badge = STATUS_BADGE[c.status];
                const isSel = c.variant.id === activeCourse.variant.id;
                return (
                  <button
                    key={c.variant.id}
                    type="button"
                    onClick={() => setSelectedCourseId(c.variant.id)}
                    className={`w-full px-3 py-2 rounded-md border text-left transition flex items-center justify-between gap-2 ${
                      isSel
                        ? "border-[#0f172a] bg-[#f8fafc]"
                        : "border-[#e2e8f0] bg-[#ffffff] hover:bg-[#f8fafc]"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] font-bold text-[#64748b] w-8 shrink-0">
                        {idx + 1}순위
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${badge.dot}`}
                      />
                      <span className="text-xs font-semibold text-[#0f172a] truncate">
                        {c.variant.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-xs tabular-nums">
                      <span className="text-[11px] text-[#64748b]">
                        {c.variant.distanceKm.toFixed(1)}km
                      </span>
                      <span className={`font-bold ${badge.text}`}>
                        {c.pmAtHour.toFixed(1)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Selected Course Verdict + 3 Core Numbers */}
          <div className="pt-3 border-t border-[#e2e8f0] space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#0f172a]">
                  {activeCourse.variant.name}
                </h2>
                <p className="text-xs text-[#64748b] mt-0.5">
                  {activeCourse.variant.distanceKm.toFixed(1)} km ·{" "}
                  {activeCourse.variant.elevationNote}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${activeBadge.bg} ${activeBadge.text} ${activeBadge.border}`}
                >
                  <span className={`w-2 h-2 rounded-full ${activeBadge.dot}`} />
                  {activeBadge.label}
                </span>
                <button
                  type="button"
                  onClick={handleDownloadGpx}
                  title="GPX 경로 파일 저장"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[#e2e8f0] bg-[#f8fafc] hover:bg-[#f1f5f9] text-[11px] font-medium text-[#334155]"
                >
                  <Download className="w-3 h-3" />
                  GPX
                </button>
              </div>
            </div>

            {/* 3 Crystal-Clear Core Metrics */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-2.5">
                <div className="text-[11px] text-[#64748b]">
                  {selectedHour}시 미세먼지
                </div>
                <div
                  className={`text-lg font-bold tabular-nums mt-0.5 ${
                    activeCourse.status === "danger"
                      ? "text-[#dc2626]"
                      : activeCourse.status === "caution"
                      ? "text-[#d97706]"
                      : "text-[#16a34a]"
                  }`}
                >
                  {activeCourse.pmAtHour.toFixed(1)}
                  <span className="text-[11px] font-normal text-[#64748b] ml-0.5">
                    ㎍/㎥
                  </span>
                </div>
                <div className="text-[11px] text-[#64748b] tabular-nums mt-0.5">
                  낮 {activeCourse.pm14.toFixed(0)} → 밤{" "}
                  {activeCourse.pm22.toFixed(0)}
                </div>
              </div>

              <div className="rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-2.5">
                <div className="text-[11px] text-[#64748b]">역전 · 바람</div>
                <div
                  className={`text-lg font-bold mt-0.5 ${
                    activeCourse.isInversion
                      ? "text-[#dc2626]"
                      : "text-[#16a34a]"
                  }`}
                >
                  {activeCourse.isInversion ? "역전 발생" : "순환 양호"}
                </div>
                <div className="text-[11px] text-[#64748b] tabular-nums mt-0.5">
                  풍속{" "}
                  {activeCourse.windAtHour !== null
                    ? `${activeCourse.windAtHour.toFixed(1)} m/s`
                    : "-"}
                </div>
              </div>

              <div className="rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-2.5">
                <div className="text-[11px] text-[#64748b]">1시간 러닝 영향</div>
                <div className="text-lg font-bold text-[#0f172a] tabular-nums mt-0.5">
                  담배 {activeCourse.cigaretteEq.toFixed(1)}개비
                </div>
                <div className="text-[11px] text-[#64748b] tabular-nums mt-0.5">
                  역전 확률 {activeCourse.inversionProbPct}%
                </div>
              </div>
            </div>
          </div>

          {/* 3. Simple Hourly Flow Chart (14시 -> 23시) */}
          <div className="rounded-md border border-[#e2e8f0] bg-[#ffffff] p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#0f172a]">
                시간대별 농도 흐름 (낮 14시 → 밤 23시)
              </span>
              <span className="text-[11px] text-[#64748b]">
                막대 클릭 시 이동
              </span>
            </div>
            <div className="grid grid-cols-10 gap-1 items-end h-11 pt-1">
              {activeCourse.eveningSeries.map((pt) => {
                const pct = Math.min(100, Math.max(14, (pt.pm25 / 60) * 100));
                const barColor =
                  pt.pm25 >= 35
                    ? "bg-[#dc2626]"
                    : pt.pm25 >= 24
                    ? "bg-[#d97706]"
                    : "bg-[#16a34a]";
                const isCur = pt.hour === selectedHour;
                return (
                  <button
                    key={pt.hour}
                    type="button"
                    onClick={() => setSelectedHour(pt.hour)}
                    title={`${pt.hour}시: ${pt.pm25.toFixed(1)} ㎍/㎥`}
                    className="flex flex-col items-center justify-end h-full group"
                  >
                    <div
                      className={`w-full rounded-t-xs transition-all ${barColor} ${
                        isCur
                          ? "opacity-100 ring-1 ring-[#0f172a]"
                          : "opacity-55 group-hover:opacity-85"
                      }`}
                      style={{ height: `${pct}%` }}
                    />
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-10 gap-1 text-center text-[10px] text-[#64748b] tabular-nums">
              {activeCourse.eveningSeries.map((pt) => (
                <span
                  key={pt.hour}
                  className={
                    pt.hour === selectedHour ? "font-bold text-[#0f172a]" : ""
                  }
                >
                  {pt.hour}시
                </span>
              ))}
            </div>
          </div>

          {/* 4. Clear 1-Sentence Advice + Safe Detour Button */}
          <div className="space-y-2.5">
            <div className="rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-xs text-[#334155] leading-relaxed">
              <strong className="text-[#0f172a]">오늘 안내: </strong>
              {activeCourse.status === "danger"
                ? `낮(${activeCourse.pm14.toFixed(
                    0
                  )})보다 밤(${activeCourse.pm22.toFixed(
                    0
                  )})에 미세먼지가 갇히는 정체 구간입니다. 아래 1순위 안전 코스로 이동하세요.`
                : activeCourse.status === "caution"
                ? `공기 순환이 다소 느린 구간입니다. 30분 내외 가벼운 조깅이나 1순위 코스를 권장합니다.`
                : selectedHour < 19 && activeCourse.isInversion
                ? `현재(${selectedHour}시) 주간 공기 순환으로 양호하나, 밤 22시(${activeCourse.pm22.toFixed(
                    0
                  )})에는 역전층 정체가 예상되므로 야간에는 1순위 바람길 코스를 권장합니다.`
                : activeCourse.isInversion && activeCourse.diff > 0
                ? `현재(${selectedHour}시) 미세먼지는 보통 수준이나 야간 역전 경향(낮 ${activeCourse.pm14.toFixed(
                    0
                  )} → 밤 ${activeCourse.pm22.toFixed(
                    0
                  )})이 있어 1순위 바람길 코스가 더 안전합니다.`
                : `바람 순환이 유지되어 밤에도 공기가 깨끗합니다. 나이트 러닝하기 좋은 코스입니다.`}
            </div>

            {bestCourse &&
              bestCourse.variant.id !== activeCourse.variant.id &&
              (activeCourse.status !== "safe" || activeCourse.isInversion) && (
                <button
                  type="button"
                  onClick={() => setSelectedCourseId(bestCourse.variant.id)}
                  className="w-full py-2.5 px-3 rounded-md border border-[#bbf7d0] bg-[#f0fdf4] hover:bg-[#dcfce7] text-[#15803d] text-xs font-semibold flex items-center justify-between transition"
                >
                  <span>
                    1순위 안전 코스로 바로 이동 ({bestCourse.variant.name})
                  </span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
              )}

            {/* Expandable ML Model Details for Judges */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowModelDetail((v) => !v)}
                className="w-full flex items-center justify-between text-[11px] text-[#64748b] hover:text-[#0f172a] py-1"
              >
                <span>
                  AI 역전 예측 모델 근거 보기 (22시 예상{" "}
                  {activeCourse.predictedPm22.toFixed(1)} ㎍/㎥ · R²{" "}
                  {modelMetrics.rSquared.toFixed(2)})
                </span>
                {showModelDetail ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {showModelDetail && (
                <div className="mt-1.5 rounded-md border border-[#e2e8f0] bg-[#ffffff] p-2.5 text-[11px] text-[#475569] space-y-1">
                  <div className="flex justify-between">
                    <span>다중선형회귀(Ridge) 정확도</span>
                    <span className="font-semibold text-[#0f172a] tabular-nums">
                      R² {modelMetrics.rSquared.toFixed(3)} · 평균 오차{" "}
                      {modelMetrics.mae.toFixed(1)} ㎍/㎥
                    </span>
                  </div>
                  {activeRegionMetric.stationPrediction && (
                    <div className="flex justify-between gap-2">
                      <span>주요 역전 원인</span>
                      <span className="font-semibold text-[#0f172a] text-right">
                        {activeRegionMetric.stationPrediction.topFactor}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
