@echo off
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%..\\.."

REM Pi BOOM Audio System Startup Script for Windows
REM This script sets up the environment for Pi mode operation

echo 🎵 Starting Pi BOOM Audio System in Pi mode...

REM Set the mode to Pi
set MODE=pi

REM Set Google Cloud credentials path (use Windows path format)
set GOOGLE_APPLICATION_CREDENTIALS=%CD%\google-credentials.json

REM Verify the credentials file exists
if not exist "%GOOGLE_APPLICATION_CREDENTIALS%" (
    echo ❌ Error: Google Cloud credentials file not found at %GOOGLE_APPLICATION_CREDENTIALS%
    echo Please ensure google-credentials.json is in the current directory
    pause
    exit /b 1
)

echo ✅ Google Cloud credentials found at: %GOOGLE_APPLICATION_CREDENTIALS%

echo 🚀 Starting server in Pi mode...
echo    Mode: %MODE%
echo    Google Credentials: %GOOGLE_APPLICATION_CREDENTIALS%
echo    Port: 3000
echo.
echo Press Ctrl+C to stop the server
echo.

REM Start the server
npm start

pause
