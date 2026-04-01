# 아키텍처 문서

## 1. 전체 구조
- 프론트엔드: `frontend/`의 `Next.js` 앱
- 백엔드: `backend/app/`의 `FastAPI` 앱
- 연결 방식: `Next.js app/api` 프록시가 중간에서 백엔드로 전달
- 데이터 저장: `SQLite`
- 결과 저장: `~/Downloads/장사한컷`
- 업로드 원본 저장: `~/Downloads/uploads`
- 모델 저장: `models/`

## 2. 제품 구조

### 2-1. 메인 화면
- 채팅이 중심
- 자연어 한 줄 요청만 받음
- 입력 폼을 채팅에 붙이지 않음

### 2-2. 전용 생성 화면
- `/image`
- `/video`
- `/music`

전용 생성 화면은 같은 공용 도구 계층을 더 정교하게 호출하기 위한 입력 화면입니다.

## 3. 공용 생성 파이프라인
1. `validate_input`
2. `generate_copy`
3. `generate_banner_images`
4. `generate_detail_images`
5. `generate_logo_drafts`
6. `select_key_visual`
7. `generate_short_video`
8. `generate_music`
9. `compose_final_video`
10. `persist_generation_result`

## 3-1. 금지 규칙
- 사용자 요청 의도는 규칙 기반 분기로 판단하지 않습니다.
- 채팅 요청은 LLM 에이전트가 실제 도구 호출로 처리합니다.
- 생성 실패 시 폴백 이미지, 폴백 영상, 폴백 음악을 대신 만들지 않습니다.
- 실제 모델 경로가 실패하면 그대로 실패를 반환합니다.

## 4. 진입점별 동작

### 채팅
- 프론트 요청: `/api/chat/generate`
- Next.js 프록시: `frontend/app/api/chat/generate/route.ts`
- 실제 백엔드: `/chat/generate`
- 자연어 요청
- LangGraph가 채팅 상태를 관리
- LLM이 `ask_for_more_info`, `generate_image`, `generate_video`, `generate_music` 중 하나를 직접 호출
- 호출된 도구만 실제 생성 서비스로 연결

### 이미지 생성
- 프론트 요청: `/api/generate/image`
- Next.js 프록시: `frontend/app/api/generate/image/route.ts`
- 실제 백엔드: `/generate/image`
- `multipart/form-data`
- 파일 업로드 지원

### 영상 생성
- 프론트 요청: `/api/generate/video`
- Next.js 프록시: `frontend/app/api/generate/video/route.ts`
- 실제 백엔드: `/generate/video`
- `multipart/form-data`
- 파일 업로드 지원
- 음악 포함 여부 지원

### 음악 생성
- 프론트 요청: `/api/generate/music`
- Next.js 프록시: `frontend/app/api/generate/music/route.ts`
- 실제 백엔드: `/generate/music`
- 입력만으로 생성
- 업로드 없음

## 5. 프론트와 백엔드 연결 규칙
- 브라우저는 FastAPI 주소를 직접 호출하지 않음
- 프론트 컴포넌트는 상대경로만 호출
  - `/api/chat/generate`
  - `/api/generate/image`
  - `/api/generate/video`
  - `/api/generate/music`
- Next.js 서버가 `BACKEND_BASE_URL`을 읽어 실제 FastAPI 주소로 프록시함

## 6. 현재 모델 구성

### 이미지
- 목표 모델: `nunchaku-ai/nunchaku-z-image-turbo`
- 업로드 이미지가 있으면 `image-to-image`
- 업로드 이미지가 없으면 `text-to-image`
- 현재 `diffusers` 시그니처 차이는 런타임에서 보정

### 영상
- 목표 모델: `Wan-AI/Wan2.2-TI2V-5B-Diffusers`
- 이미지가 있으면 이미지 기반
- 이미지가 없으면 텍스트 기반
- 길이는 `3~10초`

### 음악
- 목표 모델: `ACE-Step/Ace-Step1.5`
- 길이는 영상 길이에 맞춤
- 보컬 모드 지원:
  - `instrumental`
  - `vocal`
- `vocal`일 때만 가사와 언어 입력 사용

## 7. 실패 처리
- 모델이 실패하면 실패를 그대로 반환합니다.
- 실패를 가리는 임시 결과물은 만들지 않습니다.
- 합성 단계는 생성된 영상과 음악을 그대로 합치기만 하며, 길이를 자르거나 임시로 맞추지 않습니다.

## 8. 저장 결과
- `banner_*.png`
- `detail_*.png`
- `logo_*.png`
- `music.wav`
- `video_raw.mp4`
- `final_ad.mp4`
- `assets.json`

영상 생성에서 음악을 끄면:
- `music.wav`
- `final_ad.mp4`
는 생략됩니다.

## 9. 현재 검증 상태
- `pytest` 통과
- `ruff check` 통과
- `frontend npm run build` 통과
- 실제 이미지, 영상, 음악, 합성본 생성 확인 완료

## 10. 범위 밖
- `CosyVoice + Wan S2V` 립싱크 영상
