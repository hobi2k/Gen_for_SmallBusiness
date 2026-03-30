# 오프라인 리빙 소품 상인용 AI 감성 판매 콘텐츠 MVP 설계

## 1. 아키텍처

### 1-1. 텍스트 다이어그램

```text
[사용자 브라우저]
  -> 이미지 업로드
  -> 추천 스타일 3개 확인
  -> 스타일 선택 / 생성 / 재생성

[Next.js App Router]
  -> /api/recommend-styles
     -> Product Analyzer
        -> 파일 메타데이터 추출
        -> 카테고리/재질 태깅
        -> text-embedding-3-small 기반 스타일 매칭
     -> Logger

  -> /api/style-selection
     -> 사용자 선택 로그 저장

  -> /api/generate
     -> Prompt Builder
        -> 선택 스타일을 구조화된 이미지 프롬프트로 변환
        -> 상세페이지용 문구 프롬프트 생성
     -> LLM Orchestrator
        -> 1차: GPT-5-mini
        -> 2차 fallback: GPT-5-nano
     -> Image Orchestrator
        -> SDXL
        -> ControlNet
        -> IP-Adapter
        -> 단일 GCP L4 GPU
     -> Post Processor
        -> 이미지 내 텍스트 금지
        -> 1:1 / 4:5 / 9:16 리사이즈
     -> Logger

[Storage]
  -> generation-events.jsonl
  -> 추후 DB 적재용 원본 로그
```

### 1-2. 모듈 역할

- `Next.js UI`: 저디지털 숙련 사용자를 위한 단일 화면 플로우 제공
- `Product Analyzer`: 업로드 이미지에서 상품 카테고리와 재질 힌트를 뽑고 추천 입력 텍스트 생성
- `Embedding Matcher`: 고정된 6개 스타일과 상품 서술 간 유사도를 계산해 상위 3개 추천
- `Prompt Builder`: 선택한 스타일을 이미지 생성 프롬프트와 판매 문구 프롬프트로 구조화
- `LLM Orchestrator`: 한 줄 소개, 상세 설명, 짧은 소개문구, 키워드/해시태그 생성
- `Image Orchestrator`: SDXL + ControlNet + IP-Adapter로 대표 이미지와 라이프스타일 이미지 생성
- `Logger`: 사용자 입력, 선택 스타일, 결과물, 선택 이벤트를 데이터셋용 원본으로 저장

## 2. 폴더 구조

```text
.
├─ app
│  ├─ api
│  │  ├─ generate
│  │  │  └─ route.ts
│  │  ├─ recommend-styles
│  │  │  └─ route.ts
│  │  └─ style-selection
│  │     └─ route.ts
│  ├─ globals.css
│  ├─ layout.tsx
│  └─ page.tsx
├─ docs
│  └─ mvp-blueprint.md
├─ lib
│  ├─ content-generator.ts
│  ├─ image-output.ts
│  ├─ logging.ts
│  ├─ product-analyzer.ts
│  ├─ prompt-builder.ts
│  ├─ style-presets.ts
│  ├─ style-recommender.ts
│  ├─ types.ts
│  └─ utils.ts
├─ storage
│  └─ logs
│     └─ .gitkeep
├─ next.config.ts
├─ package.json
└─ tsconfig.json
```

## 3. API 설계

### `POST /api/recommend-styles`

목적:
업로드 이미지로 상품 힌트를 생성하고 스타일 3개를 추천

입력:

- `multipart/form-data`
- `file`: 상품 이미지

응답:

```json
{
  "analysis": {
    "uploadToken": "string",
    "fileName": "white_plate.jpg",
    "category": "plate",
    "categoryLabel": "접시",
    "materialNotes": "세라믹, 유광 마감",
    "visualSummary": "정갈한 비율의 접시",
    "detectedTags": ["plate", "ceramic"]
  },
  "recommendations": [
    {
      "styleId": "modern-minimal",
      "name": "모던 미니멀",
      "score": 0.92,
      "reason": "제품의 단정한 실루엣과 밝은 톤이 잘 맞습니다."
    }
  ]
}
```

### `POST /api/style-selection`

목적:
사용자가 어떤 스타일을 눌렀는지 저장

입력:

```json
{
  "uploadToken": "string",
  "styleId": "cozy-home-cafe",
  "analysis": {
    "category": "cup"
  }
}
```

응답:

```json
{
  "ok": true
}
```

### `POST /api/generate`

목적:
선택 스타일 기준으로 전체 콘텐츠 패키지 생성

입력:

```json
{
  "uploadToken": "string",
  "styleId": "nordic-light",
  "regenerateCount": 0,
  "analysis": {
    "category": "glassware",
    "categoryLabel": "유리잔"
  }
}
```

응답:

```json
{
  "representativeImages": [
    {
      "id": "img_1",
      "kind": "representative",
      "aspectRatio": "1:1",
      "url": "https://..."
    }
  ],
  "lifestyleImages": [
    {
      "id": "img_2",
      "kind": "lifestyle",
      "aspectRatio": "4:5",
      "url": "https://..."
    }
  ],
  "oneLineIntro": "공간을 정돈해 보이게 만드는 담백한 한 점.",
  "detailedDescription": "....",
  "shortStoreCopy": "오늘의 식탁을 맑게 정리해주는 감성 테이블웨어",
  "keywords": ["리빙소품", "접시", "북유럽무드"],
  "hashtags": ["#리빙소품", "#홈스타일링"],
  "generationMeta": {
    "targetLatencyMs": 8000,
    "llmModel": "gpt-5-mini",
    "imageEngine": "sdxl-controlnet-ipadapter"
  }
}
```

## 4. 프롬프트 템플릿

### 공통 규칙

- 상품의 형태와 비율은 유지
- 이미지 안에 텍스트, 로고, 워터마크 금지
- 배경은 과하지 않게, 상품이 주인공이 되도록 유지
- 대표 이미지 1~2개, 라이프스타일 이미지 1~2개
- 결과 문구에는 스타일링 팁을 포함하지 않음

### 스타일별 템플릿

#### 1. 모던 미니멀

- 조명: 부드러운 확산광, 그림자는 얕고 짧게
- 장면: 비어 있는 여백이 많은 스튜디오형 식탁 또는 매트한 상판
- 컬러톤: 웜 그레이, 아이보리, 차콜 포인트
- 프롬프트 템플릿:
  `업로드된 {{product_category}}의 형태와 재질감을 유지한다. 모던 미니멀 무드의 상업용 감성 컷. 넓은 여백, 정돈된 구도, 군더더기 없는 소품, 매트한 표면, 절제된 레이어, {{lighting_description}}, {{scene_setup}}, {{color_tone}}, photorealistic, premium ecommerce, no text, no watermark.`

#### 2. 내추럴 우드

- 조명: 오전 햇살 느낌의 따뜻한 자연광
- 장면: 오크 혹은 월넛 테이블 위, 린넨 천과 나무 질감 소품
- 컬러톤: 베이지, 허니 브라운, 세이지
- 프롬프트 템플릿:
  `업로드된 {{product_category}}를 중심으로 내추럴 우드 스타일의 생활감 있는 연출을 만든다. 원목 질감이 살아 있는 테이블, 린넨 패브릭, 과하지 않은 식물 포인트, {{lighting_description}}, {{scene_setup}}, {{color_tone}}, realistic product photography, preserve product identity, no text, no watermark.`

#### 3. 북유럽 라이트톤

- 조명: 창가에서 들어오는 밝고 맑은 확산광
- 장면: 화이트 오크 가구와 밝은 패브릭이 있는 정갈한 다이닝
- 컬러톤: 소프트 화이트, 라이트 우드, 페일 블루
- 프롬프트 템플릿:
  `업로드된 {{product_category}}를 북유럽 라이트톤 공간에 배치한다. 밝은 목재, 맑은 화이트 패브릭, 깨끗한 공기감, 담백한 소품 배치, {{lighting_description}}, {{scene_setup}}, {{color_tone}}, premium lifestyle commerce shot, natural realism, no text, no watermark.`

#### 4. 프렌치 빈티지

- 조명: 오후의 부드러운 측면광, 약간의 필름성 질감
- 장면: 빈티지 원목 가구, 앤티크 패브릭, 클래식 소품이 있는 식탁
- 컬러톤: 크림, 더스티 로즈, 앤티크 브라운
- 프롬프트 템플릿:
  `업로드된 {{product_category}}의 실제 제품 특징을 유지하면서 프렌치 빈티지 무드로 연출한다. 오래된 원목 가구, 부드러운 패브릭 주름, 우아한 앤티크 디테일, {{lighting_description}}, {{scene_setup}}, {{color_tone}}, romantic but realistic product photography, no text, no watermark.`

#### 5. 코지 홈카페

- 조명: 따뜻하고 포근한 실내광, 음영은 부드럽게
- 장면: 홈카페 테이블, 커피 도구, 베이커리 소품이 있는 편안한 장면
- 컬러톤: 크림, 카라멜, 코코아 브라운
- 프롬프트 템플릿:
  `업로드된 {{product_category}}를 코지 홈카페 분위기의 감성 장면에 배치한다. 포근한 우드 테이블, 커피와 디저트가 암시되는 구성, 따뜻한 생활감, {{lighting_description}}, {{scene_setup}}, {{color_tone}}, realistic lifestyle commerce image, preserve exact product identity, no text, no watermark.`

#### 6. 일본식 담백한 식탁

- 조명: 잔잔하고 균일한 자연광, 대비는 낮게
- 장면: 절제된 한식 또는 일식 상차림 느낌의 단정한 테이블
- 컬러톤: 오프화이트, 애쉬 우드, 먹색
- 프롬프트 템플릿:
  `업로드된 {{product_category}}를 일본식 담백한 식탁 무드로 연출한다. 절제된 상차림, 낮은 채도, 정갈한 배치, 최소한의 소품, {{lighting_description}}, {{scene_setup}}, {{color_tone}}, clean realistic tabletop photography, preserve product form exactly, no text, no watermark.`

### 판매 문구 프롬프트

```text
당신은 오프라인 리빙 소품 상인을 위한 커머스 카피라이터다.
출력은 반드시 JSON만 반환한다.
스타일링 팁은 절대 포함하지 않는다.

입력:
- 상품 카테고리: {{product_category_label}}
- 상품 인상: {{visual_summary}}
- 재질 메모: {{material_notes}}
- 선택 스타일: {{style_name}}
- 조명: {{lighting_description}}
- 장면: {{scene_setup}}
- 컬러톤: {{color_tone}}

출력 스키마:
{
  "oneLineIntro": "상품 한 줄 소개",
  "detailedDescription": "2~4문장 상세 설명",
  "shortStoreCopy": "스마트스토어용 짧은 소개문구",
  "keywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
  "hashtags": ["#태그1", "#태그2", "#태그3", "#태그4", "#태그5"]
}
```

## 5. UX 플로우

1. 사용자는 상품 이미지를 업로드한다.
2. 시스템은 업로드 즉시 상품 힌트를 분석하고 상위 3개 스타일을 추천한다.
3. 사용자는 추천 카드 또는 전체 스타일 목록에서 하나를 선택한다.
4. 사용자는 `콘텐츠 생성` 버튼을 누른다.
5. 시스템은 대표 감성 이미지 1~2개, 라이프스타일 이미지 1~2개, 한 줄 소개, 상세 설명, 짧은 소개문구, 키워드/해시태그를 보여준다.
6. 사용자는 `다시 생성` 또는 다른 스타일 재선택으로 즉시 반복할 수 있다.

단순성 원칙:

- 단일 페이지
- 업로드 후 자동 추천
- 결과는 카드형으로 한 화면에 묶어서 출력
- 고급 옵션은 노출하지 않음

## 6. 최적화 전략

### 정확도

- 상품 이미지에서 카테고리/재질 태그를 먼저 추출
- 고정 6개 스타일 설명문을 임베딩해 유사도 비교
- 임베딩 점수와 카테고리 기반 휴리스틱 점수를 혼합

### 일관성

- `uploadToken + styleId + regenerateCount` 기반 결정적 seed 생성
- 최초 생성은 동일 seed 고정
- 재생성 시 seed만 의도적으로 증분
- 이미지 프롬프트와 카피 프롬프트 모두 동일한 구조 사용

### 속도

- 스타일 설명 임베딩은 서버 메모리 캐시
- 업로드 분석과 스타일 추천은 이미지 생성과 분리
- 생성 API에서는 프롬프트 빌드와 카피 생성을 병렬화
- 실제 운영 시 SDXL는 Lightning/LCM 계열 가속 설정으로 6~8 step 목표

### UX 단순성

- 사용자가 이해해야 할 개념은 `이미지 업로드 -> 스타일 선택 -> 생성` 세 가지뿐
- 스타일 설명은 1문장으로 제한
- 결과 영역은 이미지와 텍스트 패키지를 분리해 읽기 쉽게 배치

### 제어 가능성

- 추천 3개 + 전체 6개 스타일 모두 즉시 재선택 가능
- `다시 생성` 버튼으로 같은 스타일 내 변형 생성
- 로그에 선택 이력을 남겨 개인화 추천 데이터로 전환 가능

## 7. 로깅 설계

저장 필드:

- `userInput`
  - fileName
  - uploadToken
  - inferredCategory
  - detectedTags
- `selectedStyle`
  - styleId
  - styleName
- `generatedOutputs`
  - representativeImages
  - lifestyleImages
  - oneLineIntro
  - detailedDescription
  - shortStoreCopy
  - keywords
  - hashtags
- `userSelection`
  - 추천 카드 클릭 여부
  - 최종 생성 스타일
  - regenerate 횟수

권장 이벤트 타입:

- `styles_recommended`
- `style_selected`
- `package_generated`

권장 저장 전략:

- 초기 MVP: JSONL append-only 로그
- 운영 단계: Postgres/BigQuery 적재
- 분석 단위: `uploadToken` 기준 세션 묶음
