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

## 9. 저장 위치
- 생성 결과:
  - `~/Downloads/장사한컷`
- 업로드 원본:
  - `~/Downloads/uploads`

## 10. 실행 해석 기준
- `USE_LOCAL_AI_MODELS=false`
  - GPU가 없어도 폴백 결과물 생성 가능
- `USE_LOCAL_AI_MODELS=true`
  - CUDA 환경에서 로컬 대형 모델 경로 활성화

## 11. 현재 화면 구조
- 메인:
  - 채팅
- 전용 생성:
  - `/image`
  - `/video`
  - `/music`

## 12. 입력 규칙
- 채팅:
  - 자연어 요청만 입력
- 이미지 생성:
  - 파일 업로드 지원
- 영상 생성:
  - 파일 업로드 지원
  - 음악 포함 여부 선택 가능
- 음악 생성:
  - 업로드 없음
  - 보컬일 때만 가사 언어 / 가사 사용
