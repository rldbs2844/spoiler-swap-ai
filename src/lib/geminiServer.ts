import type { GeminiDecision } from "@/lib/spoilerEngine";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const CANDIDATE_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash",
] as const;

export interface GeminiAnalysisOutcome {
  decision: GeminiDecision | null;
  errorReason: string | null;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function fetchThumbnailBase64(
  videoId: string,
  thumbnailUrl: string
): Promise<{ mimeType: string; data: string } | null> {
  const candidateUrls = Array.from(
    new Set(
      [
        thumbnailUrl,
        `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`,
      ].filter((u) => u && u.startsWith("https://"))
    )
  );

  for (const url of candidateUrls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1300);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type") || "image/jpeg";
      if (!contentType.startsWith("image/")) continue;
      const buf = await res.arrayBuffer();
      if (buf.byteLength === 0 || buf.byteLength > 2_000_000) continue;
      return { mimeType: contentType, data: arrayBufferToBase64(buf) };
    } catch {
      continue;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

export async function analyzeWithGeminiMultimodal(params: {
  videoId: string;
  title: string;
  channelTitle: string;
  description: string;
  tags: string[];
  thumbnailUrl: string;
  ocrText: string;
  sttText: string;
  protectedKeywords: string[];
  preFetchedImage?: { mimeType: string; data: string } | null;
}): Promise<GeminiAnalysisOutcome> {
  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  if (!apiKey) {
    return {
      decision: null,
      errorReason: "GEMINI_API_KEY 환경변수가 설정되지 않았습니다.",
    };
  }
  if (params.protectedKeywords.length === 0) {
    return { decision: null, errorReason: null };
  }

  const deadlineAt = Date.now() + 7200;
  const imagePart =
    params.preFetchedImage !== undefined
      ? params.preFetchedImage
      : await fetchThumbnailBase64(params.videoId, params.thumbnailUrl);

  const prompt = `당신은 유튜브 영상 스포일러 실시간 감지기입니다.
사용자가 차단하길 원하는 작품/인물/대회 키워드 목록: [${params.protectedKeywords.join(", ")}]

아래 영상 정보와 첨부된 썸네일 이미지(문자 OCR 포함)를 종합 분석해 판정하세요:
- 제목: ${params.title}
- 채널: ${params.channelTitle}
- 태그: ${params.tags.slice(0, 14).join(", ") || "없음"}
- 설명: ${params.description.slice(0, 600) || "없음"}
- 화면/자막 OCR 힌트: ${params.ocrText.slice(0, 300) || "없음"}
- 초기 음성/자막 STT: ${params.sttText.slice(0, 800) || "없음"}

판별 규칙:
1. 썸네일 이미지 안에 적힌 텍스트를 읽어서 "detectedOcrText"에 그대로 추출하세요.
2. 제목 또는 썸네일·설명에 [스포주의], 스포, 결말, 우승, 패배, 졌다/졌을까, 사망, 범인, 흑막, 정체, 배신, 반전, 탈락, 역전 등 작품·경기 결과나 핵심 전개 폭로가 포함되면(제목에 작품명을 숨겼더라도) 반드시 isSpoiler=true, confidence=0.85~0.98로 판정하세요.
3. 단순 작품명·배우 이름만 나오는 공식 티저·예고편·제작발표회·비하인드 영상이라면 isSafeTrailerOrTeaser=true, isSpoiler=false로 판정하세요.
4. 키워드 목록과 무관한 일상/IT/다른 주제 영상이면 isSpoiler=false, matchedWork=null로 판정하세요.

반드시 아래 JSON 형식만 출력하세요:
{
  "detectedOcrText": "썸네일 이미지 안의 문구 요약 (없으면 빈 문자열)",
  "matchedWork": "감지된 보호 키워드 문자열 (없으면 null)",
  "isSpoiler": true,
  "isSafeTrailerOrTeaser": false,
  "confidence": 0.92,
  "reason": "한국어 1줄 판단 사유 (60자 이내)"
}`;

  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  if (imagePart) {
    parts.push({
      inlineData: {
        mimeType: imagePart.mimeType,
        data: imagePart.data,
      },
    });
  }

  let lastError: string | null = null;

  for (const model of CANDIDATE_MODELS) {
    const remainingMs = deadlineAt - Date.now();
    if (remainingMs < 1000) break;

    const controller = new AbortController();
    const perModelTimeout = Math.min(
      model === "gemini-3.5-flash-lite" ? 4500 : 3200,
      remainingMs
    );
    const timer = setTimeout(() => controller.abort(), perModelTimeout);

    try {
      const generationConfig: Record<string, unknown> = {
        temperature: 0.1,
        maxOutputTokens: 256,
        responseMimeType: "application/json",
      };

      const res = await fetch(
        `${GEMINI_API_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: "user", parts }],
            generationConfig,
          }),
        }
      );

      if (!res.ok) {
        let errDetail = `HTTP ${res.status}`;
        try {
          const errJson = (await res.json()) as {
            error?: { message?: string };
          };
          if (errJson?.error?.message) {
            errDetail = `${errDetail}: ${errJson.error.message}`;
          }
        } catch {}
        lastError = `[${model}] ${errDetail}`;
        console.error("[SpoilerGuard Gemini API error]", lastError);
        continue;
      }

      const data = (await res.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string; thought?: boolean }>;
          };
        }>;
      };

      const respParts = data.candidates?.[0]?.content?.parts ?? [];
      const rawText = respParts
        .filter((p) => !p.thought && typeof p.text === "string")
        .map((p) => p.text ?? "")
        .join("")
        .trim();

      if (!rawText) {
        lastError = `[${model}] 응답 본문이 비어 있습니다.`;
        console.error("[SpoilerGuard Gemini empty output]", lastError);
        continue;
      }

      const stripped = rawText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```$/i, "")
        .trim();
      const jsonMatch = stripped.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(
        jsonMatch ? jsonMatch[0] : stripped
      ) as Partial<GeminiDecision>;

      return {
        decision: {
          detectedOcrText:
            typeof parsed.detectedOcrText === "string"
              ? parsed.detectedOcrText
              : "",
          matchedWork:
            typeof parsed.matchedWork === "string" && parsed.matchedWork.trim()
              ? parsed.matchedWork.trim()
              : null,
          isSpoiler: Boolean(parsed.isSpoiler),
          isSafeTrailerOrTeaser: Boolean(parsed.isSafeTrailerOrTeaser),
          confidence:
            typeof parsed.confidence === "number" &&
            Number.isFinite(parsed.confidence)
              ? Math.min(1, Math.max(0, parsed.confidence))
              : 0.78,
          reason:
            typeof parsed.reason === "string" && parsed.reason.trim()
              ? parsed.reason.trim()
              : "Gemini 멀티모달 문맥 분석을 완료했습니다.",
          modelUsed: model,
        },
        errorReason: null,
      };
    } catch (err) {
      lastError = `[${model}] ${err instanceof Error ? err.message : "요청 시간 초과 또는 네트워크 오류"}`;
      console.error("[SpoilerGuard Gemini exception]", lastError);
      continue;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    decision: null,
    errorReason: lastError ?? "Gemini API 호출에 실패해 로컬 정밀 엔진으로 전환했습니다.",
  };
}
