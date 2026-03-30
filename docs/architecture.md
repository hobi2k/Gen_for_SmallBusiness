# 아키텍처 문서

## 1. 전체 구조
- 프론트엔드: `frontend/`의 `Next.js` 앱
- 백엔드: `backend/app/`의 `FastAPI` 앱
- 데이터 저장: `SQLite`
- 파일 저장: `storage/projects/`
- 모델 저장: `models/`

## 2. 생성 파이프라인
1. `validate_input`
2. `generate_copy`
   - 광고 문구와 음악 생성용 프롬프트를 함께 정리
3. `generate_banner_images`
4. `generate_detail_images`
5. `generate_logo_drafts`
6. `select_key_visual`
7. `generate_short_video`
8. `generate_music`
9. `compose_final_video`
10. `persist_generation_result`

## 3. 현재 구현 상태

### 3-1. 문구
- 현재는 안정적인 기본 문구 생성기로 동작
- 이후 `OpenAI` 연결을 붙일 수 있게 구조 분리 완료

### 3-2. 이미지
- 목표 모델: `Tongyi-MAI/Z-Image-Turbo`
- 현재 코드: 모델 디렉토리와 실제 파이프라인 로딩 경로 준비 완료
- 실행 조건: `USE_LOCAL_AI_MODELS=true` 이고 CUDA 사용 가능해야 실제 모델 생성 경로 사용
- 그 외 환경: 광고 카드 이미지를 직접 생성하는 폴백 경로 사용
- 업로드 이미지가 있으면 `image-to-image`, 없으면 `text-to-image` 경로 사용

### 3-3. 영상
- 목표 모델: `Wan-AI/Wan2.2-TI2V-5B-Diffusers`
- 이미지가 있으면 이미지 기반 경로
- 이미지가 없으면 텍스트 기반 경로
- 사용자가 `3~10초` 사이로 영상 길이를 직접 고른다
- 현재 코드: 모델 로딩 경로 준비 완료
- GPU가 없으면 대표 이미지를 6초 영상으로 바꾸는 폴백 경로 사용

### 3-4. 음악
- 목표 모델: `ACE-Step/Ace-Step1.5`
- 문구 생성 단계에서 광고 문맥을 음악 프롬프트로 정리해 전달
- 음악 길이는 사용자가 고른 영상 길이에 맞춘다
- 현재 코드: 실제 ACE-Step 호출 경로와 폴백 경로를 함께 둔다

### 3-5. 최종 합성
- `ffmpeg`로 영상과 음악을 합쳐 `final_ad.mp4` 생성
- 이 부분은 현재도 실제 합성이 동작함

## 4. 모델 디렉토리 구조
- `models/z_image_turbo/`
- `models/wan_ti2v/`
- `models/ace_step/`
- `models/meta/`

## 5. 실행 조건
- 기본 실행: GPU 없이 가능
- 고급 로컬 모델 실행: `GCP VM + L4 GPU` 같은 CUDA 환경 필요
- 환경 변수:
  - `USE_LOCAL_AI_MODELS=false`: 기본값
  - `USE_LOCAL_AI_MODELS=true`: 로컬 대형 모델 경로 활성화

## 6. 결과물 저장 방식
프로젝트별 결과물은 아래처럼 묶여 저장된다.
- `banner_*.png`
- `detail_*.png`
- `logo_*.png`
- `music.wav`
- `video_raw.mp4`
- `final_ad.mp4`
- `assets.json`

## 7. 현재 확인된 동작
- `pytest` 통과
- `ruff check` 통과
- `/projects` 호출 시 결과 파일 생성 확인
- `/health` 응답 확인

## 8. 추후 확장
- `CosyVoice + Wan S2V` 기반 대본형 립싱크 영상은 현재 활성 범위 밖에 둔다.
