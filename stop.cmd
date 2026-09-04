@echo off
REM =============================================================================
REM DBV Typst Editor - Parada del entorno de desarrollo (Windows)
REM Copyright (c) 2026 David Bueno Vallejo - MIT License
REM Built with dbv-specs-ops - https://github.com/davidbuenov/dbv-specs-ops
REM =============================================================================
echo Cerrando la aplicacion...
taskkill /IM "dbv-typst-editor.exe" /F >nul 2>&1

REM El servidor de Vite es un proceso hijo que sobrevive al cierre de la app y
REM deja el puerto 1420 ocupado, impidiendo el siguiente arranque.
echo Liberando el puerto 1420 (servidor de Vite)...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":1420" ^| findstr "LISTENING"') do taskkill /PID %%p /F >nul 2>&1
echo Hecho.
