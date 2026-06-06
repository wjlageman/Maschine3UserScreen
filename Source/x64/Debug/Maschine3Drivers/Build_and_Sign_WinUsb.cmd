@echo off
setlocal

REM ----------------------------------------
REM Check for admin rights
REM ----------------------------------------
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting administrator privileges...

    powershell -Command "Start-Process cmd -ArgumentList '/c \"%~f0\"' -Verb RunAs"
    exit /b
)

REM ----------------------------------------
REM We are admin now
REM ----------------------------------------
echo Running in administrator mode.
echo.

REM Resolve paths
set SCRIPT_DIR=%~dp0
set PS_SCRIPT=%SCRIPT_DIR%Build-Sign-MaschineMK3Driver.ps1

if not exist "%PS_SCRIPT%" (
    echo ERROR: PowerShell script not found:
    echo %PS_SCRIPT%
    echo.
    pause
    exit /b 1
)

REM ----------------------------------------
REM Run PowerShell script
REM ----------------------------------------
echo Starting PowerShell reset script...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%"

set EXITCODE=%ERRORLEVEL%

echo.
echo PowerShell script finished with exit code %EXITCODE%.
echo.

pause
exit /b %EXITCODE%