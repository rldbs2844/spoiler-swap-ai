export interface ShortItem {
  id: string;
  channel: string;
  emoji?: string;
  bgGradient?: string;
  title: string;
  ocr: string;
  stt: string;
  thumbnailUrl?: string;
  sourceUrl?: string;
  isRealYouTube?: boolean;
  publishedAt?: string;
  viewCount?: string;
  captionSource?: 'youtube_captions' | 'description' | 'user_hint' | 'none';
}

export interface CatMemeAsset {
  id: string;
  src: string;
  caption: string;
}

export interface SpoilerTrigger {
  word: string;
  weight: number;
}

export interface Stage1Metadata {
  score: number;
  latency_ms: number;
  entities: string[];
  triggers: string[];
}

export interface Stage2Ocr {
  score: number;
  latency_ms: number;
  triggers: string[];
}

export interface Stage3Stt {
  score: number;
  latency_ms: number;
  triggers: string[];
}

export interface Stage4Kg {
  score: number;
  latency_ms: number;
}

export interface SwapAssetOutput {
  asset_id: string;
  type: 'local_cached_cat_meme';
  caption: string;
}

export interface AiAnalysis {
  provider: string;
  reasoning: string;
  multimodal_used: boolean;
  fallbackReason?: string;
}

export interface EvaluationResult {
  video_id: string;
  channel: string;
  latency_ms: number;
  threshold: number;
  confidence_score: number;
  action: 'SWAP_TO_CAT_MEME' | 'PASS';
  matched_watchlist_entities: string[];
  matched_spoiler_triggers: string[];
  stages: {
    stage1_metadata: Stage1Metadata;
    stage2_on_device_ocr: Stage2Ocr;
    stage3_lightweight_stt: Stage3Stt;
    stage4_kg_koelectra: Stage4Kg;
  };
  swap_asset: SwapAssetOutput | null;
  esg_on_device_carbon_saved_g: number;
  ai_analysis?: AiAnalysis;
}

export interface ScanLogEntry {
  seq: number;
  runId?: number;
  timestamp: string;
  isoTime: string;
  title: string;
  result: EvaluationResult;
}
