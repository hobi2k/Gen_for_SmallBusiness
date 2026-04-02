# 환경 재현성 점검

## 점검 목적
- 새 환경에서도 현재 프로젝트가 같은 방식으로 실행되는지 확인한다.
- 특히 실제 생성에 필요한 의존성, 모델 디렉토리, 외부 실행 파일이 빠지지 않았는지 본다.

## 자동 점검 스크립트
- 스크립트: [check_environment.py](scripts/check_environment.py)

실행:

```bash
source .venv/bin/activate
uv run scripts/check_environment.py
```

이 스크립트는 다음을 확인한다.
- `torch`
- `diffusers`
- `nunchaku`
- `ACE-Step`
- `ffmpeg`
- `node`
- `CUDA`
- 로컬 모델 디렉토리

추가 규칙:
- `nunchaku` import 경로가 `/tmp`면 실패
- 프로젝트 내부 `vendor/nunchaku-src` 기준 설치를 전제로 함

## 이번 점검에서 확인한 항목
- `pytest`
- `ruff check backend tests scripts/initialize_models.py scripts/check_environment.py`
- `uv run scripts/initialize_models.py --create-only`
- `uv run scripts/check_environment.py`
- `frontend npm run build`

## 현재 재현성 기준
- Python: `3.11`
- torch: `2.10`
- 프론트: `Next.js`
- 저장 위치:
  - 결과: `~/Downloads/장사한컷`
  - 업로드 원본: `~/Downloads/uploads`

## 주의할 점
- `nunchaku`는 현재 CUDA / torch 조합에 맞는 설치가 필요하다.
- 새 환경에서는 AI 의존성 설치 뒤에 반드시 아래를 다시 실행한다.

```bash
UV_CACHE_DIR=.uv-cache uv pip install --no-deps --force-reinstall ./vendor/nunchaku-src
```

- `ace-step`도 아래처럼 프로젝트 내부 vendored 소스로 별도 설치한다.

```bash
UV_CACHE_DIR=.uv-cache uv pip install --no-deps --force-reinstall ./vendor/ace-step-src
```

- 현재 프로젝트 코드는 `nunchaku` 런타임 시그니처 차이를 자체 보정하지만,
  - 설치 자체가 빠져 있으면 생성은 시작되지 않는다.

## 실제 생성 검증 기준
- 이미지: `banner_1.png`
- 영상: `video_raw.mp4`
- 음악: `music.wav`
- 합성본: `final_ad.mp4`

현재 이 네 파일은 실제 생성까지 확인한 상태다.
