@echo off
setlocal
cd /d "%~dp0\.."
start "Gen_for_SmallBusiness Backend" cmd /k ".\scripts\start-backend.bat"
start "Gen_for_SmallBusiness Frontend" cmd /k ".\scripts\start-frontend.bat"
endlocal
