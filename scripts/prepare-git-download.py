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
css = (root / 'ui/style.css').read_text()
for font in ['JetBrainsMono-Regular.ttf', 'JetBrainsMono-SemiBold.ttf']:
    encoded = base64.b64encode((root / 'ui/fonts' / font).read_bytes()).decode()
    css = css.replace("url('fonts/" + font + "')", "url('data:font/ttf;base64," + encoded + "')")
context = (root / 'ui/context.js').read_text()
review = (root / 'ui/brand-review.js').read_text()
project_map = (root / 'ui/project-map.js').read_text()
feedback = (root / 'ui/visual-feedback.js').read_text()
app = (root / 'ui/app.js').read_text()
def csp_hash(text):
    return "'sha256-" + base64.b64encode(hashlib.sha256(text.encode()).digest()).decode() + "'"
html=html.replace("script-src 'self'", 'script-src ' + csp_hash(context) + ' ' + csp_hash(review) + ' ' + csp_hash(project_map) + ' ' + csp_hash(feedback) + ' ' + csp_hash(app)).replace("style-src 'self'", 'style-src ' + csp_hash(css))
html=html.replace("font-src 'self'", "font-src 'self' data:")
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
html=html.replace('  <script defer src="context.js"></script>','').replace('  <script defer src="app.js"></script>','')
html=html.replace('  <script defer src="brand-review.js"></script>','').replace('  <script defer src="project-map.js"></script>','').replace('  <script defer src="visual-feedback.js"></script>','')
html=html.replace('</body>','<script>'+context+'</script><script>'+review+'</script><script>'+project_map+'</script><script>'+feedback+'</script><script>'+app+'</script></body>')
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
