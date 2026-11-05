"""Build the self-contained Windows launcher; does not rebuild/download the app."""
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent.parent
launcher = r'''@echo off
setlocal EnableExtensions DisableDelayedExpansion
title Opora - launch
pushd "%~dp0"
if errorlevel 1 exit /b 1
set "OPORA_PACKAGE_ROOT=%CD%"
set "OPORA_LAUNCHER=%~f0"
echo Starting Opora. Keep this window open until the app starts.
powershell.exe -NoLogo -NoProfile -Command "$text = [IO.File]::ReadAllText($env:OPORA_LAUNCHER); $marker = '# OPORA_POWERSHELL_START'; $offset = $text.LastIndexOf($marker); if ($offset -lt 0) { exit 1 }; & ([scriptblock]::Create($text.Substring($offset + $marker.Length)))"
if errorlevel 1 (
  echo.
  echo Opora could not start. Details are in OPORA-LAUNCH.log.
  pause
  popd
  exit /b 1
)
popd
exit /b 0
# OPORA_POWERSHELL_START
'''
launcher += (root / 'scripts/windows-launcher.ps1').read_text(encoding='utf-8')
payload = launcher.replace('\n', '\r\n').encode('utf-8')
(root / 'START-OPORA.cmd').write_bytes(payload)
# A ZIP gives browsers an actual download instead of displaying the CMD as text.
fix = root / 'distribution/Opora-launcher-fix.zip'
fix.parent.mkdir(exist_ok=True)
info = zipfile.ZipInfo('START-OPORA.cmd', date_time=(1980, 1, 1, 0, 0, 0))
info.compress_type = zipfile.ZIP_DEFLATED
with zipfile.ZipFile(fix, 'w') as archive:
    archive.writestr(info, payload)
print('Prepared START-OPORA.cmd and distribution/Opora-launcher-fix.zip.')
