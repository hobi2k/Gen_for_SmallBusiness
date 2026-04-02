Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

# 백엔드는 항상 8013 포트로 고정한다.
uv run uvicorn backend.app.main:app --host 127.0.0.1 --port 8013
