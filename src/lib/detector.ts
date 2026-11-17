import {
  CAT_MEMES,
  DEFAULT_THRESHOLD,
  DEFAULT_WATCHLIST,
  SPOILER_TRIGGERS
} from './constants';
import type { EvaluationResult, ShortItem, SpoilerTrigger } from './types';

export function normalizeText(str: string): string {
  return (str || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function matchWatchlist(text: string, watchlist: string[] = DEFAULT_WATCHLIST): string[] {
  const norm = normalizeText(text);
  const compact = norm.replace(/\s+/g, '');
  return watchlist.filter((kw) => {
    const kNorm = normalizeText(kw);
    const kCompact = kNorm.replace(/\s+/g, '');
    return Boolean(kNorm) && (norm.includes(kNorm) || compact.includes(kCompact));
  });
}

export function matchTriggers(
  text: string,
  triggers: SpoilerTrigger[] = SPOILER_TRIGGERS
): { hits: string[]; weight: number } {
  const norm = normalizeText(text);
  const hits: string[] = [];
  let sum = 0;

  for (const item of triggers) {
    if (norm.includes(item.word)) {
      hits.push(item.word);
      sum += item.weight;
    }
  }
  return { hits, weight: Math.min(0.65, sum) };
}

export interface EvaluateOptions {
  watchlist?: string[];
  threshold?: number;
  triggers?: SpoilerTrigger[];
}

/**
 * 4-Stage Multimodal Spoiler Detection Pipeline
 * Preserves the exact scoring formula and JSON output schema.
 */
export function evaluateShort(
  shortItem: Partial<ShortItem>,
  options: EvaluateOptions = {}
): EvaluationResult {
  const watchlist = Array.isArray(options.watchlist) ? options.watchlist : DEFAULT_WATCHLIST;
  const threshold = typeof options.threshold === 'number' ? options.threshold : DEFAULT_THRESHOLD;
  const triggers = Array.isArray(options.triggers) ? options.triggers : SPOILER_TRIGGERS;

  const safeId = String(shortItem.id || 'unknown_0');
  const safeChannel = shortItem.channel || '@unknown';
  const title = shortItem.title || '';
  const ocr = shortItem.ocr || '';
  const stt = shortItem.stt || '';

  const combinedText = `${title} ${ocr} ${stt}`;

  // Stage 1: Pre-fetch Metadata
  const metaEntities = matchWatchlist(title, watchlist);
  const metaTriggers = matchTriggers(title, triggers);
  const s1Score = Math.min(1, (metaEntities.length > 0 ? 0.35 : 0) + metaTriggers.weight * 0.85);
  const s1Ms = 14 + (title.length % 11);

  // Stage 2: On-Device OCR
  const ocrEntities = matchWatchlist(ocr, watchlist);
  const ocrTriggers = matchTriggers(ocr, triggers);
  const s2Score = Math.min(1, (ocrEntities.length > 0 ? 0.25 : 0) + ocrTriggers.weight * 1.15);
  const s2Ms = 38 + (ocr.length % 19);

  // Stage 3: 2s Lightweight STT
  const sttEntities = matchWatchlist(stt, watchlist);
  const sttTriggers = matchTriggers(stt, triggers);
  const s3Score = Math.min(1, (sttEntities.length > 0 ? 0.25 : 0) + sttTriggers.weight * 1.15);
  const s3Ms = 42 + (stt.length % 17);

  // Stage 4: Knowledge Graph + KoELECTRA Fusion
  const allEntities = Array.from(new Set(matchWatchlist(combinedText, watchlist)));
  const allTriggers = Array.from(
    new Set([...metaTriggers.hits, ...ocrTriggers.hits, ...sttTriggers.hits])
  );

  let kgBonus = 0;
  if (allEntities.length > 0 && allTriggers.length > 0) {
    kgBonus = 0.26 + Math.min(0.18, (allTriggers.length - 1) * 0.06);
  } else if (allEntities.length > 0) {
    kgBonus = 0.08;
  }

  const rawCombined = s1Score * 0.28 + s2Score * 0.32 + s3Score * 0.28 + kgBonus;
  const finalScore = Number(Math.min(0.99, Math.max(0.02, rawCombined)).toFixed(2));
  const s4Ms = 18 + allTriggers.length * 3;
  const totalLatencyMs = s1Ms + s2Ms + s3Ms + s4Ms;

  const isSpoiler = finalScore >= threshold;
  const memeIdx =
    (safeId.charCodeAt(safeId.length - 1) + allTriggers.length) % CAT_MEMES.length;
  const chosenMeme = CAT_MEMES[memeIdx] || CAT_MEMES[0];

  return {
    video_id: safeId,
    channel: safeChannel,
    latency_ms: totalLatencyMs,
    threshold,
    confidence_score: finalScore,
    action: isSpoiler ? 'SWAP_TO_CAT_MEME' : 'PASS',
    matched_watchlist_entities: allEntities,
    matched_spoiler_triggers: allTriggers,
    stages: {
      stage1_metadata: {
        score: Number(s1Score.toFixed(2)),
        latency_ms: s1Ms,
        entities: metaEntities,
        triggers: metaTriggers.hits
      },
      stage2_on_device_ocr: {
        score: Number(s2Score.toFixed(2)),
        latency_ms: s2Ms,
        triggers: ocrTriggers.hits
      },
      stage3_lightweight_stt: {
        score: Number(s3Score.toFixed(2)),
        latency_ms: s3Ms,
        triggers: sttTriggers.hits
      },
      stage4_kg_koelectra: {
        score: Number(
          Math.min(0.99, kgBonus + (allTriggers.length ? 0.3 : 0.05)).toFixed(2)
        ),
        latency_ms: s4Ms
      }
    },
    swap_asset: isSpoiler
      ? {
          asset_id: chosenMeme.id,
          type: 'local_cached_cat_meme',
          caption: chosenMeme.caption
        }
      : null,
    esg_on_device_carbon_saved_g: 0.42
  };
}

export function getCatMemeById(assetId?: string | null) {
  return CAT_MEMES.find((m) => m.id === assetId) || CAT_MEMES[0];
}

export function buildOnDeviceReasoning(result: EvaluationResult) {
  const entities = result.matched_watchlist_entities;
  const triggers = result.matched_spoiler_triggers;
  if (result.action === 'SWAP_TO_CAT_MEME') {
    return {
      provider: 'on-device-kg' as const,
      multimodal_used: false,
      reasoning: `워치리스트 작품(${entities.join(', ') || '미지정'})과 스포일러 핵심 단서(${triggers.join(', ') || '문맥 가중치'})가 동시 탐지되어 종합 점수 ${result.confidence_score.toFixed(2)}(임계치 ${result.threshold.toFixed(2)} 이상)로 고양이 밈 스왑을 실행했습니다.`
    };
  }
  if (entities.length > 0) {
    return {
      provider: 'on-device-kg' as const,
      multimodal_used: false,
      reasoning: `워치리스트 작품(${entities.join(', ')})은 언급되었으나 결말·반전 등 스포일러 트리거가 임계치(${result.threshold.toFixed(2)}) 미만(${result.confidence_score.toFixed(2)})으로 안전 통과했습니다.`
    };
  }
  return {
    provider: 'on-device-kg' as const,
    multimodal_used: false,
    reasoning: `등록된 워치리스트 작품 및 스포일러 단서가 탐지되지 않아(${result.confidence_score.toFixed(2)}) 정상 재생을 허용했습니다.`
  };
}
