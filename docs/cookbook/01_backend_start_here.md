# 백엔드 시작점 읽기

다음 문서:

- [백엔드 요청 흐름 읽기](./02_backend_request_flow.md)
- [프론트엔드와 백엔드 연결 읽기](./05_frontend_backend_connection.md)

## 1. 가장 먼저 보는 파일

백엔드는 [backend/app/main.py](../../backend/app/main.py) 에서 시작합니다.

이 파일에서 하는 일은 세 가지입니다.

1. FastAPI 앱을 만든다.
2. CORS를 켠다.
3. 라우터를 붙인다.

여기서 가장 중요한 줄은 이것입니다.

- `app.include_router(api_router)`

즉, 실제 요청 처리는 `main.py`가 다 하는 게 아니라, `api_router`에게 넘깁니다.

## 2. 라우터를 어디서 모으는가

그다음 보는 파일은 [backend/app/api/routes.py](../../backend/app/api/routes.py) 입니다.

이 파일은 URL 묶음을 등록합니다.

- `/chat` -> [backend/app/api/chat.py](../../backend/app/api/chat.py)
- `/generate` -> [backend/app/api/generation.py](../../backend/app/api/generation.py)
- `/projects` -> [backend/app/api/projects.py](../../backend/app/api/projects.py)
- `/health` -> [backend/app/api/health.py](../../backend/app/api/health.py)

여기서 핵심은 이 프로젝트가 URL별로 파일을 나눠서 관리한다는 점입니다.

예를 들어:

- 채팅 요청은 `chat.py`
- 이미지/영상/음악 전용 생성은 `generation.py`

로 갑니다.

## 3. 설정은 어디서 읽는가

설정 파일은 [backend/app/core/config.py](../../backend/app/core/config.py) 입니다.

여기서 중요한 값:

- `app_name`
- `database_url`
- `storage_root`
- `model_root`
- `use_local_ai_models`

지금 생성 결과 저장 위치는 `storage_root`이고, 기본값은 `~/Downloads/장사한컷`입니다.

## 4. 데이터베이스 초기화는 어디서 하는가

[backend/app/main.py](../../backend/app/main.py) 안의 `lifespan()`에서 [backend/app/db/session.py](../../backend/app/db/session.py) 의 `init_db()`를 호출합니다.

즉 앱이 켜질 때:

1. DB 초기화
2. 앱 실행

순서로 갑니다.

## 5. 백엔드를 읽는 가장 쉬운 순서

처음 보는 사람에게는 이 순서가 가장 편합니다.

1. [backend/app/main.py](../../backend/app/main.py)
2. [backend/app/api/routes.py](../../backend/app/api/routes.py)
3. [backend/app/api/chat.py](../../backend/app/api/chat.py)
4. [backend/app/api/generation.py](../../backend/app/api/generation.py)
5. [backend/app/services/chat_service.py](../../backend/app/services/chat_service.py)
6. [backend/app/services/llm_agent_service.py](../../backend/app/services/llm_agent_service.py)
7. [backend/app/services/generation_service.py](../../backend/app/services/generation_service.py)
8. [backend/app/tools](../../backend/app/tools)

여기서 중요한 감각은 이겁니다.

- `api`는 입구
- `services`는 LLM 도구 호출과 생성 흐름 정리
- `tools`는 실제 작업

즉 라우터가 직접 이미지나 영상을 만들지 않습니다. 라우터는 요청을 받고 서비스에 넘기고, 서비스가 도구를 호출합니다.
