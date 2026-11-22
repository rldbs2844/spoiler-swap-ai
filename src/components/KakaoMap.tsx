"use client";

import { useEffect, useRef, useState } from "react";
import type { MapCourseItem } from "@/components/LeafletMap";
import type { RegionConfig } from "@/lib/courses";
import type { TrafficStatus } from "@/lib/csvParser";

interface KakaoMapProps {
  kakaoKey: string;
  mapType?: "roadmap" | "skyview";
  regions: RegionConfig[];
  courses: MapCourseItem[];
  selectedRegionId: string;
  selectedCourseId: string;
  onSelectCourse: (regionId: string, courseId: string) => void;
  onFallback: (reason: string) => void;
}

const STATUS_COLOR: Record<TrafficStatus, string> = {
  safe: "#16a34a",
  caution: "#d97706",
  danger: "#dc2626",
};

function haversineKm(a: [number, number], b: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function getDistanceMarkers(
  coords: [number, number][]
): { point: [number, number]; label: string; kind: "start" | "km" | "end" }[] {
  if (coords.length < 2) return [];
  const startPt = coords[0];
  const endPt = coords[coords.length - 1];
  const markers: {
    point: [number, number];
    label: string;
    kind: "start" | "km" | "end";
  }[] = [{ point: startPt, label: "출발", kind: "start" }];
  let accum = 0;
  let nextKm = 1;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const seg = haversineKm(prev, curr);
    while (accum + seg >= nextKm && seg > 0) {
      const t = (nextKm - accum) / seg;
      const pt: [number, number] = [
        prev[0] + (curr[0] - prev[0]) * t,
        prev[1] + (curr[1] - prev[1]) * t,
      ];
      if (
        haversineKm(pt, startPt) >= 0.35 &&
        haversineKm(pt, endPt) >= 0.45
      ) {
        markers.push({ point: pt, label: `${nextKm}km`, kind: "km" });
      }
      nextKm += 1;
    }
    accum += seg;
  }
  markers.push({ point: endPt, label: "도착", kind: "end" });
  return markers;
}

export default function KakaoMap({
  kakaoKey,
  mapType = "roadmap",
  regions,
  courses,
  selectedRegionId,
  selectedCourseId,
  onSelectCourse,
  onFallback,
}: KakaoMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const objectsRef = useRef<any[]>([]);
  const lastViewKeyRef = useRef<string>("");
  const onSelectCourseRef = useRef(onSelectCourse);
  const onFallbackRef = useRef(onFallback);
  useEffect(() => {
    onSelectCourseRef.current = onSelectCourse;
    onFallbackRef.current = onFallback;
  }, [onSelectCourse, onFallback]);
  const [sdkReady, setSdkReady] = useState<boolean>(false);

  useEffect(() => {
    const trimmed = kakaoKey.trim();
    if (!trimmed) {
      onFallbackRef.current(
        "카카오맵 API 키가 설정되지 않아 기본 지도(OpenStreetMap)로 전환했습니다."
      );
      return;
    }

    let cancelled = false;
    let settled = false;
    const scriptId = "kakao-maps-sdk";
    const existing = document.getElementById(
      scriptId
    ) as HTMLScriptElement | null;

    const triggerFallback = (reason: string) => {
      if (cancelled || settled) return;
      settled = true;
      setSdkReady(false);
      onFallbackRef.current(reason);
    };

    const timeoutId = window.setTimeout(() => {
      triggerFallback(
        "카카오맵 SDK가 3초 내에 응답하지 않아 기본 지도(OpenStreetMap)로 자동 전환했습니다."
      );
    }, 3000);

    const initKakao = () => {
      if (cancelled || settled) return;
      try {
        if (!window.kakao?.maps?.load) {
          window.clearTimeout(timeoutId);
          triggerFallback(
            "카카오맵 SDK 초기화에 실패하여 기본 지도(OpenStreetMap)로 전환했습니다."
          );
          return;
        }
        window.kakao.maps.load(() => {
          if (cancelled || settled) return;
          try {
            if (!containerRef.current || !window.kakao?.maps?.Map) {
              window.clearTimeout(timeoutId);
              triggerFallback(
                "카카오맵 렌더링 객체를 불러오지 못해 기본 지도로 전환했습니다."
              );
              return;
            }
            const reg =
              regions.find((r) => r.id === selectedRegionId) ?? regions[0];
            const center = new window.kakao.maps.LatLng(
              reg.center[0],
              reg.center[1]
            );
            const map = new window.kakao.maps.Map(containerRef.current, {
              center,
              level: 5,
            });
            if (window.kakao.maps.MapTypeId) {
              map.setMapTypeId(
                mapType === "skyview"
                  ? window.kakao.maps.MapTypeId.HYBRID
                  : window.kakao.maps.MapTypeId.ROADMAP
              );
            }
            map.addControl(
              new window.kakao.maps.ZoomControl(),
              window.kakao.maps.ControlPosition.RIGHT
            );
            mapRef.current = map;
            lastViewKeyRef.current = "";
            settled = true;
            window.clearTimeout(timeoutId);
            setSdkReady(true);
          } catch {
            window.clearTimeout(timeoutId);
            triggerFallback(
              "카카오맵 실행 중 오류가 발생하여 기본 지도(OpenStreetMap)로 전환했습니다."
            );
          }
        });
      } catch {
        window.clearTimeout(timeoutId);
        triggerFallback(
          "카카오맵 SDK 호출 중 오류가 발생하여 기본 지도(OpenStreetMap)로 전환했습니다."
        );
      }
    };

    if (window.kakao?.maps && existing?.dataset.key === trimmed) {
      initKakao();
      return () => {
        cancelled = true;
        window.clearTimeout(timeoutId);
      };
    }

    if (existing) {
      existing.remove();
      mapRef.current = null;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.dataset.key = trimmed;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(
      trimmed
    )}&autoload=false`;
    script.onload = initKakao;
    script.onerror = () => {
      window.clearTimeout(timeoutId);
      triggerFallback(
        "카카오맵 SDK를 불러오지 못해(도메인/키 미등록 등) 기본 지도(OpenStreetMap)로 자동 전환했습니다."
      );
    };
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kakaoKey]);

  useEffect(() => {
    const map = mapRef.current;
    const kakao = window.kakao?.maps;
    if (!sdkReady || !map || !kakao?.MapTypeId) return;
    try {
      map.setMapTypeId(
        mapType === "skyview" ? kakao.MapTypeId.HYBRID : kakao.MapTypeId.ROADMAP
      );
    } catch {}
  }, [sdkReady, mapType]);

  useEffect(() => {
    const map = mapRef.current;
    const kakao = window.kakao?.maps;
    if (!sdkReady || !map || !kakao) return;

    try {
      objectsRef.current.forEach((obj) => obj.setMap(null));
      objectsRef.current = [];

      // Single reusable hover tooltip for unselected courses
      const hoverEl = document.createElement("div");
      hoverEl.className = "km-marker-badge";
      hoverEl.style.pointerEvents = "none";
      hoverEl.style.padding = "3px 8px";
      hoverEl.style.fontSize = "11px";
      const hoverOverlay = new kakao.CustomOverlay({
        position: new kakao.LatLng(37.5, 127.0),
        content: hoverEl,
        xAnchor: 0.5,
        yAnchor: 1.6,
        zIndex: 7,
      });
      objectsRef.current.push(hoverOverlay);

      courses.forEach((course) => {
        const isSelected = course.courseId === selectedCourseId;
        const color = STATUS_COLOR[course.status];
        const path = course.coordinates.map(
          ([lat, lng]) => new kakao.LatLng(lat, lng)
        );

        if (isSelected) {
          const halo = new kakao.Polyline({
            path,
            strokeWeight: 9,
            strokeColor: "#ffffff",
            strokeOpacity: 0.92,
            strokeStyle: "solid",
          });
          halo.setMap(map);
          objectsRef.current.push(halo);
        }

        const polyline = new kakao.Polyline({
          path,
          strokeWeight: isSelected ? 5.5 : 3.2,
          strokeColor: color,
          strokeOpacity: isSelected ? 0.96 : 0.62,
          strokeStyle: !isSelected ? "shortdash" : "solid",
        });
        polyline.setMap(map);
        kakao.event.addListener(polyline, "click", () => {
          onSelectCourseRef.current(course.regionId, course.courseId);
        });

        if (!isSelected) {
          const midIdx = Math.floor(course.coordinates.length / 2);
          const midPt = course.coordinates[midIdx] ?? course.coordinates[0];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          kakao.event.addListener(polyline, "mouseover", (e?: any) => {
            hoverEl.style.borderColor = color;
            hoverEl.textContent = `${course.courseName} · ${course.pmAtHour.toFixed(1)} ㎍/㎥`;
            const pos = e?.latLng ?? new kakao.LatLng(midPt[0], midPt[1]);
            hoverOverlay.setPosition(pos);
            hoverOverlay.setMap(map);
          });
          kakao.event.addListener(polyline, "mouseout", () => {
            hoverOverlay.setMap(null);
          });
        }

        objectsRef.current.push(polyline);

        if (isSelected) {
          const markers = getDistanceMarkers(course.coordinates);
          markers.forEach((dm) => {
            const isEndpoint = dm.kind !== "km";
            const badge = document.createElement("div");
            badge.className = "km-marker-badge";
            badge.style.borderColor = isEndpoint ? color : "#cbd5e1";
            badge.style.color = isEndpoint ? color : "#0f172a";
            badge.textContent = dm.label;

            const xAnchor = dm.kind === "km" ? -0.25 : 0.5;
            const yAnchor =
              dm.kind === "start" ? 1.45 : dm.kind === "end" ? -0.45 : 0.5;

            const overlay = new kakao.CustomOverlay({
              position: new kakao.LatLng(dm.point[0], dm.point[1]),
              content: badge,
              xAnchor,
              yAnchor,
              zIndex: isEndpoint ? 5 : 4,
            });
            overlay.setMap(map);
            objectsRef.current.push(overlay);
          });
        }
      });

      const viewKey = `${selectedRegionId}:${selectedCourseId}`;
      if (lastViewKeyRef.current !== viewKey) {
        lastViewKeyRef.current = viewKey;
        const activeCourse = courses.find(
          (c) => c.courseId === selectedCourseId
        );
        if (activeCourse && activeCourse.coordinates.length > 0) {
          const bounds = new kakao.LatLngBounds();
          activeCourse.coordinates.forEach(([lat, lng]) =>
            bounds.extend(new kakao.LatLng(lat, lng))
          );
          map.setBounds(bounds, 95, 130, 85, 130);
        }
      }
    } catch {
      onFallbackRef.current(
        "카카오맵 경로 표시 중 오류가 발생하여 기본 지도로 전환했습니다."
      );
    }
  }, [sdkReady, courses, selectedRegionId, selectedCourseId]);

  return (
    <div className="relative w-full h-[460px] sm:h-[530px] rounded-lg border border-[#e2e8f0] overflow-hidden bg-[#f8fafc]">
      <div
        ref={containerRef}
        className="w-full h-full"
        aria-label="카카오맵 야간 러닝 코스 지도"
      />
      {!sdkReady && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#f8fafc]/85 text-xs text-[#64748b]">
          카카오맵을 연결하는 중입니다 (최대 3초 대기)...
        </div>
      )}
    </div>
  );
}
