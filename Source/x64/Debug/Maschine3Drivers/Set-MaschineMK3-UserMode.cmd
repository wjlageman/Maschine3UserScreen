@echo off
setlocal

rem Check admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting administrator privileges...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"

echo Running in administrator mode.
echo.
echo Starting PowerShell user-mode script...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Set-MaschineMK3-UserMode.ps1" -NoPause

set EXITCODE=%ERRORLEVEL%

echo.
echo PowerShell script finished with exit code %EXITCODE%.
echo.
pause
exit /b %EXITCODE%