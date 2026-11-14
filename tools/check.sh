#!/usr/bin/env bash
# быстрая проверка перед коммитом: синтаксис всех js, загрузка без ошибок, 16 классов без исключений
cd "$(dirname "$0")/.."
fail=0
for f in js/*.js; do node --check "$f" 2>/dev/null || { echo "✗ синтаксис: $f"; node --check "$f"; fail=1; }; done
[ $fail = 0 ] && echo "ok синтаксис ($(ls js/*.js | wc -l) файлов)"
for s in $(grep -o 'js/[0-9a-z-]*\.js' index.html); do [ -f "$s" ] || { echo "✗ index.html ссылается на несуществующий $s"; fail=1; }; done
for f in js/*.js; do grep -q "$f" index.html || { echo "✗ $f не подключён в index.html"; fail=1; }; done
node tools/tests/load.js || fail=1
node tools/tests/smoke.js || fail=1
exit $fail
