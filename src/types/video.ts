export type VideoCategory = "all" | "drama" | "gaming" | "vlog" | "tech";

export const CATEGORY_LABELS: Record<VideoCategory, string> = {
  all: "전체",
  drama: "드라마·영화",
  gaming: "게임·e스포츠",
  vlog: "일상·브이로그",
  tech: "IT·테크",
};

export interface KeywordRule {
  id: string;
  term: string;
  enabled: boolean;
  isDefault?: boolean;
}

export const DEFAULT_KEYWORD_RULES: KeywordRule[] = [
  { id: "kw-squid", term: "오징어 게임", enabled: true, isDefault: true },
  { id: "kw-crime", term: "범죄도시", enabled: true, isDefault: true },
  { id: "kw-queen", term: "눈물의 여왕", enabled: true, isDefault: true },
  { id: "kw-worlds", term: "롤드컵", enabled: true, isDefault: true },
];

export interface YouTubeVideoItem {
  id: string;
  title: string;
  channelTitle: string;
  channelInitial: string;
  publishedAtLabel: string;
  viewCountLabel: string;
  duration: string;
  thumbnailUrl: string;
  category: Exclude<VideoCategory, "all">;
  description: string;
  tags: string[];
  ocrSampleText?: string;
  sttSampleText?: string;
  source: "youtube-api" | "fallback";
}

export interface StageBreakdown {
  stage1Meta: {
    weight: 0.28;
    rawScore: number;
    weighted: number;
    matchedKeywords: string[];
    matchedTriggers: string[];
    summary: string;
  };
  stage2Ocr: {
    weight: 0.32;
    rawScore: number;
    weighted: number;
    textChecked: string;
    matchedKeywords: string[];
    matchedTriggers: string[];
    summary: string;
  };
  stage3Stt: {
    weight: 0.28;
    rawScore: number;
    weighted: number;
    textChecked: string;
    matchedKeywords: string[];
    matchedTriggers: string[];
    summary: string;
  };
  stage4Fusion: {
    bonusRange: "+0.26~0.44";
    bonus: number;
    contextVerdict: "SPOILER_CONFIRMED" | "SAFE_TRAILER_PASS" | "LOW_RISK";
    geminiUsed: boolean;
    geminiModel: string | null;
    geminiVerdict: boolean | null;
    geminiError?: string | null;
    summary: string;
  };
}

export interface AnalyzeResult {
  videoId: string;
  isSpoiler: boolean;
  riskScore: number;
  threshold: number;
  engineMode: "gemini-multimodal" | "local-fallback";
  modelUsed: string;
  durationMs: number;
  matchedKeywords: string[];
  matchedStateWords: string[];
  reason: string;
  stages: StageBreakdown;
}

export interface DetectionLogEntry {
  id: string;
  timestamp: string;
  videoId: string;
  videoTitle: string;
  channelTitle: string;
  blocked: boolean;
  overriddenByUser: boolean;
  riskScore: number;
  threshold: number;
  durationMs: number;
  matchedKeywords: string[];
  matchedStateWords: string[];
  stage1Score: number;
  stage2Score: number;
  stage3Score: number;
  stage4Bonus: number;
  engineMode: "gemini-multimodal" | "local-fallback";
  reason: string;
}
