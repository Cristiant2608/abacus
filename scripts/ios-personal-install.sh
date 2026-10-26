#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
XTOOL_BIN="${XTOOL_BIN:-$PROJECT_ROOT/.tools/xtool.AppImage}"
IPA_PATH="${1:-$PROJECT_ROOT/artifacts/abacus-probe-unsigned.ipa}"

if [[ ! -x "$XTOOL_BIN" ]]; then
  echo 'Falta xtool. Consulta docs/ios-personal.md.' >&2
  exit 1
fi
if [[ ! -f "$IPA_PATH" ]]; then
  echo "No se encontró el IPA: $IPA_PATH" >&2
  exit 1
fi

xtool_args=()
if [[ "$XTOOL_BIN" == *.AppImage ]]; then
  xtool_args+=(--appimage-extract-and-run)
fi

echo 'Desbloquea el iPhone y conéctalo por USB. La firma de Apple se realiza localmente.'
"$XTOOL_BIN" "${xtool_args[@]}" install --usb "$IPA_PATH"
