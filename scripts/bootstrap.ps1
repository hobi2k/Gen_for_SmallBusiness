Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# 프로젝트 루트를 기준으로 모든 설치 경로를 고정한다.
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

# uv 캐시와 런타임 경로도 프로젝트 안으로 둔다.
$env:UV_CACHE_DIR = Join-Path $ProjectRoot ".uv-cache"

Write-Host "[1/8] Python 3.11 가상환경 생성"
uv venv --python 3.11

Write-Host "[2/8] 개발 의존성 설치"
uv pip install -e ".[dev]"

Write-Host "[3/8] AI 의존성 설치"
uv pip install -e ".[ai]"

Write-Host "[4/8] vendored ACE-Step-1.5 재설치"
uv pip install --no-deps --force-reinstall .\vendor\ace-step-src

Write-Host "[5/8] vendored nunchaku 재설치"
uv pip install --no-deps --force-reinstall .\vendor\nunchaku-src

Write-Host "[6/8] 프론트엔드 의존성 설치"
Set-Location (Join-Path $ProjectRoot "frontend")
npm install
Set-Location $ProjectRoot

Write-Host "[7/8] 모델 디렉토리 준비"
uv run python .\scripts\initialize_models.py --create-only

Write-Host "[8/8] 환경 점검"
uv run python .\scripts\check_environment.py

Write-Host "완료: 이제 모델 다운로드 후 백엔드와 프론트를 실행하면 됩니다."
