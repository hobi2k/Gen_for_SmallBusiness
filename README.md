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

## 프로젝트 원칙
- 이 저장소는 `git clone` 후 프로젝트 내부 의존성 설치와 모델 다운로드만으로 구동되어야 합니다.
- 개발 환경의 ComfyUI, Stability Matrix, 개인 워크플로우 JSON, 로컬 Windows 경로를 직접 참조하지 않습니다.
- 외부 워크플로우는 품질 비교와 파라미터 참고용으로만 사용하고, 실제 런타임은 이 저장소 안의 코드와 설치 절차만으로 재현되어야 합니다.
- vendored 소스는 `vendor/`에 보관하고, 설치 시 `.venv` 안으로 다시 설치해서 사용합니다.
- 즉 런타임 import는 `vendor/...`를 직접 읽는 것이 아니라 `.venv`의 `site-packages`에서 일어납니다.

## 현재 구현 상태
- 백엔드: `FastAPI + SQLite`
- 프론트엔드: `Next.js + TypeScript + Tailwind CSS`
- 이미지 생성: `nunchaku-ai/nunchaku-z-image-turbo` 실제 생성 확인
- 영상 생성: `Wan-AI/Wan2.2-TI2V-5B-Diffusers` 실제 생성 확인
- 음악 생성: `ACE-Step/Ace-Step1.5` 실제 생성 확인
- 음악 모델은 공식 `ACE-Step/Ace-Step1.5` 체크포인트를 기준으로 사용합니다.
- 최종 합성: `video_raw.mp4 + music.wav -> final_ad.mp4` 실제 생성 확인
- 실패 시 폴백 결과물을 만들지 않음

## 입력 방식

### 채팅
- 메인 채팅은 자연어 한 줄 요청만 받습니다.
- 추가 폼 입력은 붙이지 않습니다.
- LLM 에이전트가 도구를 직접 호출합니다.
- 부족하면 추가 질문을 돌려주고, 충분하면 이미지 / 영상 / 음악 생성으로 바로 들어갑니다.
- 사용자가 해상도를 문장 안에서 말하면 LLM이 배너 / 상세 / 영상 크기까지 도구 인자로 채웁니다.
- 해상도를 따로 말하지 않으면 기본값을 사용합니다.
- 보컬 모드에서 가사를 비워 두면 LLM이 상품 정보와 톤을 바탕으로 가사를 생성합니다.
- 음악의 `language`만 사용자 입력을 그대로 쓰고, 가사는 `사용자 입력 또는 GPT 생성`을 그대로 사용합니다.
- ACE-Step 5Hz LM 4B는 BPM / 조성 / 박자 / 메타 정리와 conditioning 보조를 맡습니다.

### 전용 생성
- 이미지 생성: 파일 업로드 지원
- 영상 생성: 파일 업로드 지원
- 음악 생성: 업로드 없이 입력만으로 생성 가능
- 기본 입력은 `상품명`, `프롬프트`, `톤`, `길이` 중심으로 유지합니다.
- 이미지 생성 화면:
  - 가로 배너 크기 직접 입력 가능
  - 세로 상세 이미지 크기 직접 입력 가능
- 영상 생성 화면:
  - 영상 해상도 직접 입력 가능
  - 프레임과 생성 스텝 직접 입력 가능
  - 세로 대표 이미지는 영상 해상도를 자동으로 따라감
  - 영상 요청은 배너와 상세 이미지 번들을 먼저 만들지 않고 바로 영상 생성으로 들어감
  - 기본 결과물은 영상만 만들고, 음악을 켜면 음악과 합성본까지 추가로 만듭니다
  - 요청이 끝나면 영상 파이프라인을 바로 해제해 GPU 메모리를 비움

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
- ACE-Step 런타임 작업 루트:
  - `.runtime/ace-step-runtime`

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

기본 해상도:
- 배너: `1280x720`
- 상세 이미지: `720x1280`
- 영상: `832x480`

이미지 생성 기준:
- 업로드 이미지가 있으면 `img2img`를 사용합니다.
- 현재 `img2img`와 `text-to-image`는 광고 포스터형 재구성 기준으로 설정돼 있습니다.
- 한국어 자체를 프롬프트에서 금지하지 않습니다.
- 영어 라벨은 모델이 만들 수 있게 열어두고, 한국어 카피는 후처리 오버레이로 붙입니다.

영상 생성 기준:
- 품질 우선 기준으로 `24fps` 고정입니다.
- 긴 영상은 요청 크기(해상도 × fps × steps)에 따라 `2~5초` 단위 세그먼트로 나눠 생성합니다.
- 영상 생성 스텝과 가이던스도 품질 우선으로 올린 상태입니다.
- 전용 영상 생성 화면에서는 `fps`와 `steps`를 직접 조절할 수 있습니다.
- 영상 요청이 끝나면 Wan 파이프라인 캐시를 비웁니다.

음악 생성 기준:
- ACE-Step 추론은 별도 작업 프로세스에서 실행합니다.
- 서버 프로세스는 음악 후처리와 길이 검증만 담당합니다.
- 전역 저장 함수 monkey patch를 서버 프로세스에 남기지 않습니다.
- 음악은 공식 `ACE-Step-1.5` 저장소 흐름을 따라 동작합니다.
- 사용자가 가사를 직접 쓰면 그 가사를 그대로 사용합니다.
- 사용자가 가사를 비워 두고 보컬 모드를 켜면 GPT가 먼저 가사를 작성합니다.
- ACE-Step 5Hz LM 4B는 가사를 새로 쓰는 대신 BPM, 조성, 박자, 메타 정리와 conditioning 보조를 맡습니다.

## 실행 방법

### 1. 가상환경과 의존성 설치
```bash
uv venv --python 3.11
uv pip install -e ".[dev]"
cd frontend
npm install
cd ..
```

Windows PowerShell:
```powershell
.\scripts\bootstrap.ps1
```

Windows CMD / 더블클릭:
```bat
.\scripts\bootstrap.bat
```

### 2. AI 의존성 설치
```bash
uv pip install -e ".[ai]"
UV_CACHE_DIR=.uv-cache uv pip install --no-deps --force-reinstall ./vendor/ace-step-src
UV_CACHE_DIR=.uv-cache uv pip install --no-deps --force-reinstall ./vendor/nunchaku-src
```

`ace-step`는 프로젝트 내부 [vendor/ace-step-src](vendor/ace-step-src) 기준으로 다시 설치합니다.
`nunchaku`는 프로젝트 내부 [vendor/nunchaku-src](vendor/nunchaku-src) 기준으로 다시 설치합니다.
즉 `/tmp` 같은 임시 경로를 기준으로 잡지 않습니다.
둘 다 `--no-deps`로 별도 설치해 프로젝트 내부 vendored 소스를 기준으로 고정합니다.
실제 import 위치는 `vendor/`가 아니라 `.venv` 안의 `site-packages`입니다.

### 3. 모델 디렉토리 준비
```bash
uv run python scripts/initialize_models.py --create-only
```

### 4. 모델 다운로드
```bash
uv run python scripts/initialize_models.py
```

Windows PowerShell:
```powershell
.\scripts\download-models.ps1
```

Windows CMD / 더블클릭:
```bat
.\scripts\download-models.bat
```

### 4-1. 환경 점검
```bash
uv run python scripts/check_environment.py
```

이 점검은 `nunchaku` import 경로가 `/tmp`를 타면 실패로 처리합니다.

### 5. 백엔드 실행
```bash
uv run uvicorn backend.app.main:app --host 127.0.0.1 --port 8013
```

Windows PowerShell:
```powershell
.\scripts\start-backend.ps1
```

Windows CMD / 더블클릭:
```bat
.\scripts\start-backend.bat
```

### 6. 프론트엔드 실행
```bash
cd frontend
npm run dev
```

Windows PowerShell:
```powershell
.\scripts\start-frontend.ps1
```

Windows CMD / 더블클릭:
```bat
.\scripts\start-frontend.bat
```

백엔드와 프론트를 한 번에 띄우려면:
```bat
.\scripts\start-all.bat
```

## 환경 변수
- `OPENAI_API_KEY`
- `USE_LOCAL_AI_MODELS=false`
- `BACKEND_BASE_URL=http://127.0.0.1:8013`

프론트는 이제 브라우저에서 백엔드 주소를 직접 치지 않습니다.  
Next.js의 `/api/...` 라우트가 중간에서 요청을 받아 `BACKEND_BASE_URL`로 프록시합니다.
기본 백엔드 포트는 `8013`으로 고정합니다.

## 동작 기준
- `USE_LOCAL_AI_MODELS=false`
  - 로컬 대형 모델 경로를 사용하지 않음
- `USE_LOCAL_AI_MODELS=true`
  - CUDA 환경에서 로컬 대형 모델 경로 활성화
  - 실패 시 폴백으로 넘기지 않고 바로 오류 반환

## 현재 검증 상태
- `pytest` 통과
- `ruff check backend tests scripts/initialize_models.py scripts/check_environment.py` 통과
- `uv run python scripts/check_environment.py` 통과
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
