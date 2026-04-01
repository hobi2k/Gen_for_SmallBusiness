# 장사한컷 코드 읽기 안내서

이 폴더는 리액트와 타입스크립트가 익숙하지 않은 사람도 지금 프로젝트를 순서대로 읽을 수 있게 정리한 문서 모음입니다.

권장 읽기 순서:

1. [백엔드 시작점 읽기](./01_backend_start_here.md)
2. [백엔드 요청 흐름 읽기](./02_backend_request_flow.md)
3. [프론트엔드 시작점 읽기](./03_frontend_start_here.md)
4. [프론트엔드 페이지와 컴포넌트 읽기](./04_frontend_pages_and_components.md)
5. [프론트엔드와 백엔드 연결 읽기](./05_frontend_backend_connection.md)

이 안내서는 코드 파일 링크도 같이 달아 두었습니다. 문서 설명을 읽다가 바로 코드로 넘어가면 됩니다.

빠르게 보고 싶다면:

- 백엔드 진입점: [backend/app/main.py](../../backend/app/main.py)
- 백엔드 라우터 묶음: [backend/app/api/routes.py](../../backend/app/api/routes.py)
- 메인 채팅 화면: [frontend/app/page.tsx](../../frontend/app/page.tsx)
- 채팅 입력 컴포넌트: [frontend/components/chat-panel.tsx](../../frontend/components/chat-panel.tsx)
- 전용 생성 폼: [frontend/components/generation-form.tsx](../../frontend/components/generation-form.tsx)

