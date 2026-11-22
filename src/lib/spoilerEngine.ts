import type { AnalyzeResult, StageBreakdown } from "@/types/video";

export interface AnalyzeInput {
  videoId: string;
  title: string;
  channelTitle: string;
  description?: string;
  tags?: string[];
  thumbnailUrl?: string;
  ocrText?: string;
  sttText?: string;
  protectedKeywords: string[];
  threshold: number;
}

export interface GeminiDecision {
  detectedOcrText: string;
  matchedWork: string | null;
  isSpoiler: boolean;
  isSafeTrailerOrTeaser: boolean;
  confidence: number;
  reason: string;
  modelUsed: string;
}

const WORK_ALIAS_MAP: Record<string, string[]> = {
  "오징어 게임": [
    "오징어 게임",
    "오징어게임",
    "오징어게임2",
    "오징어게임3",
    "오겜",
    "squid game",
    "성기훈",
    "이정재",
    "456번",
    "오일남",
    "001번",
    "프론트맨",
    "이병헌",
    "황인호",
    "황준호",
    "임시완",
    "강하늘",
    "박규영",
  ],
  범죄도시: [
    "범죄도시",
    "범죄도시2",
    "범죄도시3",
    "범죄도시4",
    "범죄도시5",
    "마석도",
    "마동석",
    "장이수",
    "박지환",
    "백창기",
    "주성철",
    "강해상",
    "roundup",
  ],
  "눈물의 여왕": [
    "눈물의 여왕",
    "눈물의여왕",
    "홍해인",
    "백현우",
    "김수현",
    "김지원",
    "윤은성",
    "모슬희",
    "용두리",
    "queen of tears",
  ],
  롤드컵: [
    "롤드컵",
    "월드 챔피언십",
    "월드챔피언십",
    "월즈",
    "worlds 2024",
    "worlds 2025",
    "worlds 2026",
    "worlds",
    "t1 vs",
    "drx vs",
    "젠지",
    "페이커",
    "이상혁",
    "케리아",
    "구마유시",
    "제우스",
    "오너",
    "쵸비",
  ],
};

export const SPOILER_STATE_WORDS = [
  "결말",
  "사망",
  "죽음",
  "죽었",
  "범인",
  "흑막",
  "정체",
  "배신",
  "반전",
  "최종화",
  "마지막화",
  "최종회",
  "엔딩",
  "해피엔딩",
  "새드엔딩",
  "탈락",
  "우승",
  "우승컵",
  "준우승",
  "패배",
  "완패",
  "졌다",
  "졌을까",
  "졌나",
  "승리",
  "꺾고",
  "격파",
  "제압",
  "역스윕",
  "셧아웃",
  "결승진출",
  "4강진출",
  "역전",
  "역전승",
  "최후",
  "체포",
  "생존",
  "진범",
  "유출",
  "결말포함",
  "스포주의",
  "스포일러",
  "스포포함",
  "스포",
  "spoiler",
  "ending",
  "defeated",
  "eliminated",
];

const METADATA_HINT_WORDS = [
  "예고편",
  "티저",
  "해석",
  "리뷰",
  "후기",
  "총정리",
  "요약",
  "몰아보기",
  "결승",
  "하이라이트",
];

const SAFE_TRAILER_WORDS = [
  "공식 티저",
  "공식 예고편",
  "메인 예고편",
  "티저 예고편",
  "official trailer",
  "teaser",
  "trailer",
  "제작발표회",
  "메이킹",
];

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeCompact(value: string): string {
  return value.toLowerCase().replace(/[\s\-_.,!?()[\]{}:;'"#]+/g, "");
}

function getAliasesForRule(term: string): string[] {
  const clean = term.trim();
  const normalizedKey = Object.keys(WORK_ALIAS_MAP).find(
    (k) => normalizeCompact(k) === normalizeCompact(clean)
  );
  if (normalizedKey) {
    return Array.from(new Set([clean, ...WORK_ALIAS_MAP[normalizedKey]]));
  }
  return [clean];
}

function findKeywordMatches(
  text: string,
  protectedKeywords: string[]
): { matchedRules: string[]; directMatches: number; aliasMatches: number } {
  if (!text.trim()) {
    return { matchedRules: [], directMatches: 0, aliasMatches: 0 };
  }
  const lower = normalizeText(text);
  const compact = normalizeCompact(text);
  const matchedRules: string[] = [];
  let directMatches = 0;
  let aliasMatches = 0;

  for (const rule of protectedKeywords) {
    const cleanRule = rule.trim();
    if (!cleanRule) continue;

    const ruleCompact = normalizeCompact(cleanRule);
    const aliases = getAliasesForRule(cleanRule);

    if (lower.includes(cleanRule.toLowerCase()) || compact.includes(ruleCompact)) {
      matchedRules.push(cleanRule);
      directMatches += 1;
      continue;
    }

    const hitAlias = aliases.some((alias) => {
      const aLower = alias.toLowerCase();
      const aCompact = normalizeCompact(alias);
      return (
        aCompact.length >= 2 &&
        (lower.includes(aLower) || compact.includes(aCompact))
      );
    });

    if (hitAlias) {
      matchedRules.push(cleanRule);
      aliasMatches += 1;
    }
  }

  return {
    matchedRules: Array.from(new Set(matchedRules)),
    directMatches,
    aliasMatches,
  };
}

function findStateWordMatches(text: string): string[] {
  if (!text.trim()) return [];
  // Neutralize benign compounds like e스포츠/스포츠/노스포/무스포/스포방지 before matching
  const cleaned = normalizeText(text)
    .replace(/e?이?스포츠|스포티/g, " ")
    .replace(/노스포|무스포|스포\s*없[음는을이]|스포\s*방지|스포\s*자제/g, " ");

  const rawHits = SPOILER_STATE_WORDS.filter((w) => {
    const token = w.toLowerCase();
    if (token === "스포") {
      return /(?:^|[\s[\]().,!?:;])스포/u.test(cleaned);
    }
    return cleaned.includes(token);
  });

  // Avoid redundant "스포" badge if "스포주의" / "스포일러" / "스포포함" already matched
  const hasSpecificSpo = rawHits.some(
    (w) => w === "스포주의" || w === "스포일러" || w === "스포포함"
  );
  return hasSpecificSpo ? rawHits.filter((w) => w !== "스포") : rawHits;
}

function hasAnyHint(text: string, hints: string[]): boolean {
  const lower = normalizeText(text);
  return hints.some((h) => lower.includes(h.toLowerCase()));
}

function clamp(num: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, num));
}

export function evaluateFourStageSpoiler(
  input: AnalyzeInput,
  geminiDecision: GeminiDecision | null,
  elapsedMs: number,
  geminiError?: string | null
): AnalyzeResult {
  const threshold = clamp(Math.round(input.threshold || 70), 40, 100);
  const keywords = input.protectedKeywords
    .map((k) => k.trim())
    .filter(Boolean);

  // Stage 1: Metadata (weight 0.28)
  const metaText = [
    input.title,
    input.channelTitle,
    ...(input.tags ?? []),
  ]
    .filter(Boolean)
    .join(" · ");
  const metaKw = findKeywordMatches(metaText, keywords);
  const metaTriggers = findStateWordMatches(metaText);
  const metaHint = hasAnyHint(metaText, METADATA_HINT_WORDS);

  let s1Raw = 0;
  if (metaKw.matchedRules.length > 0 && metaTriggers.length > 0) {
    s1Raw = clamp(0.78 + metaTriggers.length * 0.1, 0, 1);
  } else if (metaKw.matchedRules.length > 0) {
    s1Raw = 0.29;
  } else if (metaTriggers.length > 0) {
    s1Raw = clamp(0.32 + metaTriggers.length * 0.14, 0, 0.75);
  } else if (metaHint) {
    s1Raw = 0.08;
  }

  // Stage 2: Screen & Thumbnail OCR (weight 0.32)
  const explicitOcr = [
    input.ocrText ?? "",
    geminiDecision?.detectedOcrText ?? "",
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" / ");

  // Local fallback surrogate when live video has no Gemini OCR image text yet:
  // inspect thumbnail-mirrored brackets/hashtags/headline & first description line
  const descLead = (input.description ?? "").split("\n")[0]?.trim() ?? "";
  const usingFallbackOcrCue = !explicitOcr && metaTriggers.length > 0;
  const ocrCombined = explicitOcr
    ? explicitOcr
    : usingFallbackOcrCue
    ? [input.title, descLead].filter(Boolean).join(" / ")
    : "";

  const ocrKw = findKeywordMatches(ocrCombined, keywords);
  const ocrTriggers = findStateWordMatches(ocrCombined);

  let s2Raw = 0;
  if (explicitOcr) {
    if (ocrKw.matchedRules.length > 0 && ocrTriggers.length > 0) {
      s2Raw = clamp(0.76 + ocrTriggers.length * 0.1, 0, 1);
    } else if (ocrTriggers.length > 0) {
      s2Raw = clamp(0.58 + ocrTriggers.length * 0.14, 0, 0.92);
    } else if (ocrKw.matchedRules.length > 0) {
      s2Raw = 0.2;
    }
  } else if (usingFallbackOcrCue && ocrKw.matchedRules.length > 0) {
    s2Raw = clamp(0.64 + ocrTriggers.length * 0.1, 0, 0.88);
  }

  if (
    geminiDecision &&
    geminiDecision.isSpoiler &&
    !geminiDecision.isSafeTrailerOrTeaser &&
    geminiDecision.matchedWork &&
    s2Raw < 0.72
  ) {
    s2Raw = clamp(Math.max(s2Raw, geminiDecision.confidence * 0.85), 0, 1);
  }

  // Stage 3: Early Speech & Captions STT (weight 0.28)
  const explicitStt = [input.sttText ?? "", input.description ?? ""]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" / ");
  const sttCombined =
    explicitStt ||
    (metaKw.matchedRules.length > 0 && metaTriggers.length > 0
      ? input.title
      : "");
  const sttKw = findKeywordMatches(sttCombined, keywords);
  const sttTriggers = findStateWordMatches(sttCombined);

  let s3Raw = 0;
  if (sttKw.matchedRules.length > 0 && sttTriggers.length > 0) {
    s3Raw = clamp(
      (input.sttText ? 0.76 : 0.56) + sttTriggers.length * 0.09,
      0,
      1
    );
  } else if (sttTriggers.length > 0) {
    s3Raw = clamp(0.45 + sttTriggers.length * 0.12, 0, 0.85);
  } else if (sttKw.matchedRules.length > 0) {
    s3Raw = 0.2;
  }

  if (
    geminiDecision &&
    geminiDecision.isSpoiler &&
    !geminiDecision.isSafeTrailerOrTeaser &&
    geminiDecision.matchedWork &&
    s3Raw < 0.68
  ) {
    s3Raw = clamp(Math.max(s3Raw, geminiDecision.confidence * 0.78), 0, 1);
  }

  // Cross-modal union of keywords & outcome state words
  const geminiMatchedRule =
    geminiDecision?.matchedWork &&
    keywords.find(
      (k) =>
        normalizeCompact(k) === normalizeCompact(geminiDecision.matchedWork ?? "")
    );

  const allMatchedKeywords = Array.from(
    new Set([
      ...metaKw.matchedRules,
      ...ocrKw.matchedRules,
      ...sttKw.matchedRules,
      ...(geminiMatchedRule ? [geminiMatchedRule] : []),
    ])
  );

  const allMatchedStateWords = Array.from(
    new Set([...metaTriggers, ...ocrTriggers, ...sttTriggers])
  );

  const safeTrailerSignal =
    hasAnyHint(`${metaText} ${ocrCombined} ${sttCombined}`, SAFE_TRAILER_WORDS) &&
    allMatchedStateWords.length === 0;

  const hasWorkContext = allMatchedKeywords.length > 0;
  const hasStateChange = allMatchedStateWords.length > 0;
  const geminiConfirmsSpoiler =
    geminiDecision !== null &&
    geminiDecision.isSpoiler &&
    !geminiDecision.isSafeTrailerOrTeaser &&
    geminiDecision.confidence >= 0.55;
  const geminiConfirmsSafe =
    geminiDecision !== null &&
    (!geminiDecision.isSpoiler || geminiDecision.isSafeTrailerOrTeaser);

  // If no protected work rule matches at all, zero out generic metadata triggers so S1~S4 = 0%
  if (!hasWorkContext || keywords.length === 0) {
    s1Raw = 0;
    s2Raw = 0;
    s3Raw = 0;
  }

  let s1Weighted = Number((s1Raw * 0.28).toFixed(4));
  let s2Weighted = Number((s2Raw * 0.32).toFixed(4));
  let s3Weighted = Number((s3Raw * 0.28).toFixed(4));

  // Stage 4: Context Fusion + Gemini AI (Bonus +0.26 ~ +0.44)
  let stage4Bonus = 0;
  let contextVerdict: "SPOILER_CONFIRMED" | "SAFE_TRAILER_PASS" | "LOW_RISK" =
    "LOW_RISK";

  if (safeTrailerSignal && !geminiConfirmsSpoiler) {
    contextVerdict = "SAFE_TRAILER_PASS";
    stage4Bonus = 0;
  } else if (hasWorkContext && (hasStateChange || geminiConfirmsSpoiler)) {
    contextVerdict = "SPOILER_CONFIRMED";
    const surpriseBoost =
      metaKw.matchedRules.length === 0 &&
      (ocrKw.matchedRules.length > 0 || sttKw.matchedRules.length > 0)
        ? 0.05
        : 0;
    const stateBoost = Math.min(0.09, allMatchedStateWords.length * 0.025);
    const explicitWarningBoost =
      allMatchedStateWords.some((w) =>
        ["스포주의", "결말포함", "스포포함", "스포일러"].includes(w)
      )
        ? 0.04
        : 0;
    const geminiBoost = geminiConfirmsSpoiler
      ? clamp((geminiDecision?.confidence ?? 0.7) * 0.06, 0.03, 0.06)
      : 0;

    stage4Bonus = Number(
      clamp(
        0.26 + surpriseBoost + stateBoost + explicitWarningBoost + geminiBoost,
        0.26,
        0.44
      ).toFixed(4)
    );
  } else if (safeTrailerSignal && geminiConfirmsSafe) {
    contextVerdict = "SAFE_TRAILER_PASS";
    stage4Bonus = 0;
  }

  // Attenuate baseline scores if only work name appears without state-change words
  if (
    hasWorkContext &&
    (contextVerdict === "SAFE_TRAILER_PASS" ||
      (!hasStateChange && !geminiConfirmsSpoiler))
  ) {
    s1Weighted = Math.min(s1Weighted, 0.09);
    s2Weighted = Math.min(s2Weighted, 0.07);
    s3Weighted = Math.min(s3Weighted, 0.06);
  }

  // Exact integer percentage sum across all 4 stages so S1+S2+S3+S4 == riskScore (or capped at 99)
  const s1Pct = Math.round(s1Weighted * 100);
  const s2Pct = Math.round(s2Weighted * 100);
  const s3Pct = Math.round(s3Weighted * 100);
  const s4Pct = Math.round(stage4Bonus * 100);
  const riskScore = Math.min(99, s1Pct + s2Pct + s3Pct + s4Pct);
  const isSpoiler = riskScore >= threshold;

  // Build concise, logically consistent 1-line Korean reason
  let reason = "";
  if (
    geminiDecision?.reason &&
    ((contextVerdict === "SPOILER_CONFIRMED" && isSpoiler) ||
      geminiDecision.isSafeTrailerOrTeaser)
  ) {
    reason = geminiDecision.reason;
  } else if (contextVerdict === "SPOILER_CONFIRMED" && isSpoiler) {
    const kwLabel = allMatchedKeywords.slice(0, 2).join(", ");
    const stLabel = allMatchedStateWords.slice(0, 3).join("·");
    if (metaKw.matchedRules.length === 0) {
      reason = `제목에는 작품명을 숨겼으나 화면 자막·음성에서 '${kwLabel}'의 핵심 정보(${stLabel || "결말 내용"})가 감지되어 차단했습니다.`;
    } else {
      reason = `'${kwLabel}' 관련 스포일러 단서(${stLabel || "핵심 전개"})가 다단계 분석에서 결합 감지되어 차단했습니다.`;
    }
  } else if (contextVerdict === "SPOILER_CONFIRMED" && !isSpoiler) {
    const clues = Array.from(
      new Set([
        ...allMatchedKeywords.slice(0, 2),
        ...allMatchedStateWords.slice(0, 2),
      ])
    ).join(", ");
    reason = `스포일러 단서(${clues})가 감지되었으나 현재 차단 기준(${threshold}%) 미만(${riskScore}%)으로 통과했습니다.`;
  } else if (contextVerdict === "SAFE_TRAILER_PASS") {
    const kwLabel = allMatchedKeywords.slice(0, 2).join(", ");
    reason = `'${kwLabel || "작품"}'이 언급되었으나 공식 예고·홍보 문맥이며 결말 폭로 단어가 없어 안전하게 통과했습니다.`;
  } else if (hasWorkContext) {
    reason = `보호 키워드('${allMatchedKeywords[0]}')가 포함되었으나 결말·우승·사망 등 상태변화 단어가 없어 통과했습니다.`;
  } else {
    reason =
      "등록된 보호 키워드 및 결말 스포일러 신호가 감지되지 않은 안전 영상입니다.";
  }

  const stages: StageBreakdown = {
    stage1Meta: {
      weight: 0.28,
      rawScore: Number((s1Weighted / 0.28).toFixed(2)),
      weighted: s1Weighted,
      matchedKeywords: metaKw.matchedRules,
      matchedTriggers: metaTriggers,
      summary:
        metaKw.matchedRules.length > 0 && metaTriggers.length > 0
          ? `메타데이터 탐지 (${[...metaKw.matchedRules, ...metaTriggers]
              .slice(0, 3)
              .join(", ")})`
          : metaKw.matchedRules.length > 0
          ? `작품명 언급 (${metaKw.matchedRules.slice(0, 2).join(", ")})`
          : "제목·태그에서 직접 스포일러 미발견",
    },
    stage2Ocr: {
      weight: 0.32,
      rawScore: Number((s2Weighted / 0.32).toFixed(2)),
      weighted: s2Weighted,
      textChecked:
        ocrCombined || "썸네일·화면 텍스트 내 보호 키워드 특이사항 없음",
      matchedKeywords: hasWorkContext ? ocrKw.matchedRules : [],
      matchedTriggers: hasWorkContext ? ocrTriggers : [],
      summary:
        s2Pct > 0
          ? usingFallbackOcrCue && !explicitOcr
            ? `썸네일 표제 문구 추정 (${[...ocrKw.matchedRules, ...ocrTriggers]
                .slice(0, 3)
                .join(", ")})`
            : `화면·썸네일 텍스트 포착 (${[...ocrKw.matchedRules, ...ocrTriggers]
                .slice(0, 3)
                .join(", ")})`
          : "썸네일·화면 자막 내 위험 문구 없음",
    },
    stage3Stt: {
      weight: 0.28,
      rawScore: Number((s3Weighted / 0.28).toFixed(2)),
      weighted: s3Weighted,
      textChecked:
        (hasWorkContext ? sttCombined.slice(0, 220) : "") ||
        "초반 자막·음성 내 보호 키워드 특이사항 없음",
      matchedKeywords: hasWorkContext ? sttKw.matchedRules : [],
      matchedTriggers: hasWorkContext ? sttTriggers : [],
      summary:
        s3Pct > 0
          ? input.sttText
            ? `음성·자막에서 문맥 포착 (${[...sttKw.matchedRules, ...sttTriggers]
                .slice(0, 3)
                .join(", ")})`
            : `설명·도입부 문맥 포착 (${[...sttKw.matchedRules, ...sttTriggers]
                .slice(0, 3)
                .join(", ")})`
          : "음성·자막 대본 내 스포일러 미발견",
    },
    stage4Fusion: {
      bonusRange: "+0.26~0.44",
      bonus: stage4Bonus,
      contextVerdict,
      geminiUsed: geminiDecision !== null,
      geminiModel: geminiDecision?.modelUsed ?? null,
      geminiVerdict: geminiDecision ? geminiDecision.isSpoiler : null,
      geminiError: geminiError ?? null,
      summary:
        contextVerdict === "SPOILER_CONFIRMED"
          ? `작품·인물과 상태변화 문맥 결합 (+${s4Pct}% 가중치)`
          : contextVerdict === "SAFE_TRAILER_PASS"
          ? "안전 예고편·하이라이트 판정 (오탐 억제)"
          : "단독 위험 결합 없음",
    },
  };

  return {
    videoId: input.videoId,
    isSpoiler,
    riskScore,
    threshold,
    engineMode: geminiDecision ? "gemini-multimodal" : "local-fallback",
    modelUsed: geminiDecision?.modelUsed ?? "local-4stage-v1",
    durationMs: Math.max(1, Math.round(elapsedMs)),
    matchedKeywords: allMatchedKeywords,
    matchedStateWords: allMatchedStateWords,
    reason,
    stages,
  };
}
