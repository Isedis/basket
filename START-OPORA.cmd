@echo off
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
