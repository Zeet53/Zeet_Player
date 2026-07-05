@echo off
cd /d "%~dp0packages\desktop"
call npm run package
pause
