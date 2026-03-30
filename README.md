# Gen_for_SmallBusiness

소상공인이 상품 정보만 넣어도 광고 문구, 배너 이미지, 상세 이미지, 로고 초안, 짧은 영상, 최종 합성본까지 한 번에 만드는 서비스입니다.

## 현재 구현 상태
- 백엔드: `FastAPI + SQLite`
- 프론트엔드: `Next.js + TypeScript + Tailwind CSS`
- 이미지 생성: `Tongyi-MAI/Z-Image-Turbo` 연동 경로 준비 완료
- 영상 생성: `Wan-AI/Wan2.2-TI2V-5B-Diffusers` 연동 경로 준비 완료
- 음악 생성: `ACE-Step 1.5` 연동 경로 준비 완료
- 사용자가 영상 길이를 `3~10초` 사이에서 직접 고를 수 있도록 반영 예정
- 현재 기본 동작: GPU가 없을 때도 `png`, `wav`, `mp4` 결과물이 실제로 생성되도록 폴백 생성 경로 제공

## 지금 바로 실행하는 방법

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

### 4. 실제 모델 다운로드
```bash
source .venv/bin/activate
python scripts/initialize_models.py
```

## 실행

### 백엔드
```bash
source .venv/bin/activate
uvicorn backend.app.main:app --host 127.0.0.1 --port 8013
```

### 프론트엔드
```bash
cd frontend
npm run dev
```

## 환경 변수
- `OPENAI_API_KEY`: 문구 생성 고도화에 사용할 키
- `USE_LOCAL_AI_MODELS=false`: 기본값은 `false`
- GPU 환경에서 실제 로컬 모델 추론까지 타려면 `USE_LOCAL_AI_MODELS=true`

## 현재 중요한 제약
- 이 프로젝트는 지금도 `/projects` 호출 시 실제 결과 파일을 생성합니다.
- 다만 `Z-Image-Turbo`, `Wan`, `ACE-Step`의 대형 로컬 추론은 GPU 환경이 있어야 실제 모델 경로를 탑니다.
- GPU가 없으면 폴백 경로가 실행되어도 결과 파일은 정상 생성됩니다.
- 음악은 사용자가 고른 영상 길이에 맞춰 생성되도록 구성합니다.
- 음악 프롬프트는 사용자가 직접 음악 프롬프트를 길게 쓰는 대신, 문구 생성 단계에서 광고 문맥에 맞게 정리한 값을 사용합니다.

## 추후 확장
- `CosyVoice + Wan S2V` 기반 대본형 립싱크 영상은 현재 범위에서 제외
- 추후 확장 기능으로만 유지

## 참고 문서
- [구현 기획서](docs/20260330_implementation_plan.md)
- [아키텍처 문서](docs/architecture.md)
- [작업 분해 문서](docs/task-breakdown.md)
- [실행 런북](docs/runbook.md)
- [코드 스타일 가이드](docs/code_style_guide.md)
