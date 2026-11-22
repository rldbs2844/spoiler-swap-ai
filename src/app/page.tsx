"use client";

import { useMemo, useState } from "react";
import { MapPin, BarChart2, Radio, Database } from "lucide-react";
import CourseMapTab from "@/components/CourseMapTab";
import DataAnalysisTab from "@/components/DataAnalysisTab";
import {
  analyzeRecords,
  decodeCsvBuffer,
  generateDefaultCsvText,
  parseCsvRecords,
  type AirRecord,
} from "@/lib/csvParser";
import { trainAndPredictInversion } from "@/lib/inversionModel";
import { fetchLiveKoreanAirRecords } from "@/lib/liveWeatherApi";

const DEFAULT_CSV_TEXT = generateDefaultCsvText();
const DEFAULT_PARSED = parseCsvRecords(DEFAULT_CSV_TEXT);

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"map" | "analysis">("map");
  const [records, setRecords] = useState<AirRecord[]>(DEFAULT_PARSED.records);
  const [fileName, setFileName] = useState<string>("data.csv (기본 샘플)");
  const [isSample, setIsSample] = useState<boolean>(true);
  const [dataMode, setDataMode] = useState<"csv" | "live">("csv");
  const [liveLoading, setLiveLoading] = useState<boolean>(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [encodingInfo, setEncodingInfo] = useState<string>("UTF-8");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const analysis = useMemo(() => analyzeRecords(records), [records]);
  const regression = useMemo(
    () => trainAndPredictInversion(records),
    [records]
  );

  const handleUploadFile = (file: File) => {
    const reader = new FileReader();
    reader.onerror = () => {
      setUploadError("파일을 읽는 중 오류가 발생했습니다. CSV 형식을 확인해 주세요.");
    };
    reader.onload = (ev) => {
      const buffer = ev.target?.result;
      if (!(buffer instanceof ArrayBuffer)) return;
      const { text, encoding } = decodeCsvBuffer(buffer);
      const parsed = parseCsvRecords(text);
      if (parsed.error || parsed.records.length === 0) {
        setUploadError(parsed.error ?? "CSV 데이터를 읽을 수 없습니다.");
        return;
      }
      setUploadError(null);
      setLiveError(null);
      setDataMode("csv");
      setRecords(parsed.records);
      setFileName(file.name);
      setIsSample(false);
      setEncodingInfo(encoding);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDownloadSample = () => {
    const blob = new Blob(["\uFEFF" + DEFAULT_CSV_TEXT], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "data.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleResetSample = () => {
    setDataMode("csv");
    setLiveError(null);
    setRecords(DEFAULT_PARSED.records);
    setFileName("data.csv (기본 샘플)");
    setIsSample(true);
    setEncodingInfo("UTF-8");
    setUploadError(null);
  };

  const handleSwitchToLive = async () => {
    setLiveLoading(true);
    setLiveError(null);
    try {
      const { records: liveRecords, fetchedAt } =
        await fetchLiveKoreanAirRecords();
      setRecords(liveRecords);
      setDataMode("live");
      setFileName(`Open-Meteo 실시간 관측 (${fetchedAt} 갱신)`);
      setIsSample(false);
      setEncodingInfo("실시간 JSON");
      setUploadError(null);
    } catch {
      // Auto-fallback cleanly back to data.csv mode on API failure
      setDataMode("csv");
      if (records.length === 0) {
        setRecords(DEFAULT_PARSED.records);
        setFileName("data.csv (기본 샘플)");
        setIsSample(true);
        setEncodingInfo("UTF-8");
      }
      setLiveError(
        "실시간 대기·기상 API 연결에 실패해 data.csv 기준 데이터로 자동 복구했습니다."
      );
    } finally {
      setLiveLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-[#0f172a]">
      {/* Top Navigation Header */}
      <header className="bg-[#ffffff] border-b border-[#e2e8f0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-[#0f172a]">
                나이트 러너 안전 코스 안내
              </h1>
              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#f8fafc] text-[#475569] border border-[#e2e8f0]">
                {fileName}
              </span>
            </div>
            <p className="text-xs text-[#64748b] mt-0.5">
              야간 대기 역전층(14시 vs 22시 PM2.5) 분석 기반 권역별 러닝 코스 환경 정보
            </p>
            {liveError && (
              <div className="mt-1.5 inline-flex items-center gap-2 rounded border border-[#fde68a] bg-[#fffbeb] px-2.5 py-1 text-xs text-[#b45309]">
                <span>{liveError}</span>
                <button
                  type="button"
                  onClick={() => setLiveError(null)}
                  className="font-semibold underline"
                >
                  닫기
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
            {/* Data Source Mode Toggle: data.csv vs Live Open-Meteo */}
            <div className="inline-flex rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-0.5 text-xs">
              <button
                type="button"
                onClick={handleResetSample}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded font-medium transition ${
                  dataMode === "csv"
                    ? "bg-[#ffffff] text-[#0f172a] border border-[#e2e8f0]"
                    : "text-[#64748b] hover:text-[#0f172a] border border-transparent"
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                data.csv 기준
              </button>
              <button
                type="button"
                disabled={liveLoading}
                onClick={handleSwitchToLive}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded font-medium transition ${
                  dataMode === "live"
                    ? "bg-[#ffffff] text-[#0f172a] border border-[#e2e8f0]"
                    : "text-[#64748b] hover:text-[#0f172a] border border-transparent"
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                {liveLoading ? "수신 중..." : "실시간 대기·기상"}
              </button>
            </div>

            {/* 2 Top Tabs */}
            <nav
              className="inline-flex rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-0.5"
              aria-label="주요 화면 탭"
            >
              <button
                type="button"
                onClick={() => setActiveTab("map")}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-semibold transition ${
                  activeTab === "map"
                    ? "bg-[#ffffff] text-[#0f172a] border border-[#e2e8f0] shadow-xs"
                    : "text-[#64748b] hover:text-[#0f172a] border border-transparent"
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                코스 지도
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("analysis")}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-semibold transition ${
                  activeTab === "analysis"
                    ? "bg-[#ffffff] text-[#0f172a] border border-[#e2e8f0] shadow-xs"
                    : "text-[#64748b] hover:text-[#0f172a] border border-transparent"
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                데이터 분석
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5">
        {activeTab === "map" ? (
          <CourseMapTab
            stationSummaries={analysis.stationSummaries}
            modelMetrics={regression.model}
            predictions={regression.predictions}
          />
        ) : (
          <DataAnalysisTab
            fileName={fileName}
            isSample={isSample}
            encodingInfo={encodingInfo}
            totalRows={records.length}
            stationSummaries={analysis.stationSummaries}
            inversionPairs={analysis.inversionPairs}
            allPairs={analysis.allPairs}
            modelMetrics={regression.model}
            uploadError={uploadError}
            onUploadFile={handleUploadFile}
            onDownloadSample={handleDownloadSample}
            onResetSample={handleResetSample}
          />
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-[#e2e8f0] bg-[#ffffff] py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[11px] text-[#64748b]">
          <span>
            판별 기준: 낮(14시) 평균 PM2.5 &lt; 밤(22시) 평균 PM2.5 역전 조건 및 야간 풍속 정체 여부
          </span>
          <span>
            지도: 카카오맵 · OpenStreetMap · Esri 위성 | 대기·기상: data.csv · Open-Meteo
          </span>
        </div>
      </footer>
    </div>
  );
}
