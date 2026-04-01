# 프론트엔드 페이지와 컴포넌트 읽기

이전 문서:

- [프론트엔드 시작점 읽기](./03_frontend_start_here.md)

다음 문서:

- [프론트엔드와 백엔드 연결 읽기](./05_frontend_backend_connection.md)

## 1. 메인 페이지는 무엇을 보여주는가

[frontend/app/page.tsx](../../frontend/app/page.tsx) 는 메인 채팅 화면을 보여줍니다.

이 파일에서 중요한 부분:

- 큰 소개 섹션
- 모드 카드 3개
- 채팅 패널

여기서 실제 입력 처리 코드는 [frontend/components/chat-panel.tsx](../../frontend/components/chat-panel.tsx) 로 내려갑니다.

즉 `page.tsx`는 배치, `chat-panel.tsx`는 동작입니다.

## 2. 채팅 패널은 어떤 구조인가

[frontend/components/chat-panel.tsx](../../frontend/components/chat-panel.tsx) 를 보면 큰 덩어리가 세 개입니다.

### 상태

- `messages`
- `latestResult`
- `isSubmitting`

이 상태는 화면이 기억해야 하는 값입니다.

### 이벤트 처리

- `handleSubmit()`

이 함수는 textarea의 내용을 읽고, 백엔드에 보내고, 응답을 받아 상태를 업데이트합니다.

### 화면

`return (...)` 안에는:

- 예시 문구
- 대화 목록
- 입력 textarea
- 전송 버튼
- 최근 결과 패널

이 들어 있습니다.

## 3. 전용 생성 페이지는 어떻게 구성되는가

각 페이지는 거의 같은 패턴입니다.

- [frontend/app/image/page.tsx](../../frontend/app/image/page.tsx)
- [frontend/app/video/page.tsx](../../frontend/app/video/page.tsx)
- [frontend/app/music/page.tsx](../../frontend/app/music/page.tsx)

이 페이지들은 대부분 [frontend/components/generation-form.tsx](../../frontend/components/generation-form.tsx) 에 `mode`만 다르게 넘깁니다.

즉:

- 이미지 페이지 -> `mode="image"`
- 영상 페이지 -> `mode="video"`
- 음악 페이지 -> `mode="music"`

## 4. generation-form.tsx는 왜 중요한가

[frontend/components/generation-form.tsx](../../frontend/components/generation-form.tsx) 는 전용 생성 화면의 핵심입니다.

이 파일 하나가:

- 이미지 생성 폼
- 영상 생성 폼
- 음악 생성 폼

을 모두 처리합니다.

차이는 `mode` 값으로 분기합니다.

### 예를 들어

- `mode === 'image'`
  - 이미지 업로드 표시
  - 이미지 생성용 설명/버튼 표시

- `mode === 'video'`
  - 이미지 업로드 표시
  - 음악 포함 여부 체크박스 표시
  - 음악을 켠 경우에만 음악 설정 표시

- `mode === 'music'`
  - 업로드 없음
  - 음악 설정만 표시

## 5. 보컬 설정은 어디서 갈리는가

[frontend/components/generation-form.tsx](../../frontend/components/generation-form.tsx) 안에서:

- `includeMusic`
- `musicVocalMode`

두 상태가 음악 설정 표시를 제어합니다.

즉:

- 영상 페이지에서 음악을 끄면 음악 설정 자체를 숨김
- 보컬 방식이 `vocal`일 때만 가사 언어와 가사 입력을 보여줌

이걸 보고 "상태에 따라 화면이 달라진다"는 React 기본 감각을 익히면 됩니다.

## 6. 결과는 어디에 표시되는가

전용 생성 페이지 결과는 [frontend/components/asset-result-panel.tsx](../../frontend/components/asset-result-panel.tsx) 로 표시됩니다.

이 컴포넌트는 현재:

- 메시지
- 저장 위치
- 생성 자산 경로

를 보여줍니다.

즉 생성 폼은 요청을 보내고, 결과 패널은 응답을 보여줍니다.

