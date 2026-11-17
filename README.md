# Spoiler-Swap AI (Next.js Web App)

4단계 멀티모달 스포일러 탐지 및 **고양이 밈(Cat Meme) 즉시 스왑** 웹 애플리케이션입니다.  
**Next.js 15 (App Router) + TypeScript + Tailwind CSS** 단일 풀스택 프로젝트로 구성되어 있어, Vercel 등에 바로 웹 배포할 수 있습니다.

---

## 주요 기능

- **4단계 멀티모달 스포일러 탐지 파이프라인 (`evaluateShort`)**
  - **Stage 1 (Pre-fetch Metadata)**: 제목·채널·태그의 Watchlist 엔티티 및 트리거 탐지
  - **Stage 2 (On-Device OCR)**: 영상 내 썸네일/자막 텍스트 스포일러 탐지
  - **Stage 3 (Lightweight STT)**: 초반 2초 음성 자막 기반 스포일러 탐지
  - **Stage 4 (KG + KoELECTRA / Optional LLM Fusion)**: 엔티티-트리거 결합 가중치 계산 (선택적으로 Gemini / OpenAI 문맥 융합 지원)
- **고양이 밈 스왑 & 한국어 안내 UX**: 스포일러 판정(`SWAP_TO_CAT_MEME`) 시 9:16 플레이어를 고양이 밈으로 즉시 교체하고, Web Audio 차임 + 한국어 TTS 안내를 제공합니다.
- **실제 유튜브 쇼츠 임베드 & 실시간 검색 (`/api/youtube-search`, `/api/youtube-inspect`)**: YouTube Data API v3 또는 공개 검색·oEmbed·공개 자막 트랙을 통해 실제 쇼츠를 불러와 9:16 플레이어로 재생하고, 스포일러 판정 시 즉시 재생을 중단하고 고양이 밈으로 교체합니다.
- **감사 로그 & 리포트 내보내기**: 탐지 결과를 JSON / Markdown / CSV로 즉시 다운로드할 수 있습니다.

---

## API 키 및 환경 변수 안내 (`.env.example`)

**API 키가 없어도 모든 핵심 기능이 즉시 동작합니다.**  
더 정밀한 유튜브 실시간 검색·메타데이터 수집이나 멀티모달 LLM 문맥 추론을 원할 경우에만 아래 환경 변수를 `.env.local` (또는 Vercel Environment Variables)에 추가하세요.

| 환경 변수 | 필수 여부 | 미설정 시 기본 동작 | 설정 시 확장 기능 |
| --- | --- | --- | --- |
| `YOUTUBE_API_KEY` | 선택 | `YouTube oEmbed` + 공개 자막/검색 파서로 무료 조회 | YouTube Data API v3로 실시간 쇼츠 검색·설명란·태그·조회수 정밀 수집 |
| `GEMINI_API_KEY` | 선택 | 온디바이스 4단계 Knowledge Graph + 가중치 엔진으로 100% 동작 | Stage 4에서 Gemini 2.0 Flash로 텍스트 + 썸네일 이미지 멀티모달 판정 및 판단 근거 생성 |
| `OPENAI_API_KEY` | 선택 | 온디바이스 4단계 Knowledge Graph + 가중치 엔진으로 100% 동작 | Stage 4에서 OpenAI GPT-4o-mini 문맥 추론 및 판단 근거 생성 |

---

## API 엔드포인트

- `GET /api/health` — 서버 상태 및 연결된 API 키 활성 여부 확인
- `GET /api/shorts` — 기본 5종 시연용 쇼츠 프리셋 목록 반환
- `POST /api/evaluate` — 단건 또는 배치(`shorts[]`) 4단계 + AI 멀티모달 스포일러 판정 실행
- `POST /api/youtube-search` — 키워드 기반 실시간 유튜브 쇼츠 검색 및 일괄 스포일러 판정
- `POST /api/youtube-inspect` — 실제 YouTube / Shorts URL 메타데이터·자막 추출 및 스포일러 판정

---

## 로컬 실행 및 테스트

```bash
npm install
npm run dev        # http://localhost:3000 실행
npm run typecheck  # TypeScript 타입 검사
npm test           # 4단계 탐지기 및 YouTube URL 파서 단위 테스트
npm run build      # 프로덕션 빌드
```

## Vercel 웹 배포 방법

1. 이 프로젝트 폴더(`spoiler-swap-ai`)를 GitHub 저장소에 푸시합니다.
2. [Vercel](https://vercel.com)에서 **Add New Project** → 해당 저장소 선택 → **Deploy** 클릭 (별도 빌드 설정 변경 불필요).
3. 필요 시 Vercel 대시보드의 **Settings → Environment Variables**에 `YOUTUBE_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`를 추가합니다.
