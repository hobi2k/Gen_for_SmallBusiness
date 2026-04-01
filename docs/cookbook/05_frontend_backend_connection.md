# 프론트엔드와 백엔드 연결 읽기

이전 문서:

- [백엔드 요청 흐름 읽기](./02_backend_request_flow.md)
- [프론트엔드 페이지와 컴포넌트 읽기](./04_frontend_pages_and_components.md)

## 1. 실제 연결은 어디서 일어나는가

실제 연결은 프론트의 `fetch()` 호출 한 줄에서 시작합니다.

가장 먼저 볼 파일:

- [frontend/components/chat-panel.tsx](../../frontend/components/chat-panel.tsx)
- [frontend/components/generation-form.tsx](../../frontend/components/generation-form.tsx)

여기서 프론트는 먼저 Next.js의 상대경로 API로 HTTP 요청을 보냅니다.

## 2. 채팅 연결

[frontend/components/chat-panel.tsx](../../frontend/components/chat-panel.tsx) 에서:

- `fetch('/api/chat/generate')`

즉 채팅 화면은 먼저 Next.js의 `/api/chat/generate`로 JSON 요청을 보냅니다.

중간 프록시 파일:

- [frontend/app/api/chat/generate/route.ts](../../frontend/app/api/chat/generate/route.ts)

이 파일이 실제 백엔드의 `/chat/generate`로 다시 전달합니다.

백엔드에서 최종적으로 이 요청을 받는 곳:

- [backend/app/api/chat.py](../../backend/app/api/chat.py)

요청이 들어오면:

1. `chat.py`가 받음
2. [backend/app/services/chat_service.py](../../backend/app/services/chat_service.py) 로 넘김
3. LangGraph가 채팅 상태를 관리
4. LLM이 `ask_for_more_info`, `generate_image`, `generate_video`, `generate_music` 중 하나를 직접 호출
5. 호출된 도구에 맞는 공용 생성 서비스 실행

## 3. 전용 생성 연결

[frontend/components/generation-form.tsx](../../frontend/components/generation-form.tsx) 에서:

- 이미지 -> `/api/generate/image`
- 영상 -> `/api/generate/video`
- 음악 -> `/api/generate/music`

로 요청을 보냅니다.

이 주소도 먼저 Next.js 프록시를 칩니다.

- [frontend/app/api/generate/image/route.ts](../../frontend/app/api/generate/image/route.ts)
- [frontend/app/api/generate/video/route.ts](../../frontend/app/api/generate/video/route.ts)
- [frontend/app/api/generate/music/route.ts](../../frontend/app/api/generate/music/route.ts)

여기서는 일반 JSON이 아니라 `FormData`를 써서 multipart/form-data 형식으로 보냅니다.

이유:

- 이미지 파일 업로드를 같이 보내야 하기 때문입니다.

백엔드에서 이 요청을 받는 곳:

- [backend/app/api/generation.py](../../backend/app/api/generation.py)

이 파일에서 `_build_form_payload()`가 폼 데이터와 업로드 파일을 [backend/app/schemas/project.py](../../backend/app/schemas/project.py) 형태로 정리합니다.

## 4. 연결 구조를 한 줄로 요약하면

### 채팅

프론트 `chat-panel.tsx`
-> `/api/chat/generate`
-> `frontend/app/api/chat/generate/route.ts`
-> `chat.py`
-> `chat_service.py`
-> `llm_agent_service.py`
-> `generation_service.py`
-> `tools`

### 전용 생성

프론트 `generation-form.tsx`
-> `/api/generate/image | /api/generate/video | /api/generate/music`
-> `frontend/app/api/generate/.../route.ts`
-> `generation.py`
-> `generation_service.py`
-> `tools`

## 5. CORS는 어디서 처리하는가

[backend/app/main.py](../../backend/app/main.py) 에서 `CORSMiddleware`를 켭니다.

지금 기본 흐름은 Next.js 프록시를 거치지만, 백엔드를 직접 테스트하거나 별도 클라이언트가 붙을 때도 막히지 않게 허용하는 역할입니다.

## 6. 타입스크립트와 파이썬이 만나는 지점

프론트는 TypeScript로 객체를 만들고, 백엔드는 Pydantic 스키마로 그 객체를 받습니다.

예:

- 프론트:
  - [frontend/components/chat-panel.tsx](../../frontend/components/chat-panel.tsx)
  - [frontend/components/generation-form.tsx](../../frontend/components/generation-form.tsx)
- 백엔드:
  - [backend/app/schemas/chat.py](../../backend/app/schemas/chat.py)
  - [backend/app/schemas/project.py](../../backend/app/schemas/project.py)

즉:

- 프론트는 "이런 모양의 데이터를 보낸다"
- 백엔드는 "이런 모양의 데이터를 받는다"

라는 약속으로 연결됩니다.

## 7. 처음 볼 때 가장 중요한 감각

이 프로젝트는 "프론트와 백엔드가 강하게 섞인 구조"가 아닙니다.

오히려 역할이 나뉘어 있습니다.

- 프론트: 입력 받고 보여주기
- 백엔드: 검증하고 생성하기

연결은 `fetch()`와 API URL, 그리고 Next.js 프록시 라우트에서 일어납니다.

그래서 막힐 때는 항상 이 순서로 보면 됩니다.

1. 프론트에서 어느 URL을 치는가
2. 백엔드에서 그 URL을 어느 파일이 받는가
3. 그 파일이 어느 서비스로 넘기는가
4. 그 서비스가 어느 도구를 부르는가
