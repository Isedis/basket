#!/usr/bin/env bash
# новый номер сборки: BUILD в index.html и ?v= у всех css/js (сбрасывает кэш телефона). Печатает ссылку для проверки.
set -e; cd "$(dirname "$0")/.."
B=$(date -u +%Y%m%d%H%M%S)
sed -i -E "s/const BUILD = '[0-9]+'/const BUILD = '$B'/; s/(\.(js|css))\?v=[0-9]+/\1?v=$B/g" index.html
grep -q "const BUILD = '$B'" index.html || { echo "✗ BUILD не обновлён"; exit 1; }
echo "https://isedis.github.io/basket/?v=$B"
