#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

rm -rf "${ROOT_DIR}/dist/build" "${ROOT_DIR}/store/paquetes"
echo "[clean] Eliminados dist/build y store/paquetes"
