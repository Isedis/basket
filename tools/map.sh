#!/usr/bin/env bash
# карта кода: разделы и функции по файлам. ./tools/map.sh [слово] — найти, в каком файле определено имя
cd "$(dirname "$0")/.."
if [ -n "$1" ]; then grep -nE "^(async )?function $1\b|^(const|let|var) $1\b" js/*.js | cut -c1-160; grep -n "$1" js/*.js | head -0; exit; fi
for f in js/*.js; do echo "== $f ($(wc -l < $f) строк)"; grep -n "^/\* ---------- " "$f" | sed 's/\/\* ---------- //; s/ ---------- \*\///' | cut -c1-110; done
