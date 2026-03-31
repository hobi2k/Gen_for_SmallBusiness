# Gen_for_SmallBusiness

소상공인용 광고 콘텐츠 생성 서비스입니다.  
메인 화면에서는 채팅으로 바로 요청하고, 더 세밀하게 만들 때만 `이미지 생성`, `영상 생성`, `음악 생성` 전용 화면으로 들어갑니다.

## 현재 제품 구조
- 메인 진입점: 채팅
- 전용 생성 화면:
  - `/image`
  - `/video`
  - `/music`
- 공용 생성 계층:
  - 이미지 생성
  - 영상 생성
  - 음악 생성
  - 합성

즉 채팅과 전용 생성 화면은 서로 다른 엔진이 아니라 같은 백엔드 도구를 공유합니다.

## 현재 구현 상태
- 백엔드: `FastAPI + SQLite`
- 프론트엔드: `Next.js + TypeScript + Tailwind CSS`
- 이미지 생성: `Tongyi-MAI/Z-Image-Turbo` 연동 경로 준비 완료
- 영상 생성: `Wan-AI/Wan2.2-TI2V-5B-Diffusers` 연동 경로 준비 완료
- 음악 생성: `ACE-Step/Ace-Step1.5` 연동 경로 준비 완료
- GPU가 없어도 폴백 경로로 `png`, `wav`, `mp4`가 실제 생성됨

## 입력 방식

### 채팅
- 메인 채팅은 자연어 한 줄 요청만 받습니다.
- 추가 폼 입력은 붙이지 않습니다.
- 요청 문장에 따라 이미지 / 영상 / 음악 생성 흐름으로 연결합니다.

### 전용 생성
- 이미지 생성: 파일 업로드 지원
- 영상 생성: 파일 업로드 지원
- 음악 생성: 업로드 없이 입력만으로 생성 가능

### 음악 옵션
- 영상 생성은 음악을 아예 끌 수 있습니다.
- 보컬 방식이 `가사 포함`일 때만
  - 가사 언어
  - 가사
  입력이 보입니다.

## 저장 위치
- 생성 결과 기본 저장 위치:
  - `~/Downloads/장사한컷`
- 업로드 원본 임시 저장 위치:
  - `~/Downloads/uploads`

즉 예전 `storage/projects/` 기준이 아니라, 지금은 다운로드 폴더 기준으로 동작합니다.

## 생성 결과물
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
는 만들지 않습니다.

## 실행 방법

### 1. 가상환경과 의존성 설치
```bash
uv venv --python 3.11
source .venv/bin/activate
uv pip install -e ".[dev]"
cd frontend
npm install
cd ..
```

### 2. AI 의존성 설치
```bash
source .venv/bin/activate
uv pip install -e ".[ai]"
```

### 3. 모델 디렉토리 준비
```bash
source .venv/bin/activate
python scripts/initialize_models.py --create-only
```

### 4. 모델 다운로드
```bash
source .venv/bin/activate
python scripts/initialize_models.py
```

### 5. 백엔드 실행
```bash
source .venv/bin/activate
uvicorn backend.app.main:app --host 127.0.0.1 --port 8013
```

### 6. 프론트엔드 실행
```bash
cd frontend
npm run dev
```

## 환경 변수
- `OPENAI_API_KEY`
- `USE_LOCAL_AI_MODELS=false`

## 동작 기준
- `USE_LOCAL_AI_MODELS=false`
  - GPU가 없어도 폴백 결과물 생성 가능
- `USE_LOCAL_AI_MODELS=true`
  - CUDA 환경에서 로컬 대형 모델 경로 활성화

## 현재 검증 상태
- `pytest` 통과
- `ruff check backend tests scripts/initialize_models.py` 통과
- `frontend npm run build` 통과
- 실제 화면 스크린샷 확인 완료

## 현재 범위 밖
- `CosyVoice + Wan S2V` 대본형 립싱크 영상
- 실제 OpenAI 문구 생성 고도화

## 참고 문서
- [구현 기획서](docs/20260330_implementation_plan.md)
- [아키텍처 문서](docs/architecture.md)
- [작업 분해 문서](docs/task-breakdown.md)
- [실행 런북](docs/runbook.md)
- [코드 스타일 가이드](docs/code_style_guide.md)
