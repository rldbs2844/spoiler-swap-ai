"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import type { RegionConfig } from "@/lib/courses";
import type { TrafficStatus } from "@/lib/csvParser";

export type LeafletTileMode = "osm" | "satellite";

export interface MapCourseItem {
  regionId: string;
  regionLabel: string;
  courseId: string;
  courseName: string;
  distanceKm: number;
  pmAtHour: number;
  status: TrafficStatus;
  isWindCorridor: boolean;
  coordinates: [number, number][];
}

interface LeafletMapProps {
  tileMode?: LeafletTileMode;
  regions: RegionConfig[];
  courses: MapCourseItem[];
  selectedRegionId: string;
  selectedCourseId: string;
  onSelectCourse: (regionId: string, courseId: string) => void;
}

const STATUS_COLOR: Record<TrafficStatus, string> = {
  safe: "#16a34a",
  caution: "#d97706",
  danger: "#dc2626",
};

const STATUS_LABEL: Record<TrafficStatus, string> = {
  safe: "안전",
  caution: "주의",
  danger: "역전 정체 위험",
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

export default function LeafletMap({
  tileMode = "osm",
  regions,
  courses,
  selectedRegionId,
  selectedCourseId,
  onSelectCourse,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileGroupRef = useRef<L.LayerGroup | null>(null);
  const courseGroupRef = useRef<L.LayerGroup | null>(null);
  const lastViewKeyRef = useRef<string>("");
  const onSelectCourseRef = useRef(onSelectCourse);
  useEffect(() => {
    onSelectCourseRef.current = onSelectCourse;
  }, [onSelectCourse]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialRegion =
      regions.find((r) => r.id === selectedRegionId) ?? regions[0];

    const map = L.map(containerRef.current, {
      center: initialRegion.center,
      zoom: initialRegion.zoom,
      zoomControl: false,
    });

    // Put zoom control on top-right so top-left fixed course badge never collides
    L.control.zoom({ position: "topright" }).addTo(map);

    tileGroupRef.current = L.layerGroup().addTo(map);
    courseGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      tileGroupRef.current = null;
      courseGroupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const tileGroup = tileGroupRef.current;
    const el = containerRef.current;
    if (!map || !tileGroup || !el) return;

    tileGroup.clearLayers();
    el.classList.toggle("osm-muted", tileMode === "osm");

    if (tileMode === "satellite") {
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution:
            "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
          maxZoom: 19,
        }
      ).addTo(tileGroup);
    } else {
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(tileGroup);
    }
  }, [tileMode]);

  useEffect(() => {
    const map = mapRef.current;
    const group = courseGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    courses.forEach((course) => {
      const isSelected = course.courseId === selectedCourseId;
      const color = STATUS_COLOR[course.status];

      if (isSelected) {
        L.polyline(course.coordinates, {
          color: "#ffffff",
          weight: 9,
          opacity: 0.92,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(group);
      }

      const line = L.polyline(course.coordinates, {
        color,
        weight: isSelected ? 5.5 : 3.2,
        opacity: isSelected ? 0.96 : 0.62,
        dashArray: !isSelected ? "6 6" : undefined,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(group);

      line.bindTooltip(
        `${course.courseName} · ${course.pmAtHour.toFixed(1)} ㎍/㎥ (${
          STATUS_LABEL[course.status]
        })`,
        { sticky: true }
      );

      line.on("click", () => {
        onSelectCourseRef.current(course.regionId, course.courseId);
      });

      if (isSelected) {
        const distMarkers = getDistanceMarkers(course.coordinates);
        distMarkers.forEach((dm) => {
          const isEndpoint = dm.kind !== "km";
          L.circleMarker(dm.point, {
            radius: isEndpoint ? 6 : 4,
            color: "#ffffff",
            weight: 2,
            fillColor: color,
            fillOpacity: 1,
          }).addTo(group);

          const borderColor = isEndpoint ? color : "#cbd5e1";
          const textColor = isEndpoint ? color : "#0f172a";

          if (dm.kind === "start" || dm.kind === "end") {
            const transform =
              dm.kind === "start"
                ? "translate(-50%,calc(-100% - 10px))"
                : "translate(-50%,10px)";
            L.marker(dm.point, {
              interactive: false,
              zIndexOffset: 500,
              icon: L.divIcon({
                className: "",
                html: `<div class="km-marker-badge" style="display:inline-block;transform:${transform};border-color:${borderColor};color:${textColor};">${dm.label}</div>`,
                iconSize: [0, 0],
                iconAnchor: [0, 0],
              }),
            }).addTo(group);
          } else {
            L.marker(dm.point, {
              interactive: false,
              icon: L.divIcon({
                className: "",
                html: `<div class="km-marker-badge" style="border-color:${borderColor};color:${textColor};">${dm.label}</div>`,
                iconSize: [44, 18],
                iconAnchor: [-10, 9],
              }),
            }).addTo(group);
          }
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
        const bounds = L.latLngBounds(activeCourse.coordinates);
        map.fitBounds(bounds, {
          paddingTopLeft: [130, 95],
          paddingBottomRight: [130, 85],
          maxZoom: 14,
          animate: true,
        });
      } else {
        const reg = regions.find((r) => r.id === selectedRegionId);
        if (reg) map.setView(reg.center, reg.zoom, { animate: true });
      }
    }
  }, [courses, regions, selectedRegionId, selectedCourseId]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[460px] sm:h-[530px] rounded-lg border border-[#e2e8f0] overflow-hidden"
      aria-label="야간 러닝 코스 지도"
    />
  );
}
