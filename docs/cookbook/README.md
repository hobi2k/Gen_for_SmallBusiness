# 장사한컷 코드 읽기 안내서

이 안내서는 "파일 이름은 많은데 어디부터 봐야 할지 모르겠다"는 상태에서 시작하는 사람을 위한 문서입니다.  
React, TypeScript, Next.js, FastAPI가 익숙하지 않아도 지금 프로젝트를 따라 읽을 수 있게 순서를 잡았습니다.

이 문서의 목적은 두 가지입니다.

1. 처음에 무엇을 읽어야 하는지 분명하게 정리하기
2. 각 파일이 왜 존재하는지, 서로 어떻게 연결되는지 이해하게 만들기

## 먼저 알고 가면 좋은 전제

이 프로젝트는 크게 두 덩어리입니다.

- 프론트엔드: 화면을 보여주고 입력을 받는 쪽
- 백엔드: 입력을 검증하고 이미지, 영상, 음악을 만드는 쪽

그리고 이 둘 사이에는 Next.js 프록시가 있습니다.

즉 사용자가 브라우저에서 버튼을 누르면 실제 흐름은 이렇게 됩니다.

1. 프론트엔드가 요청을 보냄
2. Next.js 프록시가 그 요청을 백엔드로 전달
3. 백엔드가 생성 작업을 수행
4. 결과 파일 경로를 응답
5. 프론트엔드가 결과를 화면에 보여줌

## 권장 읽기 순서

이 순서대로 읽으면 가장 덜 헷갈립니다.

1. [백엔드 시작점 읽기](./01_backend_start_here.md)
2. [백엔드 요청 흐름 읽기](./02_backend_request_flow.md)
3. [프론트엔드 시작점 읽기](./03_frontend_start_here.md)
4. [프론트엔드 페이지와 컴포넌트 읽기](./04_frontend_pages_and_components.md)
5. [프론트엔드와 백엔드 연결 읽기](./05_frontend_backend_connection.md)

## 정말 급하면 이 파일들부터 보기

처음엔 모든 파일을 보지 않아도 됩니다. 아래 파일만 먼저 봐도 구조의 중심이 잡힙니다.

- 백엔드 앱 시작점: [backend/app/main.py](../../backend/app/main.py)
- 백엔드 라우터 묶음: [backend/app/api/routes.py](../../backend/app/api/routes.py)
- 채팅 API: [backend/app/api/chat.py](../../backend/app/api/chat.py)
- 전용 생성 API: [backend/app/api/generation.py](../../backend/app/api/generation.py)
- 채팅 서비스: [backend/app/services/chat_service.py](../../backend/app/services/chat_service.py)
- 생성 서비스: [backend/app/services/generation_service.py](../../backend/app/services/generation_service.py)
- 메인 화면: [frontend/app/page.tsx](../../frontend/app/page.tsx)
- 채팅 컴포넌트: [frontend/components/chat-panel.tsx](../../frontend/components/chat-panel.tsx)
- 전용 생성 폼: [frontend/components/generation-form.tsx](../../frontend/components/generation-form.tsx)

## 처음 볼 때 버려도 되는 파일

처음부터 다 읽으려고 하면 오히려 구조가 안 잡힙니다. 아래는 일단 건너뛰어도 됩니다.

- `node_modules/`
- `.next/`
- `package-lock.json`
- `.pytest_cache/`
- `.ruff_cache/`
- 모델 파일이 들어 있는 `models/`

이런 파일과 폴더는 대부분 자동 생성물, 설치물, 캐시, 대형 가중치라서 "로직 이해"에는 도움이 거의 없습니다.

## 이 안내서를 읽는 방법

각 문서는 이렇게 구성됩니다.

- 먼저 어디를 볼지
- 그 파일이 무슨 역할인지
- 읽을 때 어떤 줄을 먼저 봐야 하는지
- 다음에 어디로 넘어가야 하는지

즉 단순 키워드 나열이 아니라, "이 파일을 보는 이유"를 같이 설명합니다.
