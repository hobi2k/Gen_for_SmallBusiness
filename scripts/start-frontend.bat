@echo off
setlocal
cd /d "%~dp0\.."
powershell -ExecutionPolicy Bypass -File ".\scripts\start-frontend.ps1"
endlocal
