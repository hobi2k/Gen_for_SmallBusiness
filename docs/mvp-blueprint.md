# 오프라인 리빙 소품 상인용 AI 감성 판매 콘텐츠 MVP 설계

## 1. 아키텍처

### 1-1. 텍스트 다이어그램

```text
[사용자 브라우저]
  -> 이미지 업로드 또는 테스트 시드 선택
  -> 추천 스타일 3개 카드 확인
  -> 스타일 선택
  -> 콘텐츠 생성 / 재생성
  -> 텍스트 출력 개별 복사

[Next.js App Router]
  -> /api/recommend-styles
     -> Product Analyzer
        -> 파일 메타데이터 추출
        -> 카테고리 추정
        -> 색감 단서 추정
        -> 소재 단서 추정
     -> Embedding Matcher
        -> text-embedding-3-small
     -> Heuristic Reranker
        -> 카테고리 가중치
        -> 색감 가중치
        -> 소재 가중치
        -> 전체 톤 가중치
     -> Recommendation Reason Builder
     -> Logger

  -> /api/style-selection
     -> 최종 선택 로그 저장

  -> /api/generate
     -> Prompt Builder
        -> 스타일별 핵심 키워드 반영
        -> 출력 타입별 카피 규칙 반영
        -> 엄격한 JSON 스키마 지시
     -> LLM Orchestrator
        -> 1차: GPT-5-mini
        -> 2차 fallback: GPT-5-nano
        -> 최종 fallback: 템플릿 생성
     -> Image Orchestrator Adapter
        -> 현재: deterministic placeholder
        -> 운영 확장: SDXL + ControlNet + IP-Adapter on GCP L4
     -> Logger

  -> /api/dev-seeds
     -> 6개 테스트 시드 제공
     -> 시드별 추천 결과 사전 계산

[Storage]
  -> storage/logs/generation-events.jsonl
```

### 1-2. 모듈 역할

- `Product Analyzer`: 업로드 파일명과 메타데이터에서 카테고리, 색감, 소재 단서를 추정
- `Embedding Matcher`: 상품 서술과 6개 스타일 서술의 의미 유사도를 계산
- `Heuristic Reranker`: embedding 점수 위에 카테고리, 색감, 소재, 전체 톤 규칙을 다시 적용
- `Recommendation Reason Builder`: 왜 이 스타일이 맞는지 사람이 읽을 수 있는 이유와 하이라이트를 생성
- `Prompt Builder`: 스타일 프롬프트와 카피 프롬프트를 구조화
- `Content Generator`: 출력 타입별 규칙을 따르는 JSON 결과를 생성하고 검증
- `Logger`: 추천, 선택, 생성, fallback 여부를 추후 데이터셋 용도로 축적

## 2. 폴더 구조

```text
.
├─ app
│  ├─ api
│  │  ├─ dev-seeds
│  │  │  └─ route.ts
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
│  ├─ dev-seeds.ts
│  ├─ image-output.ts
│  ├─ logging.ts
│  ├─ product-analyzer.ts
│  ├─ prompt-builder.ts
│  ├─ style-presets.ts
│  ├─ style-recommender.ts
│  ├─ types.ts
│  └─ utils.ts
└─ storage
   └─ logs
```

## 3. API 설계

### `POST /api/recommend-styles`

목적:
업로드 이미지 기반 상품 분석 후 추천 스타일 3개와 전체 6개 점수 결과를 반환

입력:

- `multipart/form-data`
- `file`

응답:

```json
{
  "analysis": {
    "uploadToken": "string",
    "category": "plate",
    "categoryLabel": "접시",
    "colorHints": ["white", "neutral"],
    "materialHints": ["ceramic"],
    "surfaceTone": "cool"
  },
  "recommendations": [
    {
      "styleId": "modern-minimal",
      "name": "모던 미니멀",
      "score": 0.93,
      "reason": "모던 미니멀은 화이트 톤과 조화, 접시 카테고리 적합 조건이 겹쳐 접시에 특히 잘 맞습니다.",
      "reasonHighlights": ["화이트 톤과 조화", "접시 카테고리 적합"],
      "thumbnailUrl": "data:image/svg+xml,..."
    }
  ],
  "allStyles": [],
  "fallbackUsed": false
}
```

### `POST /api/style-selection`

목적:
추천 3개 중 사용자가 실제로 선택한 스타일을 저장

입력 핵심 필드:

- `uploadToken`
- `styleId`
- `analysis`
- `recommendedStyles`
- `fallbackUsed`

### `POST /api/generate`

목적:
선택 스타일 기준으로 전체 콘텐츠 패키지를 생성

입력 핵심 필드:

- `uploadToken`
- `styleId`
- `regenerateCount`
- `analysis`
- `recommendedStyles`
- `recommendationFallbackUsed`

응답 핵심 필드:

- `representativeImages`
- `lifestyleImages`
- `oneLineIntro`
- `detailedDescription`
- `shortStoreCopy`
- `keywords`
- `hashtags`
- `generationMeta`

### `GET /api/dev-seeds`

목적:
테스트용 시드 6종과 각 시드의 추천 결과를 반환

## 4. 스타일 프롬프트 설계

### 공통 규칙

- 상품의 형태와 비율은 유지
- 이미지 안에 텍스트, 로고, 워터마크 금지
- 배경은 과하지 않게, 상품이 주인공이 되도록 유지
- 대표 이미지 1~2개, 라이프스타일 이미지 1~2개
- 결과 문구에는 스타일링 팁을 포함하지 않음

### 스타일별 핵심 키워드

#### 1. 모던 미니멀

- 조명: 부드러운 확산광, 그림자는 얕고 짧게
- 장면: 비어 있는 여백이 많은 스튜디오형 식탁 또는 매트한 상판
- 컬러톤: 웜 그레이, 아이보리, 차콜 포인트
- 핵심 키워드:
  - `clean composition`
  - `white background`
  - `soft shadow`
  - `minimal objects`
  - `product centered`

#### 2. 내추럴 우드

- 조명: 오전 햇살 느낌의 따뜻한 자연광
- 장면: 오크 또는 월넛 테이블 위, 린넨 천과 나무 질감 소품
- 컬러톤: 베이지, 허니 브라운, 세이지
- 핵심 키워드:
  - `wooden table`
  - `linen fabric`
  - `warm natural light`
  - `earthy tone`

#### 3. 북유럽 라이트톤

- 조명: 창가에서 들어오는 밝고 맑은 확산광
- 장면: 화이트 오크 가구와 밝은 패브릭이 있는 정갈한 다이닝
- 컬러톤: 소프트 화이트, 라이트 우드, 페일 블루
- 핵심 키워드:
  - `bright lighting`
  - `white + gray palette`
  - `simple and functional`
  - `airy feeling`

#### 4. 프렌치 빈티지

- 조명: 오후의 부드러운 측면광, 약간의 필름성 질감
- 장면: 빈티지 원목 가구, 앤티크 패브릭, 클래식 소품이 있는 식탁
- 컬러톤: 크림, 더스티 로즈, 앤티크 브라운
- 핵심 키워드:
  - `soft pastel tones`
  - `antique texture`
  - `elegant table setting`
  - `classic props`

#### 5. 코지 홈카페

- 조명: 따뜻하고 포근한 실내광, 음영은 부드럽게
- 장면: 홈카페 테이블, 커피 도구, 베이커리 소품이 있는 편안한 장면
- 컬러톤: 크림, 카라멜, 코코아 브라운
- 핵심 키워드:
  - `warm light`
  - `coffee mood`
  - `dessert props`
  - `cozy atmosphere`

#### 6. 일본식 담백한 식탁

- 조명: 잔잔하고 균일한 자연광, 대비는 낮게
- 장면: 절제된 상차림의 단정한 식탁
- 컬러톤: 오프화이트, 애쉬 우드, 먹색
- 핵심 키워드:
  - `clean layout`
  - `low saturation`
  - `calm mood`
  - `simple plating`

## 5. Heuristic Reranking 규칙

추천은 두 단계로 계산한다.

1. `text-embedding-3-small` 기반 의미 유사도 계산
2. 아래 규칙으로 heuristic reranking 수행

### 카테고리 규칙

- 접시/트레이/커트러리: `모던 미니멀` 기본 가중치가 높다.
- 볼: `일본식 담백한 식탁`, `내추럴 우드`가 강하다.
- 컵/유리잔: `코지 홈카페`, `북유럽 라이트톤`이 강하다.

### 색감 규칙

- 화이트/그레이/투명: `모던 미니멀`, `북유럽 라이트톤` 가중치 상승
- 베이지/브라운/어스톤: `내추럴 우드`, `코지 홈카페` 상승
- 크림/핑크/아이보리: `프렌치 빈티지` 상승
- 낮은 채도/중성 톤: `일본식 담백한 식탁` 상승

### 소재 규칙

- 유리: `북유럽 라이트톤`, `코지 홈카페`, `모던 미니멀` 상승
- 우드: `내추럴 우드` 상승
- 메탈: `모던 미니멀`, `일본식 담백한 식탁` 상승
- 세라믹: 전반적으로 잘 맞지만 `일본식 담백한 식탁`, `프렌치 빈티지`, `내추럴 우드`에 추가 점수

### 전체 톤 규칙

- warm: `내추럴 우드`, `코지 홈카페`, `프렌치 빈티지`
- cool: `모던 미니멀`, `북유럽 라이트톤`
- neutral: `일본식 담백한 식탁`

## 6. 추천 이유 설계

추천 이유는 사람이 이해할 수 있는 문장과 하이라이트를 동시에 만든다.

- `reason`: 완전한 한 문장 설명
- `reasonHighlights`: 2~3개의 짧은 근거

예시:

- `화이트 톤과 조화`
- `유리 질감과 적합`
- `접시 카테고리 적합`
- `따뜻한 전체 톤과 일치`

즉, 추천 이유는 "이 스타일이 예쁘다"가 아니라 "왜 이 스타일이 이 상품과 맞는지"를 설명하는 역할이다.

## 7. Content Generator 규칙

출력은 반드시 JSON만 허용하고, 아래 규칙을 모두 만족해야 한다.

- `oneLineIntro`
  - 감성 중심
  - 짧은 한 문장
  - 기억에 남는 표현
- `detailedDescription`
  - 2~4문장
  - 소재, 인상, 판매 맥락 포함
  - 스타일링 팁 금지
- `shortStoreCopy`
  - 스마트스토어 상단용
  - 더 직접적이고 짧게
- `keywords`
  - 정확히 5개
  - 해시 기호 금지
- `hashtags`
  - 정확히 5개
  - 모두 `#`로 시작

스타일별 톤도 분리한다.

- `모던 미니멀`: 절제되고 선명한 어조
- `내추럴 우드`: 따뜻하고 생활감 있는 어조
- `북유럽 라이트톤`: 맑고 산뜻한 어조
- `프렌치 빈티지`: 우아하고 은은한 어조
- `코지 홈카페`: 포근하고 친근한 어조
- `일본식 담백한 식탁`: 차분하고 담백한 어조

## 8. UX 플로우

1. 사용자는 이미지를 업로드하거나 테스트 시드를 선택한다.
2. 시스템은 추천 스타일 3개를 카드형으로 보여준다.
3. 각 카드에는 아래가 포함된다.
   - 스타일 설명
   - 추천 이유
   - 작은 예시 썸네일
4. 사용자는 스타일 하나를 선택한다.
5. 시스템은 결과를 카드형 섹션으로 나눠 보여준다.
   - 대표 감성 이미지
   - 라이프스타일 이미지
   - 상품 한 줄 소개
   - 상세 설명
   - 스마트스토어용 짧은 소개문구
   - 키워드 / 해시태그
6. 각 텍스트 출력에는 복사 버튼이 있다.
7. 사용자는 같은 스타일로 다시 생성하거나 다른 스타일로 전환할 수 있다.

## 9. 결과 복사 UX

복사 UX는 다음 원칙을 따른다.

- 각 텍스트 결과마다 독립적인 복사 버튼 제공
- 복사 성공 시 짧은 상태 피드백 제공
- 키워드와 해시태그는 각각 따로 복사 가능
- 이미지 카드와 텍스트 카드를 시각적으로 분리해 사용자가 복사 대상 텍스트를 즉시 찾을 수 있게 함

## 10. 테스트 시드

아래 6개 시드를 제공한다.

- 화이트 세라믹 접시
- 어스톤 볼
- 크림 머그컵
- 투명 유리잔
- 우드 트레이
- 실버 커트러리

목적:

- 추천 정확도 빠른 검증
- 스타일별 카피 톤 차이 검증
- 재생성 및 fallback 경로 검증

## 11. 최적화 전략

### 정확도

- embedding 점수에 heuristic reranking을 덧씌움
- 추천 이유를 점수 근거와 연결해 설명 가능성 확보

### 일관성

- `uploadToken + styleId + regenerateCount` 기반 결정적 seed 사용

### 속도

- 스타일 임베딩 캐시
- 추천/생성 API 분리
- 생성 시 카피와 이미지 준비를 같은 요청에서 묶되 seed는 고정

### UX 단순성

- 단일 페이지
- 업로드 후 자동 추천
- 카드 중심 결과 구성
- 복사 버튼으로 후처리 시간 단축

### 제어 가능성

- 추천 3개 + 전체 6개 즉시 재선택 가능
- 재생성 버튼 제공
- fallback 여부를 메타로 노출

## 12. 로깅 필드 정의

로그는 JSONL append-only 형태로 저장되며, 아래 필드를 유지한다.

- `uploadIdentifier`
- `recommendedStyles`
  - `styleId`
  - `styleName`
  - `score`
  - `reason`
- `finalSelectedStyle`
- `generationResult`
  - 대표 이미지 메타
  - 라이프스타일 이미지 메타
  - 한 줄 소개
  - 상세 설명
  - 짧은 소개문구
  - 키워드
  - 해시태그
- `isRegenerated`
- `fallbackUsed`
- `generatedAt`
- `extra`
  - 상품 분석 스냅샷
  - 모델명
  - 재생성 횟수

권장 이벤트 타입:

- `styles_recommended`
- `style_selected`
- `package_generated`
