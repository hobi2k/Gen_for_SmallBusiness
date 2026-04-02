# 프론트엔드와 백엔드 연결 읽기

이 문서는 "버튼을 눌렀는데 실제로 어디로 가는가"를 이해하게 만드는 문서입니다.

이전 문서:

- [백엔드 요청 흐름 읽기](./02_backend_request_flow.md)
- [프론트엔드 페이지와 컴포넌트 읽기](./04_frontend_pages_and_components.md)

## 1. 가장 먼저 알아야 하는 것

브라우저는 FastAPI 주소를 직접 치지 않습니다.

이 프로젝트의 연결 구조는 이렇게 되어 있습니다.

1. 브라우저의 React 컴포넌트가 `/api/...` 로 요청
2. Next.js가 그 요청을 받음
3. Next.js 프록시가 실제 FastAPI 주소로 전달
4. FastAPI가 응답
5. Next.js가 다시 브라우저에 응답

즉 브라우저 입장에서는 "Next.js에게만 말하는 구조"입니다.

## 2. 왜 이런 구조를 쓰는가

이 방식이 좋은 이유는 분명합니다.

- 브라우저 코드에 백엔드 주소를 직접 박지 않아도 됨
- 프록시가 중간에서 요청을 정리할 수 있음
- 환경이 바뀌어도 프론트 코드를 덜 흔들 수 있음

즉 프론트와 백엔드를 완전히 붙여 놓지는 않지만, 브라우저가 백엔드를 직접 아는 구조도 아닙니다.

## 3. 채팅 연결은 어디서 시작하는가

채팅은 [frontend/components/chat-panel.tsx](../../frontend/components/chat-panel.tsx) 에서 시작합니다.

여기서 중요한 줄은 결국 `fetch('/api/chat/generate')` 입니다.

즉 채팅창에서 보내는 요청은 먼저 Next.js의 `/api/chat/generate`로 갑니다.

그다음 이 요청을 받는 프록시 파일은:

- [frontend/app/api/chat/generate/route.ts](../../frontend/app/api/chat/generate/route.ts)

입니다.

이 파일이 실제 백엔드의 `/chat/generate`로 요청을 다시 보냅니다.

즉 채팅 흐름은 아래와 같습니다.

1. `chat-panel.tsx`
2. `/api/chat/generate`
3. `frontend/app/api/chat/generate/route.ts`
4. `backend/app/api/chat.py`
5. `backend/app/services/chat_service.py`
6. `backend/app/services/llm_agent_service.py`
7. `backend/app/services/generation_service.py`
8. `backend/app/tools/*`

## 4. 전용 생성 연결은 어디서 시작하는가

전용 생성은 [frontend/components/generation-form.tsx](../../frontend/components/generation-form.tsx) 에서 시작합니다.

이 컴포넌트는 모드에 따라 서로 다른 URL로 보냅니다.

- 이미지 -> `/api/generate/image`
- 영상 -> `/api/generate/video`
- 음악 -> `/api/generate/music`

이 요청도 먼저 Next.js 프록시를 칩니다.

- [frontend/app/api/generate/image/route.ts](../../frontend/app/api/generate/image/route.ts)
- [frontend/app/api/generate/video/route.ts](../../frontend/app/api/generate/video/route.ts)
- [frontend/app/api/generate/music/route.ts](../../frontend/app/api/generate/music/route.ts)

그리고 그 뒤에 실제 FastAPI 엔드포인트가 받습니다.

- [backend/app/api/generation.py](../../backend/app/api/generation.py)

## 5. 채팅과 전용 생성의 차이

겉으로 보면 둘 다 생성 요청이지만, 연결 구조에는 차이가 있습니다.

### 채팅

- 사용자가 자연어만 입력
- LLM이 어떤 도구를 부를지 결정
- 요청이 부족하면 추가 질문 가능

### 전용 생성

- 사용자가 구조화된 입력을 직접 채움
- 어떤 종류를 생성할지는 이미 페이지에서 확정
- 백엔드는 정해진 생성 서비스로 바로 들어감

즉 채팅은 "판단이 필요한 경로", 전용 생성은 "판단이 끝난 경로"입니다.

## 6. `FormData`는 왜 쓰는가

전용 생성에서는 파일 업로드가 있으므로 `FormData`를 씁니다.

특히 이미지 생성과 영상 생성은 업로드 이미지가 들어갈 수 있으므로 JSON보다 `multipart/form-data`가 맞습니다.

그래서 [frontend/components/generation-form.tsx](../../frontend/components/generation-form.tsx) 에서는:

1. 입력값을 읽고
2. `FormData`에 넣고
3. 업로드 파일을 붙여서
4. `/api/generate/...` 로 보냅니다

그리고 [backend/app/api/generation.py](../../backend/app/api/generation.py) 는 그걸 읽어서 `ProjectCreateRequest`로 정리합니다.

## 7. 프론트와 백엔드가 실제로 "약속"하는 부분

프론트와 백엔드는 그냥 감으로 연결되는 게 아닙니다.  
서로 같은 데이터 구조를 기대합니다.

예를 들면:

- 프론트는 `banner_width`, `detail_width`, `video_width` 같은 필드를 보냅니다
- 백엔드는 [backend/app/schemas/project.py](../../backend/app/schemas/project.py) 에서 그 필드를 받습니다

즉 프론트와 백엔드가 만나는 지점은 결국 "요청 데이터 구조"입니다.

채팅도 마찬가지입니다.

- 프론트 채팅 입력 -> [backend/app/schemas/chat.py](../../backend/app/schemas/chat.py)

현재 기준 기본 입력은 단순합니다.

- `product_name`
- `prompt`
- `tone`
- `video_duration_seconds`

즉 타입스크립트와 파이썬은 직접 섞이지 않지만, 데이터 구조를 통해 연결됩니다.

## 8. 연결 문제를 디버깅할 때 보는 순서

프론트와 백엔드 연결이 이상할 때는 항상 이 순서로 보면 됩니다.

1. 프론트 컴포넌트가 어느 URL로 요청하는가
2. Next.js 프록시 파일이 어디인가
3. 실제 FastAPI 엔드포인트가 어디인가
4. 어떤 요청 스키마를 받는가
5. 어떤 서비스로 넘기는가
6. 어떤 도구까지 들어가는가

즉 "프론트가 안 된다"라고만 보면 막막하지만, 요청 경로를 한 단계씩 끊어서 보면 금방 찾을 수 있습니다.
