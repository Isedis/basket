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

root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'package.json').read_text())['version']
packaged = root / 'release/Opora-win32-x64'
if not (packaged / 'Opora.exe').is_file():
    raise RuntimeError('Run npm run package:win first.')
shutil.copyfile(root / 'OPORA.md', packaged / 'GUIDE.md')
(packaged / 'START-HERE.txt').write_text('ОПОРА ' + version + '\n\nЗапустите Opora.exe из полностью распакованной папки.\nВыберите папку игры с project.godot: Опора подготовит черновик брендбука.\nУ существующего проекта нажмите «Визуальный стиль → Собрать брендбук из проекта».\nСледующие версии доступны через кнопку «Обновления» в верхней панели.\nПодробности: GUIDE.md.\n', encoding='utf-8-sig')
source = root / f'release/Opora-{version}-windows-x64.zip'
with zipfile.ZipFile(source,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
    for file in sorted(packaged.rglob('*')):
        if file.is_file(): archive.write(file, file.relative_to(packaged.parent))
with zipfile.ZipFile(source) as archive:
    if archive.testzip() is not None: raise RuntimeError('ZIP checksum failure')
html = (root / 'ui/index.html').read_text()
css = (root / 'ui/style.css').read_text()
context = (root / 'ui/context.js').read_text()
review = (root / 'ui/brand-review.js').read_text()
app = (root / 'ui/app.js').read_text()
def csp_hash(text):
    return "'sha256-" + base64.b64encode(hashlib.sha256(text.encode()).digest()).decode() + "'"
html=html.replace("script-src 'self'", 'script-src ' + csp_hash(context) + ' ' + csp_hash(review) + ' ' + csp_hash(app)).replace("style-src 'self'", 'style-src ' + csp_hash(css))
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
html=html.replace('  <script defer src="context.js"></script>','').replace('  <script defer src="app.js"></script>','')
html=html.replace('  <script defer src="brand-review.js"></script>','')
html=html.replace('</body>','<script>'+context+'</script><script>'+review+'</script><script>'+app+'</script></body>')
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
launcher = r'''@echo off
setlocal EnableExtensions DisableDelayedExpansion
title Opora - first launch
pushd "%~dp0"
if errorlevel 1 exit /b 1
set "OPORA_PACKAGE_ROOT=%CD%"
echo Preparing Opora. No installation or administrator rights required.
echo Keep this window open. The first launch may take a minute.
powershell.exe -NoLogo -NoProfile -Command "$ErrorActionPreference = 'Stop'; try { $root = $env:OPORA_PACKAGE_ROOT; $payload = Join-Path $root 'distribution\windows'; $manifest = Get-Content -LiteralPath (Join-Path $payload 'manifest.json') -Raw | ConvertFrom-Json; foreach ($part in $manifest.parts) { $p = Join-Path $payload $part.name; if (!(Test-Path -LiteralPath $p -PathType Leaf)) { throw ('Missing file: ' + $part.name + '. Extract the entire GitHub ZIP first.') }; if ((Get-Item -LiteralPath $p).Length -ne $part.size) { throw ('Wrong size: ' + $part.name) }; if ((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash -ne $part.sha256) { throw ('Checksum mismatch: ' + $part.name) } }; Write-Host 'All parts verified. Reassembling archive...'; $archive = Join-Path $payload 'Opora-Windows.zip'; $outputStream = [System.IO.File]::Create($archive); try { foreach ($part in $manifest.parts) { $inputStream = [System.IO.File]::OpenRead((Join-Path $payload $part.name)); try { $inputStream.CopyTo($outputStream) } finally { $inputStream.Dispose() } } } finally { $outputStream.Dispose() }; if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $manifest.sha256) { throw 'Archive checksum mismatch. Application was not started.' }; Write-Host 'Archive verified. Unpacking Opora...'; $destination = Join-Path $root 'Opora-App'; Expand-Archive -LiteralPath $archive -DestinationPath $destination -Force; $appFolder = Join-Path $destination 'Opora-win32-x64'; $exe = Join-Path $appFolder 'Opora.exe'; if (!(Test-Path -LiteralPath $exe -PathType Leaf)) { throw 'Opora.exe not found after extraction.' }; Start-Process -FilePath $exe -WorkingDirectory $appFolder; Write-Host 'Opora started. Next time you can open Opora-App\Opora-win32-x64\Opora.exe directly.' } catch { Write-Host ('ERROR: ' + $_.Exception.Message) -ForegroundColor Red; exit 1 }"
if errorlevel 1 (
  echo.
  echo Opora could not start. Please send the error above.
  pause
  popd
  exit /b 1
)
popd
endlocal
'''
(root / "START-OPORA.cmd").write_bytes(launcher.replace("\n", "\r\n").encode("ascii"))
shutil.copyfile(root / "artifacts/Opora-demo.html", root / "Opora-demo.html")
print(f"Prepared {len(parts)} parts. SHA256: {manifest['sha256']}")
