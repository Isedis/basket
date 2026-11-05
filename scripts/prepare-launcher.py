"""Build the self-contained Windows launcher; does not rebuild/download the app."""
from pathlib import Path

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
(root / 'START-OPORA.cmd').write_bytes(launcher.replace('\n', '\r\n').encode('utf-8'))
print('Prepared START-OPORA.cmd (self-contained, UTF-8, CRLF).')
