#!/usr/bin/env bash
# =============================================================================
# DBV Typst Editor — Parada del entorno de desarrollo (macOS / Linux)
# Copyright (c) 2026 David Bueno Vallejo — MIT License
# Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
# =============================================================================
set -uo pipefail
echo "Cerrando procesos de desarrollo..."
pkill -f "dbv-typst-editor" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
echo "Hecho."
