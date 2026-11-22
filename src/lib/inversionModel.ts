import type { AirRecord } from "@/lib/csvParser";

export interface RegressionModelMetrics {
  sampleCount: number;
  rSquared: number;
  mae: number;
  weights: {
    intercept: number;
    pm14: number;
    afternoonSlope: number;
    windEvening: number;
    tempDrop: number;
  };
}

export interface StationPrediction {
  station: string;
  predictedPm22: number;
  actualPm14: number;
  inversionProbPct: number;
  topFactor: string;
  contributions: {
    label: string;
    value: number;
  }[];
}

function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[maxRow][col])) {
        maxRow = r;
      }
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];

    const pivot = Math.abs(M[col][col]) < 1e-9 ? 1e-9 : M[col][col];
    for (let j = col; j <= n; j++) M[col][j] /= pivot;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      for (let j = col; j <= n; j++) {
        M[r][j] -= factor * M[col][j];
      }
    }
  }

  return M.map((row) => row[n]);
}

interface TrainingSample {
  station: string;
  date: string;
  pm14: number;
  slope: number;
  wind: number;
  tempDrop: number;
  pm22: number;
}

function extractTrainingSamples(records: AirRecord[]): TrainingSample[] {
  const byKey = new Map<string, Map<number, AirRecord>>();
  for (const r of records) {
    const key = `${r.date}__${r.station}`;
    let hrMap = byKey.get(key);
    if (!hrMap) {
      hrMap = new Map<number, AirRecord>();
      byKey.set(key, hrMap);
    }
    hrMap.set(r.hour, r);
  }

  const samples: TrainingSample[] = [];
  for (const [key, hrMap] of byKey.entries()) {
    const r14 = hrMap.get(14);
    const r22 = hrMap.get(22);
    if (!r14 || !r22) continue;

    const r18 = hrMap.get(18);
    const r21 = hrMap.get(21);
    const [date, station] = key.split("__");

    const slope = r18 ? r18.pm25 - r14.pm25 : (r22.pm25 - r14.pm25) * 0.45;
    const wind = r21?.windSpeed ?? r22.windSpeed ?? r14.windSpeed ?? 1.5;
    const tempDrop =
      r14.temp !== null && r22.temp !== null
        ? Math.max(0, r14.temp - r22.temp)
        : 6.0;

    samples.push({
      station,
      date,
      pm14: r14.pm25,
      slope,
      wind,
      tempDrop,
      pm22: r22.pm25,
    });
  }
  return samples;
}

export function trainAndPredictInversion(records: AirRecord[]): {
  model: RegressionModelMetrics;
  predictions: Map<string, StationPrediction>;
} {
  const samples = extractTrainingSamples(records);
  const p = 5; // [1, pm14, slope, wind, tempDrop]
  const lambda = 1.5; // Ridge regularization for numerical stability on small datasets

  const XtX = Array.from({ length: p }, () => Array(p).fill(0));
  const Xty = Array(p).fill(0);

  if (samples.length < 3) {
    const defaultWeights = {
      intercept: 4.5,
      pm14: 0.9,
      afternoonSlope: 0.75,
      windEvening: -4.2,
      tempDrop: 0.85,
    };
    return {
      model: {
        sampleCount: samples.length,
        rSquared: 0.0,
        mae: 0.0,
        weights: defaultWeights,
      },
      predictions: new Map(),
    };
  }

  for (const s of samples) {
    const x = [1, s.pm14, s.slope, s.wind, s.tempDrop];
    for (let i = 0; i < p; i++) {
      Xty[i] += x[i] * s.pm22;
      for (let j = 0; j < p; j++) {
        XtX[i][j] += x[i] * x[j];
      }
    }
  }

  // Apply Ridge penalty to non-intercept terms
  for (let i = 1; i < p; i++) {
    XtX[i][i] += lambda;
  }

  const w = solveLinearSystem(XtX, Xty);

  // Evaluate R^2 and MAE on dataset
  const meanY = samples.reduce((acc, s) => acc + s.pm22, 0) / samples.length;
  let ssTot = 0;
  let ssRes = 0;
  let absErr = 0;

  for (const s of samples) {
    const pred =
      w[0] +
      w[1] * s.pm14 +
      w[2] * s.slope +
      w[3] * s.wind +
      w[4] * s.tempDrop;
    ssTot += (s.pm22 - meanY) ** 2;
    ssRes += (s.pm22 - pred) ** 2;
    absErr += Math.abs(s.pm22 - pred);
  }

  const rSquared =
    ssTot > 1e-6 ? Math.max(0, Math.min(0.99, 1 - ssRes / ssTot)) : 0;
  const mae = samples.length > 0 ? absErr / samples.length : 0;

  // Aggregate per-station prediction
  const byStation = new Map<string, TrainingSample[]>();
  for (const s of samples) {
    const arr = byStation.get(s.station) ?? [];
    arr.push(s);
    byStation.set(s.station, arr);
  }

  const predictions = new Map<string, StationPrediction>();
  for (const [station, arr] of byStation.entries()) {
    const avgPm14 = arr.reduce((a, b) => a + b.pm14, 0) / arr.length;
    const avgSlope = arr.reduce((a, b) => a + b.slope, 0) / arr.length;
    const avgWind = arr.reduce((a, b) => a + b.wind, 0) / arr.length;
    const avgTempDrop = arr.reduce((a, b) => a + b.tempDrop, 0) / arr.length;

    const rawPred =
      w[0] +
      w[1] * avgPm14 +
      w[2] * avgSlope +
      w[3] * avgWind +
      w[4] * avgTempDrop;
    const predictedPm22 = Math.max(5.0, Math.round(rawPred * 10) / 10);

    // Inversion probability using logistic function over predicted delta + wind stagnation
    const predDelta = predictedPm22 - avgPm14;
    const windPenalty = avgWind < 1.2 ? (1.2 - avgWind) * 1.4 : -0.6;
    const logit = predDelta * 0.22 + windPenalty;
    const prob = Math.round((1 / (1 + Math.exp(-logit))) * 100);

    const contributions = [
      {
        label: "오후 농도 추세(14→18시)",
        value: Math.round(w[2] * avgSlope * 10) / 10,
      },
      {
        label: "야간 풍속 효과",
        value: Math.round(w[3] * avgWind * 10) / 10,
      },
      {
        label: "일몰 기온 하강폭",
        value: Math.round(w[4] * avgTempDrop * 10) / 10,
      },
    ];

    const sortedContrib = [...contributions].sort(
      (a, b) => Math.abs(b.value) - Math.abs(a.value)
    );
    const top = sortedContrib[0];
    const topFactor = top
      ? `${top.label} (${top.value >= 0 ? "+" : ""}${top.value.toFixed(1)} ㎍/㎥)`
      : "기준 추세";

    predictions.set(station, {
      station,
      predictedPm22,
      actualPm14: Math.round(avgPm14 * 10) / 10,
      inversionProbPct: Math.max(3, Math.min(98, prob)),
      topFactor,
      contributions,
    });
  }

  return {
    model: {
      sampleCount: samples.length,
      rSquared: Math.round(rSquared * 1000) / 1000,
      mae: Math.round(mae * 10) / 10,
      weights: {
        intercept: Math.round(w[0] * 100) / 100,
        pm14: Math.round(w[1] * 100) / 100,
        afternoonSlope: Math.round(w[2] * 100) / 100,
        windEvening: Math.round(w[3] * 100) / 100,
        tempDrop: Math.round(w[4] * 100) / 100,
      },
    },
    predictions,
  };
}
