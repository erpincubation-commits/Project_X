@echo off
setlocal
cd /d "%~dp0.."
title SMB ERP Setup
call npm ci
if errorlevel 1 goto failed
call npm run setup
if errorlevel 1 goto failed
echo Setup complete. Read administrator credentials in .env, then run Start_Desktop.cmd.
pause
exit /b 0
:failed
pause
exit /b 1
