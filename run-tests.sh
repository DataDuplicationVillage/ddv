#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -x ".venv/Scripts/python.exe" ] && [ ! -x ".venv/bin/python" ]; then
  echo "Python virtual environment not found in .venv" >&2
  exit 1
fi

if [ -x ".venv/Scripts/python.exe" ]; then
  .venv/Scripts/python.exe manage.py test tracker.tests -v 2
else
  .venv/bin/python manage.py test tracker.tests -v 2
fi
