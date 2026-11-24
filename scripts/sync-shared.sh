#!/usr/bin/env bash
# Copies the pure scanner/ingest core into the Forge app. With --check, fails if the copies drifted.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
dest="$root/forge/src/shared"
files=(ingest.js rules.js scanner.js)

if [[ "${1:-}" == "--check" ]]; then
  status=0
  for file in "${files[@]}"; do
    if ! cmp -s "$root/src/$file" "$dest/$file"; then
      echo "forge/src/shared/$file is out of date; run scripts/sync-shared.sh" >&2
      status=1
    fi
  done
  exit $status
fi

mkdir -p "$dest"
for file in "${files[@]}"; do cp "$root/src/$file" "$dest/$file"; done
echo "Synced ${files[*]} into forge/src/shared/"
