export interface AirRecord {
  date: string;
  station: string;
  hour: number;
  pm25: number;
  pm10: number | null;
  windSpeed: number | null;
  temp: number | null;
  humidity: number | null;
}

export interface StationSummary {
  station: string;
  pm14: number;
  pm22: number;
  diff: number;
  isInversion: boolean;
  wind14: number | null;
  wind22: number | null;
  hourlyPm25: Record<number, number>;
  hourlyWind: Record<number, number | null>;
}

export interface InversionPair {
  date: string;
  station: string;
  pm14: number;
  pm22: number;
  diff: number;
  wind22: number | null;
  isInversion: boolean;
}

export type TrafficStatus = "safe" | "caution" | "danger";

export function generateDefaultCsvText(): string {
  const stations: Record<
    string,
    {
      base_day: number;
      inversion_boost: number;
      wind_day: number;
      wind_night: number;
      temp_day: number;
      temp_night: number;
      daily_factor: number[];
    }
  > = {
    동두천: {
      base_day: 21.0,
      inversion_boost: 25.0,
      wind_day: 2.3,
      wind_night: 0.5,
      temp_day: 13.5,
      temp_night: 3.5,
      daily_factor: [1.05, 0.92, 1.15, 1.25, 1.1, 0.88, 1.22],
    },
    의정부: {
      base_day: 22.0,
      inversion_boost: 21.0,
      wind_day: 2.4,
      wind_night: 0.6,
      temp_day: 13.8,
      temp_night: 4.2,
      daily_factor: [1.02, 0.94, 1.14, 1.2, 1.06, 0.9, 1.18],
    },
    춘천: {
      base_day: 19.5,
      inversion_boost: 22.5,
      wind_day: 2.1,
      wind_night: 0.6,
      temp_day: 12.8,
      temp_night: 2.8,
      daily_factor: [0.98, 1.08, 1.2, 1.12, 0.95, 1.05, 1.18],
    },
    대구: {
      base_day: 24.0,
      inversion_boost: 15.5,
      wind_day: 2.4,
      wind_night: 0.8,
      temp_day: 16.0,
      temp_night: 6.5,
      daily_factor: [1.02, 0.96, 1.12, 1.08, 0.9, 1.14, 1.1],
    },
    성남: {
      base_day: 23.0,
      inversion_boost: 14.0,
      wind_day: 2.2,
      wind_night: 0.8,
      temp_day: 14.0,
      temp_night: 5.2,
      daily_factor: [1.0, 0.96, 1.1, 1.16, 0.95, 1.04, 1.12],
    },
    수원: {
      base_day: 23.5,
      inversion_boost: 11.5,
      wind_day: 2.3,
      wind_night: 0.9,
      temp_day: 14.2,
      temp_night: 5.8,
      daily_factor: [1.0, 0.95, 1.1, 1.14, 0.92, 1.06, 1.08],
    },
    고양: {
      base_day: 24.5,
      inversion_boost: 5.5,
      wind_day: 2.7,
      wind_night: 1.4,
      temp_day: 14.1,
      temp_night: 6.5,
      daily_factor: [0.97, 1.04, 0.95, 1.1, 0.96, 1.02, 1.04],
    },
    광주: {
      base_day: 22.5,
      inversion_boost: 4.5,
      wind_day: 2.7,
      wind_night: 1.4,
      temp_day: 16.2,
      temp_night: 7.5,
      daily_factor: [0.96, 1.08, 0.94, 1.12, 0.9, 1.05, 1.04],
    },
    대전: {
      base_day: 23.0,
      inversion_boost: 3.0,
      wind_day: 2.6,
      wind_night: 1.5,
      temp_day: 15.0,
      temp_night: 6.8,
      daily_factor: [0.95, 1.12, 0.88, 1.05, 1.15, 0.92, 1.02],
    },
    서울잠실: {
      base_day: 25.5,
      inversion_boost: 2.0,
      wind_day: 2.6,
      wind_night: 1.6,
      temp_day: 14.6,
      temp_night: 7.2,
      daily_factor: [0.96, 1.02, 0.94, 1.12, 0.98, 1.04, 1.0],
    },
    서울: {
      base_day: 26.5,
      inversion_boost: -3.5,
      wind_day: 2.8,
      wind_night: 2.1,
      temp_day: 14.5,
      temp_night: 7.5,
      daily_factor: [0.96, 1.04, 0.92, 1.08, 0.95, 1.02, 0.98],
    },
    인천: {
      base_day: 24.0,
      inversion_boost: -7.0,
      wind_day: 3.5,
      wind_night: 2.9,
      temp_day: 14.0,
      temp_night: 8.5,
      daily_factor: [0.95, 1.02, 0.92, 1.04, 0.96, 0.94, 0.98],
    },
    부산: {
      base_day: 22.0,
      inversion_boost: -9.0,
      wind_day: 3.4,
      wind_night: 3.2,
      temp_day: 17.5,
      temp_night: 11.5,
      daily_factor: [0.94, 1.02, 0.9, 0.98, 1.05, 0.92, 0.95],
    },
    제주: {
      base_day: 15.5,
      inversion_boost: -6.5,
      wind_day: 4.5,
      wind_night: 4.1,
      temp_day: 18.0,
      temp_night: 12.8,
      daily_factor: [0.92, 0.98, 0.88, 1.02, 0.94, 0.9, 0.96],
    },
  };

  const start = new Date(Date.UTC(2026, 10, 15));
  const lines = ["date,station,hour,pm25,pm10,wind_speed,temp,humidity"];

  for (let dIdx = 0; dIdx < 7; dIdx++) {
    const dt = new Date(start.getTime() + dIdx * 86400000);
    const dateStr = dt.toISOString().slice(0, 10);

    for (const [stName, cfg] of Object.entries(stations)) {
      const df = cfg.daily_factor[dIdx];
      const windGustDay = 0.65 * Math.sin(dIdx * 1.9 + stName.length * 0.7);
      const coolVar = 1.4 * Math.cos(dIdx * 1.3 + stName.charCodeAt(0) * 0.1);
      const seoulEvent = stName === "서울" && dIdx === 3 ? 7.5 : 0.0;
      const daejeonEvent =
        stName === "대전" ? (dIdx === 1 || dIdx === 4 ? 6.0 : -3.5) : 0.0;

      for (let hour = 0; hour < 24; hour++) {
        const morningRush = 4.0 * Math.exp(-((hour - 9) ** 2) / 6.0);
        const dayMixing = -2.5 * Math.exp(-((hour - 14) ** 2) / 5.0);
        const nightCurve =
          Math.exp(-((hour - 22) ** 2) / 10.0) +
          0.55 * Math.exp(-((hour - 2) ** 2) / 12.0);
        const windEffect = hour >= 18 ? -4.2 * windGustDay * nightCurve : 0;
        const coolingTrap = hour >= 18 ? 1.15 * coolVar * nightCurve : 0;
        const boost = cfg.inversion_boost + seoulEvent + daejeonEvent;
        const ripple = 0.8 * Math.sin(dIdx * 1.7 + hour * 0.6 + stName.length);

        let pm25 =
          boost >= 0
            ? cfg.base_day * df +
              morningRush +
              dayMixing +
              boost * df * nightCurve +
              windEffect +
              coolingTrap +
              ripple
            : cfg.base_day * df +
              morningRush +
              boost * nightCurve +
              windEffect +
              coolingTrap +
              ripple;

        pm25 = Math.max(6.0, Math.round(pm25 * 10) / 10);
        const pm10 = Math.round((pm25 * 1.65 + 4.5) * 10) / 10;

        const windT = 0.5 + 0.5 * Math.cos(((hour - 14) * Math.PI) / 12.0);
        const windSpeed =
          Math.round(
            Math.max(
              0.2,
              cfg.wind_night +
                (cfg.wind_day - cfg.wind_night) * windT +
                windGustDay * (1 - windT * 0.5) +
                0.1 * Math.sin(dIdx + hour)
            ) * 10
          ) / 10;
        const temp =
          Math.round(
            (cfg.temp_night -
              coolVar * (1 - windT) +
              (cfg.temp_day - (cfg.temp_night - coolVar)) * windT +
              0.4 * Math.cos(dIdx)) *
              10
          ) / 10;
        const humidity = Math.round(
          Math.min(
            95,
            Math.max(35, 82 - 28 * windT + (stName === "춘천" ? 8 : 0))
          )
        );

        lines.push(
          `${dateStr},${stName},${hour},${pm25.toFixed(1)},${pm10.toFixed(
            1
          )},${windSpeed.toFixed(1)},${temp.toFixed(1)},${humidity}`
        );
      }
    }
  }
  return lines.join("\n");
}

export function decodeCsvBuffer(buffer: ArrayBuffer): {
  text: string;
  encoding: "UTF-8" | "EUC-KR";
} {
  const utf8Text = new TextDecoder("utf-8").decode(buffer);
  if (!utf8Text.includes("\uFFFD")) {
    return { text: utf8Text, encoding: "UTF-8" };
  }
  try {
    const eucText = new TextDecoder("euc-kr").decode(buffer);
    return { text: eucText, encoding: "EUC-KR" };
  } catch {
    return { text: utf8Text, encoding: "UTF-8" };
  }
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((ch === "," || ch === "\t") && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseDateAndHour(
  rawDate: string,
  rawHour?: string
): { date: string; hour: number } | null {
  const s = String(rawDate || "").trim();
  let datePart = s;
  let hourNum =
    rawHour !== undefined && rawHour !== ""
      ? Number(String(rawHour).replace(/[^0-9.-]/g, ""))
      : NaN;

  const m1 = s.match(/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\s+(\d{1,2})(?::\d{2})?/);
  const m2 = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})$/);
  if (m1) {
    datePart = m1[1].replace(/[/.]/g, "-");
    if (Number.isNaN(hourNum)) hourNum = Number(m1[2]);
  } else if (m2) {
    datePart = `${m2[1]}-${m2[2]}-${m2[3]}`;
    if (Number.isNaN(hourNum)) hourNum = Number(m2[4]);
  } else {
    datePart = s.replace(/[/.]/g, "-").slice(0, 10);
  }

  if (!datePart || Number.isNaN(hourNum) || hourNum < 0 || hourNum > 24) {
    return null;
  }
  if (hourNum === 24) hourNum = 0;
  return { date: datePart, hour: Math.floor(hourNum) };
}

export function parseCsvRecords(text: string): {
  records: AirRecord[];
  headers: string[];
  error?: string;
} {
  const clean = text.replace(/^\uFEFF/, "").trim();
  if (!clean) return { records: [], headers: [], error: "빈 파일입니다." };

  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return {
      records: [],
      headers: [],
      error: "헤더와 데이터 행이 최소 2줄 이상 필요합니다.",
    };
  }

  const headers = splitCsvLine(lines[0]);
  const findIndex = (patterns: RegExp[]) => {
    for (const p of patterns) {
      const idx = headers.findIndex((h) => p.test(h.trim()));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const iDate = findIndex([
    /^date$/i,
    /날짜/,
    /측정일자/,
    /일자/,
    /측정일시/,
    /datetime/i,
    /time/i,
    /일시/,
  ]);
  const iHour = findIndex([/^hour$/i, /^hr$/i, /시간/, /^시$/]);
  const iStation = findIndex([
    /^station$/i,
    /측정소/,
    /지점/,
    /지역/,
    /구분/,
    /city/i,
    /관측소/,
  ]);
  const iPm25 = findIndex([
    /^pm2\.?5$/i,
    /초미세먼지/,
    /pm25/i,
    /pm_25/i,
    /미세먼지/,
    /^pm10$/i,
  ]);
  const iPm10 = findIndex([/^pm10$/i, /미세먼지/]);
  const iWind = findIndex([/wind/i, /풍속/, /바람/]);
  const iTemp = findIndex([/temp/i, /기온/, /온도/]);
  const iHumidity = findIndex([/humid/i, /습도/]);

  if (iDate === -1 || iStation === -1 || iPm25 === -1) {
    return {
      records: [],
      headers,
      error:
        "필수 컬럼(날짜, 측정소, PM2.5)을 찾을 수 없습니다. CSV 헤더명을 확인해 주세요.",
    };
  }

  const records: AirRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < 2) continue;

    const dh = parseDateAndHour(cols[iDate], iHour !== -1 ? cols[iHour] : "");
    const station = String(cols[iStation] || "").trim();
    const pm25 = Number(String(cols[iPm25] || "").replace(/[^0-9.-]/g, ""));
    if (!dh || !station || Number.isNaN(pm25)) continue;

    const toOptNum = (idx: number) => {
      if (idx === -1 || cols[idx] === undefined || cols[idx] === "") return null;
      const val = Number(String(cols[idx]).replace(/[^0-9.-]/g, ""));
      return Number.isNaN(val) ? null : val;
    };

    records.push({
      date: dh.date,
      hour: dh.hour,
      station,
      pm25,
      pm10: iPm10 !== -1 && iPm10 !== iPm25 ? toOptNum(iPm10) : null,
      windSpeed: toOptNum(iWind),
      temp: toOptNum(iTemp),
      humidity: toOptNum(iHumidity),
    });
  }

  if (!records.length) {
    return {
      records: [],
      headers,
      error: "유효한 숫자 형식의 PM2.5 행을 파싱하지 못했습니다.",
    };
  }

  return { records, headers };
}

export function analyzeRecords(records: AirRecord[]): {
  dates: string[];
  stations: string[];
  stationSummaries: StationSummary[];
  inversionPairs: InversionPair[];
  allPairs: InversionPair[];
} {
  const dates = Array.from(new Set(records.map((r) => r.date))).sort();
  const stations = Array.from(new Set(records.map((r) => r.station)));

  const stationSummaries: StationSummary[] = stations.map((station) => {
    const stRecs = records.filter((r) => r.station === station);
    const hourlyPm25: Record<number, number> = {};
    const hourlyWind: Record<number, number | null> = {};

    for (let h = 0; h < 24; h++) {
      const sub = stRecs.filter((r) => r.hour === h);
      if (sub.length > 0) {
        hourlyPm25[h] =
          Math.round(
            (sub.reduce((acc, r) => acc + r.pm25, 0) / sub.length) * 10
          ) / 10;
        const windSub = sub.filter((r) => r.windSpeed !== null);
        hourlyWind[h] =
          windSub.length > 0
            ? Math.round(
                (windSub.reduce((acc, r) => acc + (r.windSpeed ?? 0), 0) /
                  windSub.length) *
                  10
              ) / 10
            : null;
      }
    }

    const pm14 = hourlyPm25[14] ?? 0;
    const pm22 = hourlyPm25[22] ?? 0;
    const diff = Math.round((pm22 - pm14) * 10) / 10;
    return {
      station,
      pm14,
      pm22,
      diff,
      isInversion: pm14 < pm22,
      wind14: hourlyWind[14] ?? null,
      wind22: hourlyWind[22] ?? null,
      hourlyPm25,
      hourlyWind,
    };
  });

  const allPairs: InversionPair[] = [];
  for (const date of dates) {
    for (const station of stations) {
      const r14 = records.find(
        (r) => r.date === date && r.station === station && r.hour === 14
      );
      const r22 = records.find(
        (r) => r.date === date && r.station === station && r.hour === 22
      );
      if (r14 && r22) {
        const diff = Math.round((r22.pm25 - r14.pm25) * 10) / 10;
        allPairs.push({
          date,
          station,
          pm14: r14.pm25,
          pm22: r22.pm25,
          diff,
          wind22: r22.windSpeed,
          isInversion: r14.pm25 < r22.pm25,
        });
      }
    }
  }

  const inversionPairs = allPairs
    .filter((p) => p.isInversion)
    .sort((a, b) => b.diff - a.diff);

  return { dates, stations, stationSummaries, inversionPairs, allPairs };
}

export function classifyCourseStatus(
  pmAtHour: number,
  isInversion: boolean,
  diff: number,
  hour: number
): TrafficStatus {
  const nightWindow = hour >= 19;
  if (pmAtHour >= 35 || (nightWindow && isInversion && diff >= 5 && pmAtHour >= 30)) {
    return "danger";
  }
  if (pmAtHour >= 24 || (nightWindow && isInversion && diff > 0)) {
    return "caution";
  }
  return "safe";
}
