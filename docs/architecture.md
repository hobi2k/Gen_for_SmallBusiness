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
- 사용자가 해상도를 문장 안에서 말하면 LLM이 `banner_*`, `detail_*`, `video_*` 값까지 같이 채움
- 호출된 도구만 실제 생성 서비스로 연결

### 이미지 생성
- 프론트 요청: `/api/generate/image`
- Next.js 프록시: `frontend/app/api/generate/image/route.ts`
- 실제 백엔드: `/generate/image`
- `multipart/form-data`
- 파일 업로드 지원
- 기본 입력은 상품명, 프롬프트, 톤
- 배너 해상도 직접 입력 지원
- 상세 이미지 해상도 직접 입력 지원

### 영상 생성
- 프론트 요청: `/api/generate/video`
- Next.js 프록시: `frontend/app/api/generate/video/route.ts`
- 실제 백엔드: `/generate/video`
- `multipart/form-data`
- 파일 업로드 지원
- 기본 입력은 상품명, 프롬프트, 톤, 길이
- 음악 포함 여부 지원
- 영상 해상도 직접 입력 지원
- 프레임과 생성 스텝 직접 입력 지원
- 세로 대표 이미지는 영상 해상도를 자동으로 따라감
- 영상 요청은 배너와 상세 이미지 번들을 먼저 만들지 않고 바로 영상 생성으로 들어감
- 기본 결과물은 영상만 만들고, 음악을 켜면 음악과 합성본까지 추가로 만든다
- 요청이 끝나면 Wan 파이프라인을 즉시 해제해 GPU 메모리를 비움

### 음악 생성
- 프론트 요청: `/api/generate/music`
- Next.js 프록시: `frontend/app/api/generate/music/route.ts`
- 실제 백엔드: `/generate/music`
- 입력만으로 생성
- 기본 입력은 상품명, 프롬프트, 톤, 길이
- 업로드 없음

## 5. 프론트와 백엔드 연결 규칙
- 브라우저는 FastAPI 주소를 직접 호출하지 않음
- 프론트 컴포넌트는 상대경로만 호출
  - `/api/chat/generate`
  - `/api/generate/image`
  - `/api/generate/video`
  - `/api/generate/music`
- Next.js 서버가 `BACKEND_BASE_URL`을 읽어 실제 FastAPI 주소로 프록시함
- 기본 백엔드 포트는 `8013`으로 고정함

## 6. 현재 모델 구성

### 이미지
- 목표 모델: `nunchaku-ai/nunchaku-z-image-turbo`
- 업로드 이미지가 있으면 `image-to-image`
- 업로드 이미지가 없으면 `text-to-image`
- `img2img`는 광고 포스터형 재구성 기준으로 사용
- `text-to-image`도 같은 기준으로 더 강한 프롬프트 추종 설정 사용
- 프롬프트에서 한국어 자체를 금지하지 않음
- 영어 라벨은 모델이 만들 수 있게 열어두고, 한국어 카피는 후처리 오버레이로 처리
- 현재 `diffusers` 시그니처 차이는 런타임에서 보정
- `img2img`와 `text-to-image` 전환 시 반대쪽 파이프라인 캐시를 먼저 비워 순간 VRAM 피크를 줄임

### 영상
- 목표 모델: `Wan-AI/Wan2.2-TI2V-5B-Diffusers`
- 이미지가 있으면 이미지 기반
- 이미지가 없으면 텍스트 기반
- 영상 요청에서는 업로드 이미지가 있으면 바로 i2v, 없으면 바로 t2v
- 길이는 `1~40초`
- 해상도는 요청값 사용
- 기본값은 `832x480`
- 품질 우선 기준으로 `24fps` 고정
- 긴 영상은 요청 크기(해상도 × fps × steps)에 따라 `2~5초` 단위 세그먼트로 분할 생성
- 영상 생성은 품질 우선 설정의 `guidance`와 `steps`를 사용
- 전용 영상 생성 화면에서는 `fps`와 `steps`를 직접 바꿀 수 있음
- 요청 종료 시점에 Wan 파이프라인 캐시를 비워 다음 요청 OOM 가능성을 낮춤

### 음악
- 목표 모델: `ACE-Step/Ace-Step1.5`
- 길이는 영상 길이에 맞춤
- 보컬 모드 지원:
  - `instrumental`
  - `vocal`
- `vocal`일 때만 가사와 언어 입력 사용
- `vocal`인데 가사가 비어 있으면 LLM이 가사를 생성해야 함
- LLM이 가사를 만들지 못하면 실패로 처리
- ACE-Step은 별도 작업 프로세스에서 실행하고, 서버 프로세스는 저장 함수 patch를 공유하지 않음

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

## 8-1. 기본 해상도
- 배너: `1280x720`
- 상세 이미지: `720x1280`
- 영상: `832x480`

## 9. 현재 검증 상태
- `pytest` 통과
- `ruff check` 통과
- `frontend npm run build` 통과
- 실제 이미지, 영상, 음악, 합성본 생성 확인 완료

## 10. 범위 밖
- `CosyVoice + Wan S2V` 립싱크 영상
