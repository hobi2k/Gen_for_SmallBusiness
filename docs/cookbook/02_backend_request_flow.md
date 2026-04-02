# 백엔드 요청 흐름 읽기

이 문서는 "URL 하나가 들어왔을 때 실제로 어떤 파일들을 지나가는가"를 따라가는 문서입니다.

이전 문서:

- [백엔드 시작점 읽기](./01_backend_start_here.md)

다음 문서:

- [프론트엔드 시작점 읽기](./03_frontend_start_here.md)

## 1. 먼저 큰 그림부터

백엔드 요청 흐름은 크게 두 갈래입니다.

- 채팅 요청
- 전용 생성 요청

둘 다 입구는 API 파일이지만, 그다음 흐름은 조금 다릅니다.

### 채팅 요청

1. `/chat/generate`로 들어옴
2. 채팅 서비스가 LangGraph 상태 그래프 실행
3. LLM이 어떤 도구를 호출할지 결정
4. 이미지/영상/음악 생성 서비스 중 하나 실행

### 전용 생성 요청

1. `/generate/image`, `/generate/video`, `/generate/music`로 들어옴
2. 폼 데이터를 요청 객체로 정리
3. 생성 서비스가 정해진 순서대로 도구 실행

## 2. 채팅 요청은 어디서 받는가

채팅 입구는 [backend/app/api/chat.py](../../backend/app/api/chat.py) 입니다.

여기서 중요한 포인트는 하나입니다.

- 이 파일은 요청을 받고 바로 서비스로 넘긴다.

즉 채팅 API 파일은 생성 모델을 직접 만지지 않습니다.

읽을 때는 아래 흐름만 보면 됩니다.

1. 어떤 요청 스키마를 받는가
2. 어떤 서비스 함수를 호출하는가
3. 실패 시 어떤 응답을 돌려주는가

## 3. 채팅 서비스는 왜 따로 있는가

실제 핵심은 [backend/app/services/chat_service.py](../../backend/app/services/chat_service.py) 입니다.

이 파일이 중요한 이유는, 채팅 요청이 단순한 if/else 분기가 아니라 상태 그래프를 타기 때문입니다.

여기서 보는 핵심은 세 가지입니다.

- 상태를 어떻게 들고 가는가
- LLM에게 언제 도구 선택을 맡기는가
- 선택된 도구를 어디서 실제 실행하는가

이 프로젝트 채팅은 규칙 기반으로 "영상이라는 단어가 있으면 영상" 식으로 분기하지 않습니다.  
대신 LLM이 도구를 직접 고르고, LangGraph가 그 선택 결과를 다음 노드로 넘깁니다.

## 4. LLM은 어디서 도구를 고르는가

그 역할은 [backend/app/services/llm_agent_service.py](../../backend/app/services/llm_agent_service.py) 가 맡습니다.

여기서 하는 일은 아래와 같습니다.

1. 모델에게 보여줄 도구 목록 정의
2. 각 도구에 어떤 인자가 필요한지 정의
3. 사용자의 채팅 요청을 모델에 전달
4. 모델이 `ask_for_more_info`, `generate_image`, `generate_video`, `generate_music` 중 하나를 고르게 함

즉 이 파일은 "LLM이 어떤 도구를 쓸지 판단하게 만드는 계층"입니다.

여기서 중요한 건, 사람이 규칙표를 써서 분기하는 게 아니라 모델이 실제 호출할 도구를 고른다는 점입니다.

## 5. 전용 생성 요청은 어디서 받는가

이미지, 영상, 음악 전용 생성은 [backend/app/api/generation.py](../../backend/app/api/generation.py) 가 받습니다.

이 파일은 채팅 API보다 훨씬 단순합니다.

왜냐하면 전용 생성 화면에서는 이미 사용자가 "나는 이미지 생성 화면에 들어왔다"라고 명확히 선택한 상태이기 때문입니다.

여기서 중요한 건 `_build_form_payload()`입니다.

이 함수는 폼에서 들어온 문자열과 업로드 파일을 정리해서 [backend/app/schemas/project.py](../../backend/app/schemas/project.py) 의 `ProjectCreateRequest` 객체로 만듭니다.

즉 이 단계에서:

- 상품명
- 프롬프트
- 업로드 이미지
- 영상 길이
- 배너/상세/영상 해상도

같은 값이 하나의 요청 객체로 묶입니다.

## 6. 생성 서비스는 왜 따로 있는가

실제 생성 순서 조립은 [backend/app/services/generation_service.py](../../backend/app/services/generation_service.py) 가 맡습니다.

이 파일은 "무슨 모델을 쓸지"보다 "어떤 순서로 작업을 이어붙일지"가 중요합니다.

### 이미지 생성 흐름

보통 아래 순서입니다.

1. 입력 검증
2. 광고 카피 생성
3. 배너 이미지 생성
4. 상세 이미지 생성
5. 로고 초안 생성
6. 생성된 이미지 위에 한국어 오버레이 적용

### 영상 생성 흐름

보통 아래 순서입니다.

1. 입력 검증
2. 광고 카피 생성
3. 업로드 이미지가 있으면 바로 i2v, 없으면 바로 t2v
4. 원본 영상 생성
5. 음악을 켰으면 음악 생성
6. 음악을 켰으면 최종 합성
7. 영상 위에 한국어 오버레이 적용
8. 음악이 켜져 있으면 음악 생성
9. 영상과 음악 최종 합성

### 음악 생성 흐름

1. 입력 검증
2. 광고 카피 생성
3. 음악 프롬프트 생성
4. 음악 생성

즉 `generation_service.py`는 "작업 순서표"라고 생각하면 됩니다.

## 7. tools 폴더는 무엇인가

[backend/app/tools](../../backend/app/tools) 는 실제 작업을 수행하는 함수들이 모여 있는 곳입니다.

핵심 파일은 아래처럼 보면 됩니다.

- [validation_tool.py](../../backend/app/tools/validation_tool.py)
  - 입력값이 맞는지 확인
- [copy_tool.py](../../backend/app/tools/copy_tool.py)
  - 카피 묶음 생성
- [image_tool.py](../../backend/app/tools/image_tool.py)
  - 이미지 모델 호출
- [video_tool.py](../../backend/app/tools/video_tool.py)
  - 영상 모델 호출
- [music_tool.py](../../backend/app/tools/music_tool.py)
  - 음악 모델 호출
- [text_overlay_tool.py](../../backend/app/tools/text_overlay_tool.py)
  - 이미지/영상에 한국어 카피 합성
- [composition_tool.py](../../backend/app/tools/composition_tool.py)
  - 최종 영상과 음악 합성

쉽게 말하면:

- `services`: 순서를 짠다
- `tools`: 실제로 손을 움직인다

## 8. 처음 읽을 때 꼭 잡아야 하는 구분

많이 헷갈리는 부분이 이것입니다.

### API 파일

입구입니다.  
요청을 직접 받습니다.

### Service 파일

흐름을 조립합니다.  
어떤 도구를 언제 부를지 정합니다.

### Tool 파일

실제 작업을 합니다.  
이미지를 만들고, 영상을 만들고, 음악을 만듭니다.

이 구분만 잡혀도 전체 구조가 훨씬 덜 복잡하게 보입니다.
