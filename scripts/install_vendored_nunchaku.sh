#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
source .venv/bin/activate
UV_CACHE_DIR=.uv-cache uv pip install --no-deps --force-reinstall ./vendor/nunchaku-src
