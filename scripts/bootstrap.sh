#!/usr/bin/env bash
set -euo pipefail

uv venv --python 3.11
source .venv/bin/activate
uv pip install -e ".[dev]"
uv pip install -e ".[ai]"
UV_CACHE_DIR=/tmp/uv-cache uv pip install --no-deps "ace-step @ git+https://github.com/ace-step/ACE-Step.git"
UV_CACHE_DIR=/tmp/uv-cache uv pip install --no-deps --force-reinstall ./vendor/nunchaku-src
ruff check backend tests
pytest
python scripts/initialize_models.py --create-only
python scripts/check_environment.py
cd frontend
npm install
mkdir -p .next
npm run build
