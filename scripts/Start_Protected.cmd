@echo off
setlocal
cd /d "%~dp0.."
set "PYTHONPATH=%CD%\src;%PYTHONPATH%"
title ERP Incubation - Protected Legacy Workspace
where py >nul 2>nul
if not errorlevel 1 (
  py -3 -m erp.legacy.desktop
) else (
  python -m erp.legacy.desktop
)
if errorlevel 1 pause
