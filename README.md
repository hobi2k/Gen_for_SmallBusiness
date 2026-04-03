# Lifestyle Shop AI MVP

오프라인 리빙 소품 상인을 위한 AI 감성 판매 콘텐츠 생성 서비스의 MVP입니다.

사용자는 상품 이미지 한 장만 올리면, 시스템이 어울리는 스타일 3개를 추천하고 선택한 스타일 기준으로 온라인 판매용 콘텐츠 패키지를 생성합니다.

## 서비스 목적

디지털 숙련도가 높지 않은 오프라인 상인이 아래 과정을 최대한 단순하게 처리하도록 설계했습니다.

- 상품 이미지 업로드
- 추천 스타일 3개 확인
- 스타일 1개 선택
- 콘텐츠 생성
- 결과 확인 후 다시 생성 또는 스타일 변경

대상 상품군은 아래 6개 계열입니다.

- 접시
- 볼
- 컵
- 유리잔
- 트레이
- 커트러리

## 현재 구현 상태

이 저장소는 아래 기능이 실제로 동작하는 상태를 기준으로 관리됩니다.

- `Next.js 15 + React 19 + TypeScript` 단일 페이지 앱
- 스타일 6종 고정 프리셋
- 상품 분석 및 추천 스타일 3개 반환
- 스타일 선택 이벤트 저장
- 스마트스토어용 텍스트 패키지 생성
- Python 이미지 워커를 통한 배경 생성
- 상품 누끼 추출 및 테이블 위 배치
- 실측 사이즈 기반 스케일 보정
- `대표 1장 + 보조 최대 2장` 멀티뷰 입력 지원
- dev seed를 통한 내부 QA/데모 경로 유지
- JSONL + Langfuse 기반 로그/트레이싱

## 현재 워크플로우

전체 흐름:

`입력 확보 -> 상품 분석 -> 스타일 추천 -> 스타일 선택 -> 프롬프트 생성 -> 텍스트/이미지 생성 -> 결과 확인 -> 재생성/스타일 변경 -> 로그 축적`

### 입력 경로

입력은 두 가지입니다.

- 실제 업로드
- 내부 QA/데모용 dev seed

실제 업로드는 아래를 지원합니다.

- 대표 이미지 1장 필수
- 보조 이미지 최대 2장 선택
- 실측 사이즈 입력
  - 가로(cm)
  - 세로/깊이(cm)
  - 높이(cm)
- 카테고리/색감/소재/톤/메모 override

중요:

- 보조 이미지를 넣지 않으면 기존 단일 이미지 흐름 그대로 동작합니다.
- dev seed는 계속 단일 이미지 기반으로 동작합니다.

### 상품 분석

추천과 생성의 공통 입력으로 아래 분석 결과를 만듭니다.

- `uploadToken`
- `category`, `categoryLabel`
- `visualSummary`
- `materialNotes`
- `colorHints`
- `materialHints`
- `surfaceTone`
- `dimensionsCm`
- `sourceImageSource`
- `sourceImageRelativePath`
- `sourceImageUrl`
- `supplementalImages`

### 스타일 추천

`POST /api/recommend-styles`

- 상품 분석 결과를 텍스트로 정리
- 스타일 프리셋 6개와 매칭
- embedding / heuristic reranking
- 상위 3개 추천 반환

추천 결과에는 아래가 포함됩니다.

- top 3 스타일
- 전체 스타일 점수
- 추천 이유와 하이라이트
- 썸네일/레퍼런스 프리뷰

### 스타일 선택

`POST /api/style-selection`

- 선택된 스타일
- 추천 목록
- fallback 여부
- 업로드 식별자

를 로그/트레이싱 용도로 저장합니다.

### 생성 단계

`POST /api/generate`

생성은 텍스트와 이미지를 함께 만듭니다.

텍스트:

- 기본: `GPT-5-mini`
- fallback: `GPT-5-nano`
- 그래도 실패 시 템플릿 fallback

이미지:

- 현재 기본 결과는 총 3장
  - 대표 감성 이미지 1장 (`1:1`)
  - 라이프스타일 이미지 2장 (`4:5`, `9:16`)
- worker가 켜져 있으면 Python image worker 호출
- worker가 실패하면 placeholder/fallback 경로로 내려갑니다

## 이미지 생성 파이프라인

현재 worker는 완전한 “상품 재생성”이 아니라, 아래 하이브리드 구조입니다.

1. 스타일 프로파일 기반 주방/다이닝 배경 생성
2. 상품 이미지 누끼 추출
   - 기본: `rembg`
   - 실패 시 휴리스틱 누끼 fallback
3. 테이블/식탁 후보 영역 탐색
4. 상품군별 배치 보정
   - `flat`: 트레이/접시/볼
   - `upright`: 컵/유리잔
   - `linear`: 커트러리
5. 실측 사이즈 기반 스케일 보정
6. 조도/색온도/그림자 보정 후 합성

현재 목적:

- 배경은 `주방/다이닝 공간`으로 고정
- 테이블 또는 식탁이 반드시 보이는 장면 생성
- 상품은 공중에 뜨지 않고 테이블 위에 놓인 것처럼 배치
- 같은 상품이 배경에 한 번 더 생성되는 문제 최소화

### 스타일 레퍼런스 사용 방식

`references/themes/*` 이미지는 런타임에 “공간 구조”가 아니라 “스타일”을 더 참고하도록 조정되어 있습니다.

- 색감
- 재질감
- 장식 밀도
- 조명 분위기

반면 공간 유형은 프롬프트와 스타일 프로파일에서 강제합니다.

즉 목표는:

- 레퍼런스는 `스타일`
- 생성 배경은 `주방/다이닝 공간`

입니다.

### 멀티뷰 입력 처리

멀티뷰가 있는 경우 worker는 대표 이미지와 보조 이미지들 중에서 실제 배치에 쓸 뷰를 선택합니다.

- `flat`: 탑뷰/평행도/상면 비율이 좋은 이미지 선호
- `upright`: 정면 비율이 자연스러운 이미지 선호
- `linear`: 긴 축이 잘 드러나는 이미지 선호

보조 이미지가 없으면 대표 이미지 1장만 그대로 사용합니다.

## 현재 이미지 워커 상태

현재 프로파일:

- `full`
  - 원격 GPU용
  - `SDXL + IP-Adapter`
- `lite-mps`
  - 로컬 Apple Silicon 확인용
  - `Stable Diffusion 1.5 + IP-Adapter`

참고:

- 코드에는 ControlNet 설정이 남아 있지만, 현재 실제 배경 생성은 blank condition 기반이라 구조 제어를 강하게 쓰지 않습니다.
- 2-stage refinement(inpaint)는 구현돼 있지만, 최근 latency/fallback 이슈 때문에 기본값은 `off`입니다.

## 고정 스타일 프리셋

아래 6개 스타일을 고정 지원합니다.

1. 모던 미니멀
2. 내추럴 우드
3. 북유럽 라이트톤
4. 프렌치 빈티지
5. 코지 홈카페
6. 일본식 담백한 식탁

각 스타일은 아래 정보를 가집니다.

- 프롬프트 템플릿
- 조명 설명
- 장면 구성
- 컬러톤
- scene profile
  - `spaceType`
  - `tableSurface`
  - `requiredElements`
  - `backgroundElements`
  - `accentProps`
  - `composition`
  - `prohibitedElements`

구현 파일:

- `lib/style-presets.ts`

## 결과 패키지

현재 생성 결과 패키지는 아래 구조입니다.

- 대표 감성 이미지 1장
- 라이프스타일 이미지 2장
- 상품 한 줄 소개
- 상세 설명
- 스마트스토어용 짧은 소개문구
- 키워드
- 해시태그
- `generationMeta`

## 핵심 UX 플로우

현재 UI는 아래 순서를 따릅니다.

1. 상품 이미지 업로드 또는 dev seed 선택
2. 추천 스타일 3개 확인
3. 스타일 1개 선택
4. 생성 버튼 클릭
5. 결과 확인
6. 복사 / 재생성 / 스타일 변경

구현 파일:

- `app/page.tsx`

## 아키텍처 요약

```text
[브라우저]
  -> 대표 이미지 1장 + 보조 이미지 최대 2장 업로드
  -> 실측 사이즈 / 메타데이터 입력
  -> 스타일 추천 확인
  -> 스타일 선택
  -> 콘텐츠 생성 요청

[Next.js App Router]
  -> /api/recommend-styles
     -> 업로드 파일 storage/uploads 저장
     -> Product Analyzer
     -> Style Recommender
     -> Logger / Langfuse

  -> /api/style-selection
     -> 선택 이벤트 저장

  -> /api/generate
     -> Prompt Builder
     -> Text Generator
     -> Image Worker Adapter
        -> worker 활성 시 Python worker 호출
        -> 실패 시 fallback
     -> Logger / Langfuse

  -> /api/storage-asset
     -> 생성 산출물 프록시

[Python Image Worker]
  -> FastAPI
  -> SDXL or SD1.5 background generation
  -> style-only reference preprocessing
  -> product cutout
  -> tabletop candidate selection
  -> size-aware placement
  -> lighting/shadow harmonization

[Storage]
  -> storage/uploads/*
  -> storage/generated/*
  -> storage/logs/generation-events.jsonl
```

## 폴더 구조

```text
.
├─ app
│  ├─ api
│  │  ├─ dev-seeds/route.ts
│  │  ├─ generate/route.ts
│  │  ├─ recommend-styles/route.ts
│  │  ├─ reference-asset/route.ts
│  │  ├─ storage-asset/route.ts
│  │  └─ style-selection/route.ts
│  ├─ components/home/*
│  ├─ hooks/useHomePageFlow.ts
│  ├─ globals.css
│  ├─ layout.tsx
│  └─ page.tsx
├─ docs
│  └─ mvp-blueprint.md
├─ lib
│  ├─ content-generator.ts
│  ├─ dev-seeds.ts
│  ├─ image-output.ts
│  ├─ image-worker.ts
│  ├─ logging.ts
│  ├─ product-analyzer.ts
│  ├─ prompt-builder.ts
│  ├─ storage-assets.ts
│  ├─ style-presets.ts
│  ├─ style-recommender.ts
│  ├─ types.ts
│  └─ utils.ts
├─ references
│  └─ themes/*
├─ workers
│  └─ image_worker
│     ├─ app.py
│     └─ Dockerfile
├─ storage
│  ├─ generated
│  ├─ logs
│  └─ uploads
├─ .env.example
├─ Dockerfile
├─ docker-compose.yml
├─ package.json
└─ requirements.txt
```

## API 요약

### `POST /api/recommend-styles`

입력:

- `multipart/form-data`
- `file`
- `supplementalFiles` (optional, max 2)
- `metadata`

반환:

- `analysis`
- `recommendations`
- `allStyles`
- `fallbackUsed`

### `POST /api/style-selection`

입력 핵심 필드:

- `uploadToken`
- `styleId`
- `analysis`

### `POST /api/generate`

입력 핵심 필드:

- `uploadToken`
- `styleId`
- `regenerateCount`
- `analysis`
- `recommendedStyles`

반환 핵심 필드:

- `representativeImages`
- `lifestyleImages`
- `oneLineIntro`
- `detailedDescription`
- `shortStoreCopy`
- `keywords`
- `hashtags`
- `generationMeta`

## 로컬 실행

### 1. 설치

```bash
npm install
```

Python worker를 같이 쓸 경우:

```bash
python3 -m venv .venv-image-worker
source .venv-image-worker/bin/activate
pip install -r requirements.txt
```

### 2. 개발 서버

권장:

```bash
npm run dev:3014
```

이 스크립트는 `.next`를 정리한 뒤 `3014` 포트로 dev 서버를 띄웁니다.

### 3. 타입 검사

```bash
npm run typecheck
```

### 4. 빌드

```bash
npm run build
```

## VM / 원격 worker 실행 예시

```bash
cd ~/Lifestyle_Shop
git pull origin feature/loah
source .venv-image-worker/bin/activate
pip install -r requirements.txt
export IMAGE_WORKER_PROFILE=full
export IMAGE_WORKER_DEVICE=cuda
export IMAGE_WORKER_PORT=8080
export IMAGE_WORKER_TOKEN='YOUR_TOKEN'
export IMAGE_REFINEMENT_ENABLED=false
uvicorn workers.image_worker.app:app --host 127.0.0.1 --port 8080
```

health 확인:

```bash
curl http://127.0.0.1:8080/health
curl http://127.0.0.1/health
```

## 주요 환경 변수

- `OPENAI_API_KEY`
- `IMAGE_WORKER_ENABLED`
- `IMAGE_WORKER_URL`
- `IMAGE_WORKER_TIMEOUT_MS`
- `IMAGE_WORKER_TOKEN`
- `IMAGE_WORKER_PROFILE`
- `IMAGE_WORKER_DEVICE`
- `IMAGE_REFINEMENT_ENABLED`
- `IMAGE_MODEL_BASE`
- `IMAGE_MODEL_CONTROLNET`
- `IMAGE_MODEL_IP_ADAPTER_REPO`
- `IMAGE_MODEL_IP_ADAPTER_WEIGHT`
- `IMAGE_NUM_INFERENCE_STEPS`
- `IMAGE_GUIDANCE_SCALE`
- `IMAGE_CONTROLNET_SCALE`
- `IMAGE_IP_ADAPTER_SCALE`

자세한 기본값은 [.env.example](/Users/apple/Lifestyle_Shop/.env.example)에 있습니다.

## 현재 한계

- 상품은 아직 “완전한 재생성”이 아니라 “배경 생성 + 상품 합성” 하이브리드입니다.
- 상품 위치, 원근, 스케일은 계속 개선 중이며 모든 카테고리에서 완벽하지 않습니다.
- 2-stage refinement는 품질은 좋아질 수 있지만 latency가 크게 늘어 기본값은 꺼져 있습니다.
- 레퍼런스는 스타일 전용으로 약화해서 쓰지만, 특정 테마에서는 공간 정보가 일부 남을 수 있습니다.
- 공개된 worker는 봇 스캔 트래픽을 받을 수 있으므로 Nginx 제한 설정을 권장합니다.

## 관련 문서

- `docs/mvp-blueprint.md`

Langfuse는 아래 조건일 때만 활성화됩니다.

- `LANGFUSE_PUBLIC_KEY`와 `LANGFUSE_SECRET_KEY`가 모두 있음
- `LANGFUSE_TRACING_ENABLED`가 `false` 또는 `0`이 아님

기본 `.env.example`은 tracing을 꺼 둔 상태입니다.

## 로깅

로그는 아래 파일에 append-only 형태로 저장됩니다.

- `storage/logs/generation-events.jsonl`

기록 이벤트:

- `styles_recommended`
- `style_selected`
- `package_generated`

Langfuse를 켜면 각 로그 레코드에 아래 추적 상관관계 필드도 함께 남습니다.

- `traceId`
- `spanId`

로그 목적:

- 사용자 입력 저장
- 선택 스타일 저장
- 생성 결과 저장
- 재생성/선택 행동 저장
- 향후 데이터셋 구축 기반 확보

## 현재 구현상의 판단

이 저장소는 "바로 실행 가능한 MVP 프론트엔드 + API + 추천/생성 오케스트레이션"에 초점을 둡니다.

실제 운영 단계에서 추가로 연결할 영역은 아래입니다.

- GCP L4 GPU에서 실제 모델 weight 사전 다운로드 및 캐시 운영
- `full` 프로파일과 `lite-mps` 프로파일의 성능 튜닝
- 업로드 원본 이미지 저장소
- 결과 이미지 CDN 저장
- Postgres 또는 BigQuery 기반 로그 적재
- 인증/사용자 계정/결제

## 주요 파일

- `app/page.tsx`: 단일 페이지 UX
- `app/api/recommend-styles/route.ts`: 스타일 추천 API
- `app/api/style-selection/route.ts`: 선택 로그 API
- `app/api/generate/route.ts`: 콘텐츠 패키지 생성 API
- `instrumentation.node.ts`: Langfuse OpenTelemetry 초기화
- `lib/langfuse.ts`: 서버 trace 래퍼
- `lib/style-presets.ts`: 6개 고정 스타일 정의
- `lib/style-recommender.ts`: 임베딩 + 휴리스틱 추천 로직
- `lib/prompt-builder.ts`: 이미지/카피 프롬프트 생성
- `lib/content-generator.ts`: GPT-5-mini / GPT-5-nano 기반 카피 생성
- `lib/image-output.ts`: worker 호출 + placeholder fallback 이미지 어댑터
- `lib/image-worker.ts`: Python worker HTTP 클라이언트
- `lib/storage-assets.ts`: 업로드/생성 이미지 스토리지 유틸
- `lib/logging.ts`: JSONL 로깅
- `workers/image_worker/app.py`: 프로파일 기반 FastAPI 이미지 worker
- `docs/mvp-blueprint.md`: 상세 설계 문서

## 검증 상태

현재 기준으로 아래 명령이 통과하는 상태입니다.

```bash
npm run typecheck
npm run build
```
