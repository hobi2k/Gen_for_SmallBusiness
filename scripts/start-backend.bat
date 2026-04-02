@echo off
setlocal
cd /d "%~dp0\.."
powershell -ExecutionPolicy Bypass -File ".\scripts\start-backend.ps1"
endlocal
