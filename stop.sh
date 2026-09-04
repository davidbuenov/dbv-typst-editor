#!/usr/bin/env bash
# =============================================================================
# DBV Typst Editor — Parada del entorno de desarrollo (macOS / Linux)
# Copyright (c) 2026 David Bueno Vallejo — MIT License
# Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
# =============================================================================
set -uo pipefail
echo "Cerrando la aplicacion..."
pkill -f "dbv-typst-editor" 2>/dev/null || true

# El servidor de Vite sobrevive al cierre de la app y deja el puerto 1420
# ocupado, impidiendo el siguiente arranque.
echo "Liberando el puerto 1420 (servidor de Vite)..."
if command -v lsof >/dev/null 2>&1; then
  lsof -ti tcp:1420 | xargs -r kill -9 2>/dev/null || true
else
  pkill -f "vite" 2>/dev/null || true
fi
echo "Hecho."
