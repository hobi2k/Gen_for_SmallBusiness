# 프론트엔드 시작점 읽기

이 문서는 프론트엔드를 처음 볼 때 "어디부터 읽어야 하는가"를 설명합니다.

이전 문서:

- [백엔드 요청 흐름 읽기](./02_backend_request_flow.md)

다음 문서:

- [프론트엔드 페이지와 컴포넌트 읽기](./04_frontend_pages_and_components.md)

## 1. 프론트엔드는 어디서 시작하는가

프론트엔드는 Next.js 앱입니다.  
가장 바깥에서 먼저 볼 파일은 [frontend/app/layout.tsx](../../frontend/app/layout.tsx) 입니다.

이 파일은 모든 페이지 공통 껍데기입니다.

여기서 보통 하는 일:

- 전역 CSS 불러오기
- 폰트 설정
- 상단 네비게이션 배치
- 현재 페이지 내용 렌더링

즉 `layout.tsx`는 "모든 페이지를 감싸는 공통 프레임"입니다.

## 2. 메인 페이지는 어디인가

메인 화면은 [frontend/app/page.tsx](../../frontend/app/page.tsx) 입니다.

이 파일은 앱의 첫 화면 `/`에 해당합니다.

여기서 중요한 건, 페이지 파일이 모든 걸 다 직접 그리지 않는다는 점입니다.

보통 page 파일은:

- 어떤 섹션을 위에 놓을지
- 어떤 컴포넌트를 가져올지
- 페이지 전체 분위기를 어떻게 잡을지

정도를 결정합니다.

실제 채팅 입력, 결과 렌더링 같은 세부 동작은 컴포넌트로 내려보냅니다.

## 3. 왜 `page.tsx`가 여러 개 있는가

Next.js의 `app` 폴더는 디렉터리 구조가 URL이 됩니다.

즉 아래 관계를 기억하면 됩니다.

- [frontend/app/page.tsx](../../frontend/app/page.tsx) -> `/`
- [frontend/app/image/page.tsx](../../frontend/app/image/page.tsx) -> `/image`
- [frontend/app/video/page.tsx](../../frontend/app/video/page.tsx) -> `/video`
- [frontend/app/music/page.tsx](../../frontend/app/music/page.tsx) -> `/music`

즉 폴더가 URL, 그 안의 `page.tsx`가 해당 URL의 화면입니다.

## 4. 컴포넌트는 왜 따로 빼는가

실제 UI 조각들은 [frontend/components](../../frontend/components) 아래에 둡니다.

이유는 간단합니다.

- 페이지 파일을 너무 길게 만들지 않기 위해
- 같은 UI 조각을 다른 페이지에서도 재사용하기 위해
- 입력 처리와 레이아웃을 분리하기 위해

예를 들면 이렇습니다.

- `page.tsx`는 메인 화면 뼈대를 정함
- `chat-panel.tsx`는 채팅 입력과 결과 표시를 맡음
- `generation-form.tsx`는 전용 생성 폼을 맡음

즉 "페이지는 배치, 컴포넌트는 실제 동작"이라고 보면 이해가 쉽습니다.

## 5. 처음 읽을 때 중요한 파일

프론트엔드를 처음 읽을 때는 이 순서가 좋습니다.

1. [frontend/app/layout.tsx](../../frontend/app/layout.tsx)
2. [frontend/app/page.tsx](../../frontend/app/page.tsx)
3. [frontend/components/top-navigation.tsx](../../frontend/components/top-navigation.tsx)
4. [frontend/components/chat-panel.tsx](../../frontend/components/chat-panel.tsx)
5. [frontend/app/image/page.tsx](../../frontend/app/image/page.tsx)
6. [frontend/app/video/page.tsx](../../frontend/app/video/page.tsx)
7. [frontend/app/music/page.tsx](../../frontend/app/music/page.tsx)
8. [frontend/components/generation-form.tsx](../../frontend/components/generation-form.tsx)

이 순서가 좋은 이유는 "큰 껍데기 -> 실제 화면 -> 세부 동작" 순서이기 때문입니다.

## 6. React 코드를 읽을 때 어디를 먼저 보면 되는가

처음엔 JSX가 길어 보여도, 아래 순서로 읽으면 됩니다.

1. 함수 이름
2. `useState` 같은 상태 선언
3. 이벤트 함수
4. 마지막 `return (...)`

예를 들어 [frontend/components/chat-panel.tsx](../../frontend/components/chat-panel.tsx) 는 이렇게 보면 됩니다.

### 함수 이름

`ChatPanel`  
이 함수가 곧 화면 조각 하나입니다.

### 상태

이 컴포넌트가 기억해야 하는 값입니다.

예:

- 메시지 목록
- 현재 입력값
- 첨부 이미지 목록
- 생성 중 여부
- 진행률

### 이벤트 함수

예:

- 입력 전송
- 첨부 이미지 추가
- 첨부 이미지 제거

### return

여기서 실제 화면이 그려집니다.

즉 React 컴포넌트는 "상태 + 이벤트 + 화면"으로 읽는 습관을 들이면 훨씬 편합니다.

## 7. 프론트엔드를 읽을 때 흔히 착각하는 점

많이 헷갈리는 오해가 있습니다.

### 오해 1. JSX는 HTML이다

완전히 같지는 않습니다.  
HTML처럼 보이지만, 실제로는 TypeScript 안에서 쓰는 UI 문법입니다.

### 오해 2. 파일이 많으면 사람이 다 직접 쓴 것이다

아닙니다.

프론트엔드에는 다음이 섞여 있습니다.

- 사람이 직접 쓴 화면 코드
- Next.js가 요구하는 파일
- 설치 시 생기는 설정 파일
- 빌드 때 자동 생성되는 파일

처음엔 우리가 직접 읽어야 하는 파일만 보면 됩니다.

### 오해 3. page.tsx 하나에 모든 게 다 들어 있다

이 프로젝트는 일부러 컴포넌트로 쪼갰습니다.  
그래서 화면 로직은 `components/`를 같이 봐야 합니다.
