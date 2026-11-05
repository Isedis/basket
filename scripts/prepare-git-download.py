"""Prepare the tested Windows ZIP for GitHub's per-file size limit.

Run after packaging and creating release/Opora-0.1.0-windows-x64.zip.
No network access or credentials are used.
"""
from pathlib import Path
import hashlib
import json
import shutil

root = Path(__file__).resolve().parent.parent
source = root / "release/Opora-0.1.0-windows-x64.zip"
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
manifest = {"version": "0.1.0", "platform": "windows-x64", "size": source.stat().st_size, "sha256": archive_hash.hexdigest(), "parts": parts}
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
