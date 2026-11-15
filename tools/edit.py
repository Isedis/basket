#!/usr/bin/env python3
"""Безопасная правка файлов игры.

Использование (в heredoc):
    import sys; sys.path.insert(0, '/home/user/basket/tools'); from edit import Patch
    p = Patch('js/10-combat.js')          # путь от корня репозитория или абсолютный
    p.rep("старый текст", "новый текст")  # падает, если старый текст встречается не ровно 1 раз (или cnt раз)
    p.save()                              # запись атомарная: через временный файл; отказ, если файл «похудел» больше чем на 20%

Ничего не пишется, пока все rep() не прошли. Исходник при ошибке остаётся нетронутым.
"""
import os, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class Patch:
    def __init__(self, path):
        self.path = path if os.path.isabs(path) else os.path.join(ROOT, path)
        with open(self.path, encoding='utf-8') as f: self.orig = f.read()
        self.s = self.orig; self.n = 0
    def rep(self, old, new, cnt=1):
        c = self.s.count(old)
        if c != cnt: raise SystemExit(f'✗ {os.path.relpath(self.path, ROOT)}: «{old[:70]}…» найдено {c} раз, ожидалось {cnt} — ничего не записано')
        self.s = self.s.replace(old, new); self.n += 1; return self
    def save(self):
        if not self.s.strip(): raise SystemExit('✗ пустой результат — не записываю')
        if len(self.s) < len(self.orig) * .8: raise SystemExit(f'✗ файл уменьшился с {len(self.orig)} до {len(self.s)} байт — подозрительно, не записываю')
        d = os.path.dirname(self.path); fd, tmp = tempfile.mkstemp(dir=d, suffix='.tmp')
        with os.fdopen(fd, 'w', encoding='utf-8') as f: f.write(self.s)
        os.replace(tmp, self.path); print(f'✓ {os.path.relpath(self.path, ROOT)}: замен {self.n}, {len(self.orig)}→{len(self.s)} байт')

if __name__ == '__main__':
    print(__doc__)
