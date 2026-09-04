@echo off
REM =============================================================================
REM DBV Typst Editor - Parada del entorno de desarrollo (Windows)
REM Copyright (c) 2026 David Bueno Vallejo - MIT License
REM Built with dbv-specs-ops - https://github.com/davidbuenov/dbv-specs-ops
REM =============================================================================
echo Cerrando procesos de desarrollo...
taskkill /IM "dbv-typst-editor.exe" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq DBV Typst Editor*" /F >nul 2>&1
echo Hecho.
