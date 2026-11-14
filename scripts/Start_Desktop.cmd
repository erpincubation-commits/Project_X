@echo off
setlocal
cd /d "%~dp0.."
title SMB ERP Desktop
call npm start
if errorlevel 1 pause
