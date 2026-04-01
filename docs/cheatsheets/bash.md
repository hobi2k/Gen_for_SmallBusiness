# Bash 빠른 치트시트

## 1. Bash가 하는 일
Bash는 터미널에서 명령을 실행하고 자동화 스크립트를 만드는 셸이다.

## 2. 기본 명령
```bash
pwd
ls -la
cd frontend
mkdir -p models/nunchaku_z_image_turbo
```

## 3. 파일 만들기
```bash
touch .env.example
```

## 4. 환경변수
```bash
export UV_CACHE_DIR=/tmp/uv-cache
```

한 줄에서만 쓰기:
```bash
UV_CACHE_DIR=/tmp/uv-cache uv venv --python 3.11
```

## 5. 스크립트 기본 구조
```bash
#!/usr/bin/env bash
set -euo pipefail

echo "시작"
```

## 6. 자주 쓰는 옵션
- `set -e`: 실패하면 중단
- `set -u`: 없는 변수 사용 시 실패
- `set -o pipefail`: 파이프 중간 실패도 잡기

## 7. 조건문
```bash
if [ -d models/nunchaku_z_image_turbo ]; then
  echo "디렉토리 있음"
fi
```

## 8. 실행 권한
```bash
chmod +x scripts/bootstrap.sh
```

## 9. 지금 프로젝트에서 중요하게 볼 것
- `uv` 가상환경 생성
- 테스트/빌드 스크립트 작성
- 모델 초기화 스크립트 실행
- 폴더 자동 생성
