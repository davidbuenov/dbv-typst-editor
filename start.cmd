@echo off
REM =============================================================================
REM DBV Typst Editor - Arranque en modo desarrollo (Windows)
REM Copyright (c) 2026 David Bueno Vallejo - MIT License
REM Built with dbv-specs-ops - https://github.com/davidbuenov/dbv-specs-ops
REM =============================================================================
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando dependencias...
  call npm install || exit /b 1
)
echo Arrancando DBV Typst Editor...
call npm run dev
