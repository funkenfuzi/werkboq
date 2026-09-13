@echo off
REM Doppelklick-Start für Windows: PocketBase + Vite-Dev-Server
cd /d "%~dp0\.."
if not exist node_modules call npm install
start "Werkboq Server" cmd /k npm run server
timeout /t 2 >nul
npm run dev
