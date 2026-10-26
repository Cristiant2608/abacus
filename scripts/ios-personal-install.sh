#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
XTOOL_BIN="${XTOOL_BIN:-$PROJECT_ROOT/.tools/xtool.AppImage}"
IPA_PATH="${1:-$PROJECT_ROOT/artifacts/abacus-personal-unsigned.ipa}"

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

STAGING_DIR="$(mktemp -d "${TMPDIR:-/tmp}/abacus-signing.XXXXXX")"
trap 'rm -rf -- "$STAGING_DIR"' EXIT
python3 "$PROJECT_ROOT/scripts/prepare-xtool-ipa.py" "$IPA_PATH" "$STAGING_DIR/install.ipa" > "$STAGING_DIR/identity.json"

echo 'Desbloquea el iPhone y conéctalo por USB. La firma de Apple se realiza localmente.'
"$XTOOL_BIN" "${xtool_args[@]}" install --usb "$STAGING_DIR/install.ipa"

# Read only the expected app's public installation metadata when the local
# diagnostic CLI is available. A successful transfer alone does not validate ID.
DEVICE_CLI="$PROJECT_ROOT/.tools/mobile-device/bin/pymobiledevice3"
if [[ -x "$DEVICE_CLI" ]]; then
  EXPECTED_APP_ID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["app_id"])' "$STAGING_DIR/identity.json")"
  "$DEVICE_CLI" apps query "$EXPECTED_APP_ID" > "$STAGING_DIR/installed.json"
  python3 - "$STAGING_DIR/identity.json" "$STAGING_DIR/installed.json" <<'PY'
import json, sys
expected = json.load(open(sys.argv[1]))
installed = json.load(open(sys.argv[2])).get(expected['app_id'], {})
if installed.get('CFBundleIdentifier') != expected['app_id'] or str(installed.get('CFBundleVersion')) != str(expected['build']):
    sys.exit('La identidad o versión instalada no coincide con los metadatos de Atajos. No se considera verificada.')
print('Identidad y versión instaladas verificadas: ' + expected['app_id'] + ' (' + str(expected['build']) + ')')
PY
else
  echo 'Instalación terminada; verificar la identidad instalada y la aparición de acciones en Atajos en el iPhone.'
fi
