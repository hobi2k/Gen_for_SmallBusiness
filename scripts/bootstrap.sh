#!/usr/bin/env bash
set -euo pipefail

uv venv --python 3.11
source .venv/bin/activate
uv pip install -e ".[dev]"
ruff check backend tests
pytest
python scripts/initialize_models.py --create-only
cd frontend
npm install
mkdir -p .next
npm run build
