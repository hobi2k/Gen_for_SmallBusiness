# 실행 런북

## 1. 기본 환경 준비
```bash
uv venv --python 3.11
source .venv/bin/activate
uv pip install -e ".[dev]"
cd frontend
npm install
cd ..
```

## 2. AI 의존성 설치
```bash
source .venv/bin/activate
uv pip install -e ".[ai]"
UV_CACHE_DIR=/tmp/uv-cache uv pip install --no-deps "ace-step @ git+https://github.com/ace-step/ACE-Step.git"
UV_CACHE_DIR=/tmp/uv-cache uv pip install --no-deps --force-reinstall ./vendor/nunchaku-src
```

추가 확인:
- `nunchaku`는 프로젝트 내부 `vendor/nunchaku-src` 기준으로 다시 설치한다.
- `ace-step`는 `transformers` 충돌을 피하기 위해 `--no-deps`로 별도 설치한다.
- 현재 프로젝트 코드는 `nunchaku`와 `diffusers` 시그니처 차이를 런타임에서 보정한다.

## 3. 모델 디렉토리 준비
```bash
source .venv/bin/activate
python scripts/initialize_models.py --create-only
```

## 4. 모델 다운로드
```bash
source .venv/bin/activate
python scripts/initialize_models.py
```

## 4-1. 환경 점검
```bash
source .venv/bin/activate
python scripts/check_environment.py
```

`nunchaku` import 경로가 `/tmp`를 타면 실패로 본다.

## 5. 백엔드 실행
```bash
source .venv/bin/activate
uvicorn backend.app.main:app --host 127.0.0.1 --port 8013
```

## 6. 프론트엔드 실행
```bash
cd frontend
npm run dev
```

프론트는 브라우저에서 FastAPI 주소를 직접 치지 않습니다.  
Next.js의 `app/api` 라우트가 중간에서 백엔드로 프록시합니다.

## 7. 테스트
```bash
source .venv/bin/activate
pytest
ruff check backend tests scripts/initialize_models.py scripts/check_environment.py
```

## 8. 환경 변수
- `OPENAI_API_KEY`
- `USE_LOCAL_AI_MODELS=false`
- `BACKEND_BASE_URL=http://127.0.0.1:8013`

## 9. 저장 위치
- 생성 결과:
  - `~/Downloads/장사한컷`
- 업로드 원본:
  - `~/Downloads/uploads`

## 10. 실행 해석 기준
- `USE_LOCAL_AI_MODELS=false`
  - 로컬 대형 모델 경로를 사용하지 않음
- `USE_LOCAL_AI_MODELS=true`
  - CUDA 환경에서 로컬 대형 모델 경로 활성화
  - 실패 시 폴백으로 넘기지 않고 바로 오류를 반환
- `BACKEND_BASE_URL`
  - Next.js 서버가 실제 FastAPI 주소를 찾을 때 사용

## 11. 현재 화면 구조
- 메인:
  - 채팅
- 전용 생성:
  - `/image`
  - `/video`
  - `/music`

프론트 요청 경로:
- `/api/chat/generate`
- `/api/generate/image`
- `/api/generate/video`
- `/api/generate/music`

## 12. 입력 규칙
- 채팅:
  - 자연어 요청만 입력
  - LLM 에이전트가 `ask_for_more_info`, `generate_image`, `generate_video`, `generate_music` 중 하나를 직접 호출
- 이미지 생성:
  - 파일 업로드 지원
- 영상 생성:
  - 파일 업로드 지원
  - 음악 포함 여부 선택 가능
- 음악 생성:
  - 업로드 없음
  - 보컬일 때만 가사 언어 / 가사 사용

## 13. 실제 생성 확인 파일
- 이미지:
  - `~/Downloads/장사한컷/image-real-check/banner_1.png`
- 원본 영상:
  - `~/Downloads/장사한컷/video-real-check/video_raw.mp4`
- 음악:
  - `~/Downloads/장사한컷/video-real-check/music.wav`
- 합성본:
  - `~/Downloads/장사한컷/video-real-check/final_ad.mp4`
