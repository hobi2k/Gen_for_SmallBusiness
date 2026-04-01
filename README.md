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
이미지 생성은 향후 `SDXL + ControlNet + IP-Adapter` 워커에 연결할 수 있도록 API와 프롬프트 구조를 잡아둔 상태이며, 현재 로컬 MVP에서는 deterministic placeholder 이미지를 반환합니다.

즉, 이 저장소는 다음 단계로 확장 가능한 "실행 가능한 MVP 오케스트레이션 레이어"입니다.

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

현재 UI는 아래 순서를 그대로 따릅니다.

1. 사용자가 상품 이미지를 업로드한다.
2. 시스템이 3개의 추천 스타일을 보여준다.
3. 사용자가 하나의 스타일을 선택한다.
4. 사용자가 생성 버튼을 누른다.
5. 시스템이 전체 콘텐츠 패키지를 출력한다.
6. 사용자가 다시 생성하거나 스타일을 바꾼다.

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
     -> Langfuse Trace
     -> Logger

[Storage]
  -> storage/logs/generation-events.jsonl

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
│  └─ logs
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

설정되면 아래 모델을 사용합니다.

- `text-embedding-3-small`
- `gpt-5-mini`
- `gpt-5-nano`

설정되지 않으면 fallback 모드로 동작합니다.

- 추천: 휴리스틱 기반
- 문구 생성: 템플릿 기반

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

- GCP L4 GPU 기반 이미지 생성 워커
- SDXL + ControlNet + IP-Adapter inference 서버
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
- `lib/image-output.ts`: 현재 placeholder 이미지 출력, 이후 이미지 엔진 어댑터로 교체 가능
- `lib/logging.ts`: JSONL 로깅
- `docs/mvp-blueprint.md`: 상세 설계 문서

## 검증 상태

현재 기준으로 아래 명령이 통과하는 상태입니다.

```bash
npm run typecheck
npm run build
```
