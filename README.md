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
- 이미지 생성: `nunchaku-ai/nunchaku-z-image-turbo` 실제 생성 확인
- 영상 생성: `Wan-AI/Wan2.2-TI2V-5B-Diffusers` 실제 생성 확인
- 음악 생성: `ACE-Step/Ace-Step1.5` 실제 생성 확인
- 최종 합성: `video_raw.mp4 + music.wav -> final_ad.mp4` 실제 생성 확인
- 실패 시 폴백 결과물을 만들지 않음

## 입력 방식

### 채팅
- 메인 채팅은 자연어 한 줄 요청만 받습니다.
- 추가 폼 입력은 붙이지 않습니다.
- LLM 에이전트가 도구를 직접 호출합니다.
- 부족하면 추가 질문을 돌려주고, 충분하면 이미지 / 영상 / 음악 생성으로 바로 들어갑니다.

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
UV_CACHE_DIR=/tmp/uv-cache uv pip install --no-deps "ace-step @ git+https://github.com/ace-step/ACE-Step.git"
UV_CACHE_DIR=/tmp/uv-cache uv pip install --no-deps --force-reinstall ./vendor/nunchaku-src
```

`nunchaku`는 프로젝트 내부 [vendor/nunchaku-src](/home/hosung/pytorch-demo/Gen_for_SmallBusiness/vendor/nunchaku-src) 기준으로 다시 설치합니다.
즉 `/tmp` 같은 임시 경로를 기준으로 잡지 않습니다.
`ace-step`는 `transformers` 충돌을 피하기 위해 별도 단계에서 `--no-deps`로 설치합니다.

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

### 4-1. 환경 점검
```bash
source .venv/bin/activate
python scripts/check_environment.py
```

이 점검은 `nunchaku` import 경로가 `/tmp`를 타면 실패로 처리합니다.

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
- `BACKEND_BASE_URL=http://127.0.0.1:8013`

프론트는 이제 브라우저에서 백엔드 주소를 직접 치지 않습니다.  
Next.js의 `/api/...` 라우트가 중간에서 요청을 받아 `BACKEND_BASE_URL`로 프록시합니다.

## 동작 기준
- `USE_LOCAL_AI_MODELS=false`
  - 로컬 대형 모델 경로를 사용하지 않음
- `USE_LOCAL_AI_MODELS=true`
  - CUDA 환경에서 로컬 대형 모델 경로 활성화
  - 실패 시 폴백으로 넘기지 않고 바로 오류 반환

## 현재 검증 상태
- `pytest` 통과
- `ruff check backend tests scripts/initialize_models.py scripts/check_environment.py` 통과
- `python scripts/check_environment.py` 통과
- `frontend npm run build` 통과
- 실제 이미지, 영상, 음악, 합성본 생성 확인 완료

## 현재 범위 밖
- `CosyVoice + Wan S2V` 대본형 립싱크 영상
- 실제 OpenAI 문구 생성 고도화

## 참고 문서
- [구현 기획서](docs/20260330_implementation_plan.md)
- [아키텍처 문서](docs/architecture.md)
- [작업 분해 문서](docs/task-breakdown.md)
- [실행 런북](docs/runbook.md)
- [런타임 패치 정리](docs/runtime_patch_notes.md)
- [환경 재현성 점검](docs/reproducibility_check.md)
- [코드 스타일 가이드](docs/code_style_guide.md)
- [코드 읽기 안내서](docs/cookbook/README.md)
