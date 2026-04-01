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

## 처음부터 끝까지 워크플로우

이 프로젝트의 전체 흐름은 아래 한 줄로 요약됩니다.

`상품 이미지 확보 -> 상품 분석 -> 스타일 3개 추천 -> 스타일 선택 -> 카피/이미지 생성 -> 결과 확인 -> 재생성/스타일 변경 -> 로그 축적`

### 0. 레퍼런스 준비

- 상품 샘플은 `references/` 아래에 카테고리별로 둡니다.
- 테마 레퍼런스는 `references/themes/*` 아래에 둡니다.
- 이 레퍼런스는 추천 카드 썸네일, 개발용 시드, 이미지 생성 스타일 conditioning의 공통 기준으로 사용됩니다.

### 1. 입력 단계

입력 경로는 두 가지입니다.

- 실제 상품 이미지를 업로드한다.
- 내부 QA/데모용 시드를 선택한다.

실제 업로드 흐름:

- 브라우저가 `POST /api/recommend-styles`로 이미지를 전송한다.
- 업로드 직후 사용자는 카테고리, 색감, 소재, 전체 톤, 메모를 선택 입력으로 보정할 수 있다.
- 선택 입력을 비워두면 해당 상세 정보는 `None` 기준으로 유지된다.
- 서버는 업로드 원본을 `storage/uploads/*`에 저장한다.
- 이후 추천, 생성, 로깅은 이 저장된 원본 경로를 공통으로 참조한다.

시드 흐름:

- 브라우저가 `GET /api/dev-seeds`로 샘플 입력을 불러온다.
- 시드는 `references/` 안의 실제 상품 이미지를 바로 사용한다.
- 이 경로는 최종 사용자용 핵심 기능이 아니라 개발 검증, QA, 데모를 빠르게 반복하기 위한 내부 보조 기능이다.

### 2. 상품 분석 단계

입력 이미지가 들어오면 서버는 `Product Analyzer`를 거쳐 아래 정보를 만든다.

- `uploadToken`
- `category`, `categoryLabel`
- `colorHints`
- `materialHints`
- `surfaceTone`
- `visualSummary`
- `sourceImageSource`
- `sourceImageRelativePath`
- `sourceImageUrl`

이 분석 결과는 이후 모든 단계의 기준 데이터다.

### 3. 스타일 추천 단계

추천은 `POST /api/recommend-styles` 안에서 처리된다.

동작 순서:

1. 상품 분석 결과를 텍스트로 정리한다.
2. 스타일 6개 설명과 embedding 유사도를 계산한다.
3. heuristic reranking을 적용한다.
4. 점수 상위 3개를 추천 카드로 반환한다.

reranking 반영 요소:

- 상품 카테고리
- 색감
- 소재
- 전체 톤

반환 값:

- top 3 스타일
- 전체 6개 스타일 점수
- 각 스타일 추천 이유
- 각 스타일 하이라이트
- 실제 테마 썸네일 프리뷰

### 4. 스타일 선택 단계

사용자가 추천 카드 중 하나를 고르면 `POST /api/style-selection`이 호출된다.

여기서 저장하는 정보:

- 업로드 식별자
- 추천된 3개 스타일
- 최종 선택 스타일
- fallback 여부

이 단계는 이후 어떤 스타일이 실제로 선택되었는지 학습 데이터로 남기기 위한 이벤트다.

### 5. 생성 준비 단계

사용자가 생성 버튼을 누르면 `POST /api/generate`가 호출된다.

서버는 먼저 `Prompt Builder`를 사용해 아래를 만든다.

- 대표 감성 이미지 프롬프트 1~2개
- 라이프스타일 이미지 프롬프트 1~2개
- negative prompt
- 스마트스토어용 카피 프롬프트
- 엄격한 JSON schema

여기서 스타일별 키워드, 조명, 장면 구성, 컬러톤이 모두 반영된다.

### 6. 콘텐츠 생성 단계

`/api/generate`는 텍스트와 이미지를 함께 준비한다.

텍스트 생성:

- 우선 `GPT-5-mini`
- 실패 또는 지연 시 `GPT-5-nano`
- 그래도 어려우면 템플릿 fallback

이미지 생성:

- worker가 비활성화되어 있으면 placeholder fallback
- worker가 활성화되어 있으면 Python image worker 호출
- 선택 스타일의 테마 레퍼런스 이미지를 함께 전달
- 상품 원본 이미지 경로도 함께 전달

worker 내부 프로파일:

- `full`
  원격 GPU용 `SDXL + ControlNet + IP-Adapter`
- `lite-mps`
  로컬 Apple Silicon용 `Stable Diffusion 1.5 + ControlNet + IP-Adapter`

라이프스타일 이미지는 아래 방향을 목표로 한다.

- 업로드한 상품 형태를 유지
- `references/themes/*` 분위기를 반영
- 선택한 스타일 공간 안에 자연스럽게 녹아들게 생성

### 7. 결과 패키지 반환 단계

최종 응답은 아래 패키지로 통일된다.

- 대표 감성 이미지 1~2개
- 라이프스타일 이미지 1~2개
- 상품 한 줄 소개
- 상세 설명
- 스마트스토어용 짧은 소개문구
- 키워드
- 해시태그
- `generationMeta`

프론트는 이 결과를 카드 형태로 나눠 보여주고, 텍스트마다 복사 버튼을 붙인다.

### 8. 재생성 / 스타일 변경 단계

사용자는 결과 화면에서 두 가지 액션을 할 수 있다.

- 같은 스타일로 다시 생성
- 다른 스타일로 바꿔 다시 생성

같은 스타일 재생성 시:

- `regenerateCount`가 증가한다.
- 같은 입력이어도 seed가 달라져 변형 결과를 만든다.

스타일 변경 시:

- 이미 계산된 추천 카드 목록에서 다시 선택한다.
- 같은 상품 분석 결과를 유지한 채 새로운 스타일 기준으로 재생성한다.

### 9. 로깅 / 관측 단계

각 단계의 이벤트는 JSONL과 Langfuse에 남는다.

주요 로그 이벤트:

- `styles_recommended`
- `style_selected`
- `package_generated`

핵심 로그 필드:

- `uploadIdentifier`
- `recommendedStyles`
- `finalSelectedStyle`
- `generationResult`
- `isRegenerated`
- `fallbackUsed`
- `generatedAt`
- `traceId`
- `spanId`

즉, 이 프로젝트는 단순 생성기라기보다 `입력 -> 추천 -> 선택 -> 생성 -> 재선택` 전체 루프를 데이터로 남기는 MVP다.

## 현재 구현 범위

이 저장소에는 실제로 실행 가능한 MVP 앱 골격이 포함되어 있습니다.

- `Next.js 15 + React 19 + TypeScript` 기반 단일 페이지 UI
- 필수 UX 플로우 구현
- 정확히 6개의 고정 스타일 프리셋 구현
- 업로드 이미지 기반 상품 분석
- 스타일 3개 추천 API
- 스타일 선택 이벤트 저장 API
- 전체 콘텐츠 패키지 생성 API
- JSONL 기반 로그 저장
- Docker 기반 실행 기본 세팅
- Langfuse tracing 기본 세팅
- `OPENAI_API_KEY`가 있을 때:
  - `text-embedding-3-small`로 스타일 매칭
  - `gpt-5-mini` 1차 시도
  - `gpt-5-nano` fallback 시도
- `OPENAI_API_KEY`가 없을 때:
  - 결정적 휴리스틱 추천
  - 템플릿 기반 카피 생성 fallback

## 중요한 현재 상태

문구 생성과 추천은 바로 동작합니다.  
이미지 생성은 이제 프로파일 기반 워커에 연결되는 구조입니다.

- `full`: `SDXL + ControlNet + IP-Adapter`, 원격 NVIDIA GPU 기준
- `lite-mps`: `Stable Diffusion 1.5 + ControlNet + IP-Adapter`, Apple Silicon 로컬 확인용 경량 경로

워커가 켜져 있지 않거나 모델이 준비되지 않은 경우에는 자동으로 deterministic placeholder 이미지로 fallback 됩니다.

즉, 이 저장소는 "실행 가능한 MVP 오케스트레이션 레이어 + 실제 이미지 워커 연결 지점"까지 포함합니다.

## 고정 스타일 프리셋

아래 6개 스타일이 정확히 구현되어 있습니다.

1. 모던 미니멀
2. 내추럴 우드
3. 북유럽 라이트톤
4. 프렌치 빈티지
5. 코지 홈카페
6. 일본식 담백한 식탁

각 스타일에는 아래 정보가 포함됩니다.

- 프롬프트 템플릿
- 조명 설명
- 장면 구성
- 컬러톤

구현 파일:

- `lib/style-presets.ts`

## 출력 패키지

생성 결과는 아래 패키지 기준으로 맞춰져 있습니다.

- 대표 감성 이미지 1~2개
- 라이프스타일 이미지 1~2개
- 상품 한 줄 소개
- 상세 설명
- 스마트스토어용 짧은 소개문구
- 키워드
- 해시태그

스타일링 팁은 출력에 포함하지 않습니다.

## 핵심 UX 플로우

현재 UI는 아래 순서를 그대로 따른다.

1. 이미지 업로드 또는 테스트 시드 선택
2. 스타일 3개 추천 카드 확인
3. 스타일 1개 선택
4. 생성 버튼 클릭
5. 결과 패키지 카드 확인
6. 복사 / 재생성 / 스타일 변경

구현 파일:

- `app/page.tsx`

## 아키텍처 요약

```text
[브라우저]
  -> 상품 이미지 업로드
  -> 스타일 추천 확인
  -> 스타일 선택
  -> 콘텐츠 생성 요청

[Next.js App Router]
  -> /api/recommend-styles
     -> Product Analyzer
     -> 업로드 원본 storage/uploads 저장
     -> Embedding / Heuristic Recommender
     -> Langfuse Trace
     -> Logger

  -> /api/style-selection
     -> Langfuse Trace
     -> Selection Logger

  -> /api/generate
     -> Prompt Builder
     -> LLM Orchestrator
     -> Image Orchestrator Adapter
        -> IMAGE_WORKER_ENABLED=true 이면 worker 호출
        -> worker 미응답 시 placeholder fallback
     -> Langfuse Trace
     -> Logger

[Storage]
  -> storage/uploads/*
  -> storage/generated/*
  -> storage/logs/generation-events.jsonl

[Python Image Worker]
  -> FastAPI
  -> profile=full
     -> SDXL base
     -> SDXL ControlNet (canny)
     -> IP-Adapter
  -> profile=lite-mps
     -> Stable Diffusion 1.5
     -> ControlNet (canny)
     -> IP-Adapter
  -> references/themes/* 스타일 레퍼런스 사용

[Observability]
  -> Langfuse Cloud or Self-hosted Endpoint

[Container Runtime]
  -> Dockerfile
  -> docker-compose.yml
```

상세 설계 문서:

- `docs/mvp-blueprint.md`

## 폴더 구조

```text
.
├─ app
│  ├─ api
│  │  ├─ dev-seeds/route.ts
│  │  ├─ generate/route.ts
│  │  ├─ recommend-styles/route.ts
│  │  └─ style-selection/route.ts
│  ├─ globals.css
│  ├─ layout.tsx
│  └─ page.tsx
├─ .dockerignore
├─ .env.example
├─ Dockerfile
├─ docs
│  └─ mvp-blueprint.md
├─ workers
│  └─ image_worker
│     ├─ app.py
│     └─ Dockerfile
├─ instrumentation.node.ts
├─ instrumentation.ts
├─ lib
│  ├─ content-generator.ts
│  ├─ dev-seeds.ts
│  ├─ image-output.ts
│  ├─ langfuse.ts
│  ├─ logging.ts
│  ├─ product-analyzer.ts
│  ├─ prompt-builder.ts
│  ├─ style-presets.ts
│  ├─ style-recommender.ts
│  ├─ types.ts
│  └─ utils.ts
├─ docker-compose.yml
├─ storage
│  ├─ generated
│  ├─ logs
│  └─ uploads
├─ package.json
├─ next.config.ts
└─ tsconfig.json
```

## API

### `POST /api/recommend-styles`

상품 이미지 업로드 후 추천 스타일 3개를 반환합니다.

입력:

- `multipart/form-data`
- `file`

응답 핵심 필드:

- `analysis`
- `recommendations`

### `POST /api/style-selection`

사용자가 어떤 스타일을 선택했는지 로그로 저장합니다.

입력 핵심 필드:

- `uploadToken`
- `styleId`
- `analysis`

### `POST /api/generate`

선택 스타일 기준으로 전체 콘텐츠 패키지를 생성합니다.

입력 핵심 필드:

- `uploadToken`
- `styleId`
- `regenerateCount`
- `analysis`

응답 핵심 필드:

- `representativeImages`
- `lifestyleImages`
- `oneLineIntro`
- `detailedDescription`
- `shortStoreCopy`
- `keywords`
- `hashtags`
- `generationMeta`

실제 이미지 생성이 켜져 있으면 `generationMeta.imageEngine`은 worker 엔진 이름을 반환하고, fallback 시에는 placeholder 엔진 이름을 반환합니다.

더 자세한 요청/응답 예시는 `docs/mvp-blueprint.md`에 정리되어 있습니다.

## 로컬 실행

### 1. 설치

```bash
npm install
```

만약 로컬 npm 캐시 권한 이슈가 있으면 아래처럼 실행하면 됩니다.

```bash
npm install --cache .npm-cache
```

### 2. 개발 서버 실행

```bash
npm run dev
```

### 3. 타입 검사

```bash
npm run typecheck
```

### 4. 프로덕션 빌드

```bash
npm run build
```

### 5. Docker로 실행

```bash
cp .env.example .env
docker compose config
docker compose up --build
```

기본 포트는 `3000`입니다.

이 compose 설정은 `standalone` 기반 프로덕션 실행을 기준으로 잡혀 있습니다. 로컬 개발 핫리로드는 기존처럼 `npm run dev`를 사용하는 편이 단순합니다.

이미지 워커까지 같이 띄우려면:

```bash
docker compose --profile gpu up --build
```

그리고 `.env`에서 아래를 켭니다.

```bash
IMAGE_WORKER_ENABLED=true
IMAGE_WORKER_URL=http://image-worker:8001
```

Apple Silicon 로컬 확인용으로는 Docker보다 직접 worker를 띄우는 편이 낫습니다. Docker Desktop 안에서는 `mps` 가속을 그대로 쓰지 못하기 때문입니다.

M1 8GB 기준 권장 설정:

```bash
IMAGE_WORKER_ENABLED=true
IMAGE_WORKER_PROFILE=lite-mps
IMAGE_WORKER_DEVICE=mps
IMAGE_WORKER_URL=http://127.0.0.1:8001
IMAGE_WORKER_TIMEOUT_MS=240000
uvicorn workers.image_worker.app:app --host 0.0.0.0 --port 8001
```

`lite-mps`는 로컬 미리보기용 경량 프로파일입니다. 속도와 품질은 원격 GPU의 `full` 프로파일보다 낮지만, 테마 레퍼런스를 반영한 실제 라이프스타일 이미지 확인에는 쓸 수 있게 설계했습니다.
첫 실행은 공개 모델과 adapter weight 다운로드 때문에 수 분이 걸릴 수 있습니다.
기본 모델 캐시는 저장소 내부의 `.cache/huggingface`를 사용합니다.

운영 시 자주 조정하는 값:

- `APP_PORT`
- `APP_STORAGE_PATH`
- `APP_RESTART_POLICY`
- `APP_LOG_MAX_SIZE`
- `APP_LOG_MAX_FILE`

## 환경 변수

### 필수는 아님

- `OPENAI_API_KEY`
- `LANGFUSE_TRACING_ENABLED`
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_BASE_URL`
- `LANGFUSE_TRACING_ENVIRONMENT`
- `LANGFUSE_RELEASE`
- `IMAGE_WORKER_ENABLED`
- `IMAGE_WORKER_URL`
- `IMAGE_WORKER_TOKEN`
- `IMAGE_WORKER_PROFILE`
- `IMAGE_WORKER_DEVICE`
- `IMAGE_MODEL_BASE`
- `IMAGE_MODEL_CONTROLNET`
- `IMAGE_MODEL_IP_ADAPTER_REPO`
- `IMAGE_MODEL_IP_ADAPTER_WEIGHT`

설정되면 아래 모델을 사용합니다.

- `text-embedding-3-small`
- `gpt-5-mini`
- `gpt-5-nano`

설정되지 않으면 fallback 모드로 동작합니다.

- 추천: 휴리스틱 기반
- 문구 생성: 템플릿 기반
- 이미지 생성: placeholder 기반

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
