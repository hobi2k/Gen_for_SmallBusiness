# 백엔드 요청 흐름 읽기

이전 문서:

- [백엔드 시작점 읽기](./01_backend_start_here.md)

다음 문서:

- [프론트엔드 시작점 읽기](./03_frontend_start_here.md)
- [프론트엔드와 백엔드 연결 읽기](./05_frontend_backend_connection.md)

## 1. 채팅 요청은 어디로 가는가

채팅 요청 URL은 [backend/app/api/chat.py](../../backend/app/api/chat.py) 의 `/chat/generate` 입니다.

이 함수는 직접 생성하지 않고 [backend/app/services/chat_service.py](../../backend/app/services/chat_service.py) 의 `run_chat_generation()`을 부릅니다.

즉 흐름은:

1. 프론트가 `/api/chat/generate` 호출
2. Next.js 프록시가 실제 `/chat/generate`로 전달
3. `chat.py`가 요청 수신
4. `chat_service.py`가 LangGraph 상태 그래프 실행
5. LLM이 도구 하나를 직접 호출
6. 선택된 생성 서비스만 실행

## 2. 채팅 서비스는 무슨 일을 하는가

[backend/app/services/chat_service.py](../../backend/app/services/chat_service.py) 를 보면 채팅 흐름 핵심은 세 가지입니다.

- `_model_step()`
- `_route_tool()`
- `run_chat_generation()`

역할은 이렇습니다.

### `_model_step()`

[backend/app/services/llm_agent_service.py](../../backend/app/services/llm_agent_service.py) 의 `choose_chat_tool_call()`을 호출합니다.

여기서 LLM은 아래 도구 중 하나를 직접 고릅니다.

- `ask_for_more_info`
- `generate_image`
- `generate_video`
- `generate_music`

즉 코드가 `if 영상`, `if 음악` 같은 규칙표로 의도를 나누지 않습니다.

### `_route_tool()`

모델이 이미 고른 도구 이름을 읽고 다음 노드로 넘깁니다.

- 추가 질문이면 `ask_for_more_info`
- 이미지면 `run_image_generation`
- 영상이면 `run_video_generation`
- 음악이면 `run_music_generation`

이 단계는 "무슨 의도인지 판단"하는 곳이 아니라, 이미 선택된 도구를 실행 노드에 연결하는 곳입니다.

### `run_chat_generation()`

LangGraph를 실행하고 마지막 `ChatGenerateResponse`를 돌려줍니다.

즉 채팅 서비스는

- 상태 관리
- LLM 도구 호출
- 생성 서비스 실행

이 세 가지를 맡습니다.

## 3. LLM 에이전트는 무슨 일을 하는가

[backend/app/services/llm_agent_service.py](../../backend/app/services/llm_agent_service.py) 는 채팅에서 가장 중요한 파일입니다.

여기서 하는 일:

1. `OpenAI` 클라이언트 생성
2. 채팅 에이전트용 도구 스키마 정의
3. `gpt-5-mini`로 실제 도구 호출 요청
4. 모델이 고른 도구 이름과 인자 파싱
5. 광고 문구 생성

즉 이 파일은

- 어떤 도구를 부를지
- 그 도구에 어떤 인자를 넣을지

를 LLM이 결정하게 만드는 계층입니다.

## 4. 전용 생성 요청은 어디로 가는가

전용 생성 페이지는 먼저 Next.js 프록시를 거쳐 [backend/app/api/generation.py](../../backend/app/api/generation.py) 로 들어옵니다.

여기 URL은 세 개입니다.

- 프론트 요청:
  - `/api/generate/image`
  - `/api/generate/video`
  - `/api/generate/music`
- 실제 백엔드:
  - `/generate/image`
  - `/generate/video`
  - `/generate/music`

이 파일은 먼저 `_build_form_payload()`로 폼 데이터를 [backend/app/schemas/project.py](../../backend/app/schemas/project.py) 의 요청 객체로 바꿉니다.

그다음 서비스 함수로 넘깁니다.

- 이미지 -> `generate_image_asset_bundle()`
- 영상 -> `generate_video_asset_bundle()`
- 음악 -> `generate_music_asset_bundle()`

## 5. generation_service는 왜 중요한가

[backend/app/services/generation_service.py](../../backend/app/services/generation_service.py) 는 실제 생성 흐름을 조립하는 중심 파일입니다.

### 이미지 생성 흐름

1. `validate_input()`
2. `generate_copy()`
3. `generate_banner_images()`
4. `generate_detail_images()`
5. `generate_logo_drafts()`

### 영상 생성 흐름

1. `validate_input()`
2. `generate_copy()`
3. `generate_detail_images()`
4. `generate_banner_images()`
5. `select_key_visual()`
6. `generate_short_video()`
7. 필요하면 `generate_music()`
8. 필요하면 `compose_final_video()`

### 음악 생성 흐름

1. `validate_input()`
2. `generate_copy()`
3. `generate_music()`

즉 이 파일은 "어떤 순서로 도구를 부를지"를 정하는 곳입니다.

## 6. tools 폴더는 무슨 역할인가

[backend/app/tools](../../backend/app/tools) 는 실제 작업 함수들이 있습니다.

핵심 파일:

- 입력 검증: [backend/app/tools/validation_tool.py](../../backend/app/tools/validation_tool.py)
- 문구 생성: [backend/app/tools/copy_tool.py](../../backend/app/tools/copy_tool.py)
- 이미지 생성: [backend/app/tools/image_tool.py](../../backend/app/tools/image_tool.py)
- 영상 생성: [backend/app/tools/video_tool.py](../../backend/app/tools/video_tool.py)
- 음악 생성: [backend/app/tools/music_tool.py](../../backend/app/tools/music_tool.py)
- 영상 합성: [backend/app/tools/composition_tool.py](../../backend/app/tools/composition_tool.py)
- 저장 경로 처리: [backend/app/tools/runtime_support.py](../../backend/app/tools/runtime_support.py)

처음에는 서비스와 도구가 헷갈릴 수 있습니다. 구분은 이렇게 보면 쉽습니다.

- 채팅 서비스: LLM 도구 호출과 상태 흐름
- 생성 서비스: 도구 실행 순서 정리
- 도구: 실제 파일 생성

## 7. 백엔드만 놓고 보면 전체 흐름은 이것이다

1. 요청이 `api`로 들어온다.
2. 요청이 `schema` 형태로 정리된다.
3. 채팅이면 `chat_service`가 LangGraph와 LLM 도구 호출을 실행한다.
4. 전용 생성이면 `generation_service`가 바로 도구 순서를 잡는다.
5. `tools`가 실제 파일을 만든다.
6. 결과 경로를 응답으로 돌려준다.
