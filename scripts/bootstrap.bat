@echo off
setlocal
cd /d "%~dp0\.."
powershell -ExecutionPolicy Bypass -File ".\scripts\bootstrap.ps1"
endlocal
