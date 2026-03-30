# Lifestyle Shop AI MVP

오프라인 리빙 소품 상인을 위한 AI 감성 판매 콘텐츠 생성 서비스의 MVP 골격입니다.

핵심 요구사항은 아래 문서와 코드에 반영되어 있습니다.

- 설계 문서: `docs/mvp-blueprint.md`
- 스타일 프리셋: `lib/style-presets.ts`
- 추천 API: `app/api/recommend-styles/route.ts`
- 생성 API: `app/api/generate/route.ts`
- 단일 화면 UX: `app/page.tsx`

## 실행

```bash
npm install
npm run dev
```

환경 변수가 없으면 추천/문구 생성은 결정적 템플릿 모드로 동작합니다.

- `OPENAI_API_KEY`: 있으면 `text-embedding-3-small`, `gpt-5-mini`, `gpt-5-nano`를 사용

## 문서 범위

`docs/mvp-blueprint.md`에는 아래 항목이 포함됩니다.

- 아키텍처 다이어그램
- 폴더 구조
- API 설계
- 6개 스타일 프롬프트 템플릿
- UX 플로우
- 성능 전략
- 로깅 설계
