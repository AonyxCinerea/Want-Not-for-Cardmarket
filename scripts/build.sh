#!/usr/bin/env bash
# Packages the extension into dist/want-not-<version>.zip (works for Chrome and Firefox).
set -euo pipefail
cd "$(dirname "$0")/.."

version=$(node -p 'require("./manifest.json").version')
out_dir=${OUT_DIR:-dist}
out="$out_dir/want-not-$version.zip"

mkdir -p "$out_dir"
rm -f "$out"
zip -r -X -q "$out" manifest.json src options icons LICENSE -x '*.DS_Store'
echo "$out"
