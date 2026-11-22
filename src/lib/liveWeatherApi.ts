import type { AirRecord } from "@/lib/csvParser";
import { REGIONS } from "@/lib/courses";

interface OpenMeteoAirResponse {
  hourly?: {
    time?: string[];
    pm2_5?: (number | null)[];
    pm10?: (number | null)[];
  };
}

interface OpenMeteoWeatherResponse {
  hourly?: {
    time?: string[];
    wind_speed_10m?: (number | null)[];
    temperature_2m?: (number | null)[];
    relative_humidity_2m?: (number | null)[];
  };
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const id = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    window.clearTimeout(id);
  }
}

export async function fetchLiveKoreanAirRecords(): Promise<{
  records: AirRecord[];
  fetchedAt: string;
}> {
  const allRecords: AirRecord[] = [];
  const batchSize = 4;

  for (let i = 0; i < REGIONS.length; i += batchSize) {
    const batch = REGIONS.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      batch.map(async (region) => {
        const [lat, lon] = region.center;
        const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm2_5,pm10&timezone=Asia%2FSeoul&past_days=2&forecast_days=1`;
        const wxUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m&wind_speed_unit=ms&timezone=Asia%2FSeoul&past_days=2&forecast_days=1`;

        const [aqJson, wxJson] = await Promise.all([
          fetchJsonWithTimeout<OpenMeteoAirResponse>(aqUrl),
          fetchJsonWithTimeout<OpenMeteoWeatherResponse>(wxUrl),
        ]);

        const times = aqJson.hourly?.time ?? [];
        const pm25Arr = aqJson.hourly?.pm2_5 ?? [];
        const pm10Arr = aqJson.hourly?.pm10 ?? [];
        const wxTimes = wxJson.hourly?.time ?? [];
        const windArr = wxJson.hourly?.wind_speed_10m ?? [];
        const tempArr = wxJson.hourly?.temperature_2m ?? [];
        const humArr = wxJson.hourly?.relative_humidity_2m ?? [];

        const wxIndex = new Map<string, number>();
        wxTimes.forEach((t, idx) => wxIndex.set(t, idx));

        const regionRecords: AirRecord[] = [];
        times.forEach((isoTime, idx) => {
          const pm25 = pm25Arr[idx];
          if (pm25 === null || pm25 === undefined) return;
          const [date, timePart] = isoTime.split("T");
          const hour = Number((timePart || "0").slice(0, 2));
          if (!date || Number.isNaN(hour)) return;

          const wIdx = wxIndex.get(isoTime);
          const wind =
            wIdx !== undefined &&
            windArr[wIdx] !== null &&
            windArr[wIdx] !== undefined
              ? Math.round((windArr[wIdx] as number) * 10) / 10
              : null;
          const temp =
            wIdx !== undefined &&
            tempArr[wIdx] !== null &&
            tempArr[wIdx] !== undefined
              ? Math.round((tempArr[wIdx] as number) * 10) / 10
              : null;
          const hum =
            wIdx !== undefined &&
            humArr[wIdx] !== null &&
            humArr[wIdx] !== undefined
              ? Math.round(humArr[wIdx] as number)
              : null;

          regionRecords.push({
            date,
            station: region.stationName,
            hour,
            pm25: Math.round(pm25 * 10) / 10,
            pm10:
              pm10Arr[idx] !== null && pm10Arr[idx] !== undefined
                ? Math.round((pm10Arr[idx] as number) * 10) / 10
                : null,
            windSpeed: wind,
            temp,
            humidity: hum,
          });
        });

        return regionRecords;
      })
    );

    settled.forEach((res) => {
      if (res.status === "fulfilled") {
        allRecords.push(...res.value);
      }
    });
  }

  if (allRecords.length === 0) {
    throw new Error("실시간 대기·기상 API 응답을 가져오지 못했습니다.");
  }

  return {
    records: allRecords,
    fetchedAt: new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}
