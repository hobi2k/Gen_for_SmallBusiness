# 소상공인용 광고 콘텐츠 제작 플랫폼 구현 기획서

## 1. 목표
이 프로젝트는 소상공인이 상품 정보만 입력해도 광고 문구, 배너, 상세 이미지, 로고 초안, 짧은 광고 영상, 최종 합성본까지 한 번에 만드는 서비스를 구현하는 것을 목표로 합니다.

핵심은 두 가지입니다.
- 사용자는 복잡한 생성 도구를 따로 다루지 않아도 된다.
- 내부는 단계별 도구 호출 구조로 움직여 실패 지점과 결과물을 분리해서 관리할 수 있다.

## 2. 현재 고정 입력
- 업종
- 상품명
- 한 줄 소개
- 상세 설명
- 핵심 키워드
- 판매 포인트
- 분위기
- 영상 길이 `3~10초`
- 상품 이미지 여러 장 또는 없음
- 필요 시 대본

## 3. 현재 고정 출력
- 광고 문구 묶음
- 배너 이미지 3장
- 상세 이미지 2장
- 로고 초안 2장
- 원본 광고 영상 1개
- 배경 음악 1개
- 최종 합성 영상 1개

## 4. 현재 고정 기술

### 4-1. 서버와 화면
- 백엔드: `FastAPI`
- 프론트엔드: `Next.js`
- 저장: `SQLite + storage/`

### 4-2. 모델
- 문구/오케스트레이터: `gpt-5-mini`
- 이미지: `Tongyi-MAI/Z-Image-Turbo`
- 영상: `Wan-AI/Wan2.2-TI2V-5B-Diffusers`
- 음악: `ACE-Step/Ace-Step1.5`
- 합성: `ffmpeg`

## 5. 도구 호출 흐름
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

## 6. 현재 구현 상태

### 6-1. 이미 구현된 것
- 프로젝트 생성 API
- SQLite 저장
- 결과물 메타데이터 저장
- 이미지, 영상, 음악, 합성 도구
- 실제 파일 생성 확인
- 테스트와 기본 실행 검증

### 6-2. 지금 바로 되는 것
- GPU가 없어도 `/projects` 호출 시 실제 결과물 생성
- 생성 파일:
  - `png`
  - `wav`
  - `mp4`
- `assets.json` 저장

### 6-3. GPU가 있을 때 활성화되는 것
- `Z-Image-Turbo` 로컬 이미지 생성
- 업로드 이미지가 있으면 `image-to-image` 경로 사용
- 업로드 이미지가 없으면 `text-to-image` 경로 사용
- `Wan` 로컬 영상 생성
- `ACE-Step` 로컬 음악 생성

조건은 아래와 같습니다.
- CUDA 사용 가능
- 모델 다운로드 완료
- `USE_LOCAL_AI_MODELS=true`

## 7. 현재 폴백 동작
현재 환경에서는 GPU가 없어도 서비스가 멈추지 않도록 폴백 생성 경로를 둡니다.

- 이미지:
  - 광고 카드 스타일 `png` 생성
- 음악:
  - `ffmpeg` 기반 간단한 배경음 `wav` 생성
- 영상:
  - 대표 이미지를 사용자가 고른 길이의 `mp4`로 변환
- 최종 합성:
  - `ffmpeg`로 실제 합성

즉 지금 상태에서도 “도구가 비어 있어서 생성이 안 되는” 문제는 없습니다.

## 8. 현재 남은 핵심 작업

### 8-1. 모델 다운로드 완료
- `Tongyi-MAI/Z-Image-Turbo`
- `Wan-AI/Wan2.2-TI2V-5B-Diffusers`
- `ACE-Step/Ace-Step1.5`

### 8-2. 실모델 추론 검증
- GPU 환경에서 이미지 생성 확인
- GPU 환경에서 영상 생성 확인
- GPU 환경에서 음악 생성 확인

### 8-3. 문구 생성 고도화
- 현재 기본 문구 생성 로직을 `OpenAI` 호출 기반으로 교체
- 음악 생성용 프롬프트도 문구 생성 단계에서 함께 정리

### 8-4. 입력과 결과 화면 보강
- 이미지 업로드 흐름 개선
- 결과 미리보기와 다운로드 UX 강화

### 8-5. 추후 확장
- `CosyVoice + Wan S2V` 기반 대본형 립싱크 영상

## 9. 운영 기준
- `models/`는 Git에 올리지 않음
- 생성 결과는 `storage/` 아래에 저장
- 실패 시 프로젝트 상태를 `failed`로 기록
- 결과와 요청 스냅샷은 `assets.json`과 DB에 함께 저장

## 10. 실행 기준

### 기본 실행
- GPU 없이 가능
- 폴백 결과물 생성 가능

### 고급 실행
- `GCP VM + L4 GPU`
- `USE_LOCAL_AI_MODELS=true`
- 로컬 대형 모델 경로 활성화
