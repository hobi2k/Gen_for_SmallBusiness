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
UV_CACHE_DIR=.uv-cache uv pip install --no-deps "ace-step @ git+https://github.com/ace-step/ACE-Step.git"
UV_CACHE_DIR=.uv-cache uv pip install --no-deps --force-reinstall ./vendor/nunchaku-src
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

기본 백엔드 포트는 `8013`으로 고정합니다.

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
  - 기본 입력은 상품명, 프롬프트, 톤
  - 파일 업로드 지원
  - 배너와 상세 이미지 크기 직접 입력 가능
- 영상 생성:
  - 기본 입력은 상품명, 프롬프트, 톤, 길이
  - 파일 업로드 지원
  - 음악 포함 여부 선택 가능
  - 영상 해상도 직접 입력 가능
  - 프레임과 생성 스텝 직접 입력 가능
  - 세로 대표 이미지는 영상 해상도를 자동으로 따라감
  - 배너와 상세 이미지 번들을 먼저 만들지 않고 바로 영상 생성으로 들어감
  - 기본 결과물은 영상만 만들고, 음악을 켜면 음악과 합성본이 추가됨
  - 요청이 끝나면 Wan 파이프라인을 바로 해제
- 음악 생성:
  - 기본 입력은 상품명, 프롬프트, 톤, 길이
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

## 14. 기본 해상도
- 배너: `1280x720`
- 상세 이미지: `720x1280`
- 영상: `832x480`

## 15. 현재 생성 기준
- 이미지
  - 업로드 이미지가 있으면 `img2img`
  - 업로드 이미지가 없으면 `text-to-image`
  - 둘 다 광고 포스터형 재구성 기준으로 동작
  - 영어 라벨은 모델이 만들 수 있게 열어두고, 한국어 카피는 후처리 오버레이로 넣음
- 영상
  - `24fps` 고정
  - 긴 영상은 요청 크기에 따라 `2~5초` 단위 세그먼트로 분할 생성
- 음악
  - 보컬 모드에서 가사가 비어 있으면 LLM이 가사를 생성
  - LLM이 가사를 만들지 못하면 실패 처리
  - ACE-Step은 별도 작업 프로세스에서 실행
