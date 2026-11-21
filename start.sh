#!/usr/bin/env bash
# =============================================================================
# DBV Typst Editor — Arranque en modo desarrollo (macOS / Linux)
# Copyright (c) 2026 David Bueno Vallejo — MIT License
# Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  echo "Instalando dependencias..."
  npm install
fi
echo "Arrancando DBV Typst Editor..."
npm run dev
