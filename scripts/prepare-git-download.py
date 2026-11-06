"""Prepare the tested Windows ZIP for GitHub's per-file size limit.

Run after npm run package:win. Builds the ZIP, standalone demo and GitHub parts.
No network access or credentials are used.
"""
from pathlib import Path
import hashlib
import json
import shutil
import base64
import zipfile
import subprocess
import sys
import re

root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'package.json').read_text())['version']
packaged = root / 'release/Opora-win32-x64'
if not (packaged / 'Opora.exe').is_file():
    raise RuntimeError('Run npm run package:win first.')
shutil.copyfile(root / 'OPORA.md', packaged / 'GUIDE.md')
(packaged / 'START-HERE.txt').write_text('ОПОРА ' + version + '\n\nЗапустите Opora.exe из полностью распакованной папки.\nВыберите папку игры с project.godot: Опора подготовит черновик брендбука.\nУ существующего проекта нажмите «Брендбук → Собрать из проекта».\nСледующие версии доступны через кнопку «Обновления» в верхней панели.\nПодробности: GUIDE.md.\n', encoding='utf-8-sig')
source = root / f'release/Opora-{version}-windows-x64.zip'
with zipfile.ZipFile(source,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
    for file in sorted(packaged.rglob('*')):
        if file.is_file(): archive.write(file, file.relative_to(packaged.parent))
with zipfile.ZipFile(source) as archive:
    if archive.testzip() is not None: raise RuntimeError('ZIP checksum failure')
html = (root / 'ui/index.html').read_text()
styles = re.findall(r'<link rel="stylesheet" href="([^"]+)">',html)
css = '\n'.join((root/'ui'/file).read_text() for file in styles)
for font in ['JetBrainsMono-Regular.ttf', 'JetBrainsMono-SemiBold.ttf']:
    encoded = base64.b64encode((root / 'ui/fonts' / font).read_bytes()).decode()
    css = css.replace("url('fonts/" + font + "')", "url('data:font/ttf;base64," + encoded + "')")
files = re.findall(r'<script defer src="([^"]+)"></script>',html)
scripts = [(root/'ui'/file).read_text().replace('</script', '<\\/script') for file in files]
def csp_hash(text):
    return "'sha256-" + base64.b64encode(hashlib.sha256(text.encode()).digest()).decode() + "'"
html=html.replace("script-src 'self'", 'script-src ' + ' '.join(csp_hash(script) for script in scripts)).replace("style-src 'self' 'unsafe-inline'", 'style-src ' + csp_hash(css))
html=html.replace("font-src 'self'", "font-src 'self' data:")
for file in styles: html=html.replace('  <link rel="stylesheet" href="'+file+'">','')
html=html.replace('</head>','<style>'+css+'</style></head>')
html=re.sub(r'  <script defer src="[^"]+"></script>','',html)
html=html.replace('</body>',''.join('<script>'+script+'</script>' for script in scripts)+'</body>')
(root / 'artifacts').mkdir(exist_ok=True)
(root / 'artifacts/Opora-demo.html').write_text(html)
target = root / "distribution/windows"
target.mkdir(parents=True, exist_ok=True)
parts = []
archive_hash = hashlib.sha256()
with source.open("rb") as stream:
    number = 1
    while chunk := stream.read(48 * 1024 * 1024):
        name = f"Opora-Windows.zip.part{number:02}"
        (target / name).write_bytes(chunk)
        archive_hash.update(chunk)
        parts.append({"name": name, "size": len(chunk), "sha256": hashlib.sha256(chunk).hexdigest()})
        number += 1
manifest = {"version": version, "platform": "windows-x64", "size": source.stat().st_size, "sha256": archive_hash.hexdigest(), "parts": parts}
(target / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
subprocess.run([sys.executable, str(root / 'scripts/prepare-launcher.py')], check=True)
shutil.copyfile(root / "artifacts/Opora-demo.html", root / "Opora-demo.html")
print(f"Prepared {len(parts)} parts. SHA256: {manifest['sha256']}")

subprocess.run([sys.executable, str(root / 'scripts/prepare-app-update.py')], check=True)
