@echo off
title MovieRank dev server - keep this window open while rating
cd /d "%~dp0"
start "" http://localhost:5173
npm run dev -- --port 5173 --strictPort
pause
