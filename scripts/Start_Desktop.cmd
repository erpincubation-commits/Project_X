@echo off
setlocal
cd /d "%~dp0.."
set "PYTHONPATH=%CD%\src;%PYTHONPATH%"
title ERP Incubation Desktop
if not exist "src\erp\legacy\workbench.py" (
  echo Extract the entire ZIP first, then run Start_Desktop.cmd.
  pause
  exit /b 1
)
where py >nul 2>nul
if not errorlevel 1 (
  py -3 -m erp.legacy.workbench
) else (
  python -m erp.legacy.workbench
)
if errorlevel 1 pause
