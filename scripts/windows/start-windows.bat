@echo off
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%..\\.."

echo Starting PiBoom Audio System for Windows...
echo.
echo This will start the server with voice commands enabled
echo Voice recognition will work using your browser's built-in capabilities
echo.
echo Press Ctrl+C to stop the server
echo.

REM Set environment variables for Windows voice mode
set MODE=cloud
set PORT=3000

REM Start the server from repo root so .env is picked up
npm start

pause

