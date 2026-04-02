Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $ProjectRoot "frontend")

# Next.js 프록시는 기본으로 8013 백엔드에 붙는다.
$env:BACKEND_BASE_URL = "http://127.0.0.1:8013"
npm run dev
