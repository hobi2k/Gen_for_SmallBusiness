# 프론트엔드 시작점 읽기

이전 문서:

- [백엔드 요청 흐름 읽기](./02_backend_request_flow.md)

다음 문서:

- [프론트엔드 페이지와 컴포넌트 읽기](./04_frontend_pages_and_components.md)
- [프론트엔드와 백엔드 연결 읽기](./05_frontend_backend_connection.md)

## 1. 프론트엔드는 어디서 시작하는가

프론트엔드는 Next.js 앱이고, 시작점은 [frontend/app/layout.tsx](../../frontend/app/layout.tsx) 입니다.

이 파일은 모든 페이지 바깥에 공통으로 깔리는 틀입니다.

여기서 하는 일:

- 전역 CSS 불러오기
- 상단 네비게이션 렌더링
- 현재 페이지 내용 렌더링

즉 `layout.tsx`는 모든 페이지의 공통 껍데기입니다.

## 2. 메인 페이지는 어디인가

메인 페이지는 [frontend/app/page.tsx](../../frontend/app/page.tsx) 입니다.

이 파일은 아주 단순합니다.

화면을 직접 길게 그리기보다, 이미 만들어 둔 컴포넌트를 조합합니다.

- [frontend/components/mode-card.tsx](../../frontend/components/mode-card.tsx)
- [frontend/components/chat-panel.tsx](../../frontend/components/chat-panel.tsx)

즉 페이지 파일은 보통:

- 어떤 컴포넌트를 배치할지 정하고
- 실제 입력 처리나 렌더링 세부는 컴포넌트에게 맡깁니다.

## 3. 왜 page.tsx가 여러 개 있는가

Next.js의 `app` 폴더에서는 폴더 구조가 URL이 됩니다.

예를 들어:

- [frontend/app/page.tsx](../../frontend/app/page.tsx) -> `/`
- [frontend/app/image/page.tsx](../../frontend/app/image/page.tsx) -> `/image`
- [frontend/app/video/page.tsx](../../frontend/app/video/page.tsx) -> `/video`
- [frontend/app/music/page.tsx](../../frontend/app/music/page.tsx) -> `/music`

즉 폴더가 URL을 만든다고 보면 됩니다.

## 4. 컴포넌트는 어디에 모아 두는가

[frontend/components](../../frontend/components) 폴더에 있습니다.

핵심 파일:

- 채팅 입력: [frontend/components/chat-panel.tsx](../../frontend/components/chat-panel.tsx)
- 전용 생성 폼: [frontend/components/generation-form.tsx](../../frontend/components/generation-form.tsx)
- 상단 메뉴: [frontend/components/top-navigation.tsx](../../frontend/components/top-navigation.tsx)
- 모드 카드: [frontend/components/mode-card.tsx](../../frontend/components/mode-card.tsx)
- 결과 패널: [frontend/components/asset-result-panel.tsx](../../frontend/components/asset-result-panel.tsx)

## 5. 프론트엔드 안에도 API 파일이 있는 이유

이 프로젝트는 프론트가 백엔드를 직접 호출하지 않고, Next.js의 프록시 라우트를 거칩니다.

관련 파일:

- [frontend/app/api/chat/generate/route.ts](../../frontend/app/api/chat/generate/route.ts)
- [frontend/app/api/generate/image/route.ts](../../frontend/app/api/generate/image/route.ts)
- [frontend/app/api/generate/video/route.ts](../../frontend/app/api/generate/video/route.ts)
- [frontend/app/api/generate/music/route.ts](../../frontend/app/api/generate/music/route.ts)

즉 `frontend/app/api`는 프론트 안에 있지만, 단순 화면 파일이 아니라 서버 쪽 프록시 역할을 합니다.

## 6. React를 처음 읽을 때 어디를 보면 좋은가

처음에는 JSX 문법이 복잡해 보일 수 있지만, 이 순서로 보면 쉽습니다.

1. 함수 이름
2. `useState` 같은 상태 선언
3. 이벤트 함수
4. `return (...)` 안의 화면

예를 들어 [frontend/components/chat-panel.tsx](../../frontend/components/chat-panel.tsx) 를 보면:

1. `ChatPanel` 함수가 컴포넌트다.
2. `messages`, `latestResult`, `isSubmitting` 상태가 있다.
3. `handleSubmit()`이 전송 로직이다.
4. 마지막 `return`이 실제 화면이다.

즉 "함수 하나가 화면 하나"라는 감각으로 읽으면 됩니다.
