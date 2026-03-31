# 아키텍처 문서

## 1. 전체 구조
- 프론트엔드: `frontend/`의 `Next.js` 앱
- 백엔드: `backend/app/`의 `FastAPI` 앱
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

## 4. 진입점별 동작

### 채팅
- `/chat/generate`
- 자연어 요청
- 이미지 / 영상 / 음악 의도 분기
- 공용 생성 서비스 호출

### 이미지 생성
- `/generate/image`
- `multipart/form-data`
- 파일 업로드 지원

### 영상 생성
- `/generate/video`
- `multipart/form-data`
- 파일 업로드 지원
- 음악 포함 여부 지원

### 음악 생성
- `/generate/music`
- 입력만으로 생성
- 업로드 없음

## 5. 현재 모델 구성

### 이미지
- 목표 모델: `Tongyi-MAI/Z-Image-Turbo`
- 업로드 이미지가 있으면 `image-to-image`
- 업로드 이미지가 없으면 `text-to-image`

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

## 6. 폴백 경로

### 이미지
- 광고 카드 스타일 `png`

### 영상
- 대표 이미지를 길이에 맞는 `mp4`로 변환

### 음악
- `ffmpeg` 기반 `wav`

### 합성
- `ffmpeg`

## 7. 저장 결과
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

## 8. 현재 검증 상태
- `pytest` 통과
- `ruff check` 통과
- `frontend npm run build` 통과
- 실제 화면 스크린샷 확인 완료

## 9. 범위 밖
- `CosyVoice + Wan S2V` 립싱크 영상
