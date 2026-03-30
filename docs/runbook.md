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
```

## 3. 모델 디렉토리 만들기
```bash
source .venv/bin/activate
python scripts/initialize_models.py --create-only
```

## 4. 모델 다운로드
```bash
source .venv/bin/activate
python scripts/initialize_models.py
```

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

## 7. 테스트
```bash
source .venv/bin/activate
pytest
ruff check backend tests scripts/initialize_models.py
```

## 8. 환경 변수
- `OPENAI_API_KEY`
- `USE_LOCAL_AI_MODELS=false`

## 9. 실행 해석 기준
- `USE_LOCAL_AI_MODELS=false`
  - GPU가 없어도 폴백 경로로 결과 파일 생성 가능
- `USE_LOCAL_AI_MODELS=true`
  - CUDA 가능 환경에서 로컬 대형 모델 경로 활성화

## 10. 생성 결과 확인 위치
- `storage/projects/<project_id>/`
- 생성 파일:
  - `banner_*.png`
  - `detail_*.png`
  - `logo_*.png`
  - `music.wav`
  - `video_raw.mp4`
  - `final_ad.mp4`
  - `assets.json`
