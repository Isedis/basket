@echo off
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
# Embedded into START-OPORA.cmd by prepare-launcher.py. Windows PowerShell 5.1+.
$ErrorActionPreference = 'Stop'
$script:OporaCriticalFiles = @('Opora.exe', 'resources/app.asar')

function Read-OporaManifest([string]$Payload) {
    $manifest = Get-Content -LiteralPath (Join-Path $Payload 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($manifest.version -notmatch '^\d+\.\d+\.\d+$' -or $manifest.sha256 -notmatch '^[a-fA-F0-9]{64}$' -or $manifest.size -lt 1 -or $manifest.size -gt 536870912 -or @($manifest.parts).Count -lt 1 -or @($manifest.parts).Count -gt 16) {
        throw 'Некорректный manifest.json. Распакуйте весь ZIP из GitHub в новую папку.'
    }
    $names = @{}
    [long]$size = 0
    foreach ($part in $manifest.parts) {
        if ($part.name -cnotmatch '^Opora-Windows\.zip\.part\d{2}$' -or $names.ContainsKey($part.name) -or $part.sha256 -notmatch '^[a-fA-F0-9]{64}$' -or $part.size -lt 1 -or $part.size -gt 67108864) {
            throw 'Некорректная часть архива в manifest.json.'
        }
        $names[$part.name] = $true
        $size += $part.size
    }
    if ($size -ne $manifest.size) { throw 'Размеры архива в manifest.json не совпадают.' }
    return $manifest
}

function Test-OporaInstall([string]$Destination, $Manifest) {
    try {
        $receipt = Get-Content -LiteralPath (Join-Path $Destination '.opora-install.json') -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($receipt.schemaVersion -ne 1 -or $receipt.version -ne $Manifest.version -or $receipt.archiveSha256 -ne $Manifest.sha256) { return $false }
        foreach ($relative in $script:OporaCriticalFiles) {
            $file = Join-Path (Join-Path $Destination 'Opora-win32-x64') $relative
            $expected = $receipt.files.PSObject.Properties[$relative].Value
            if ($expected -notmatch '^[a-fA-F0-9]{64}$' -or !(Test-Path -LiteralPath $file -PathType Leaf) -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $expected) { return $false }
        }
        return $true
    } catch { return $false }
}

function Get-OporaInstalledVersion([string]$AppFolder) {
    try {
        if (!(Test-Path -LiteralPath (Join-Path $AppFolder 'resources/app.asar') -PathType Leaf)) { return $null }
        $stream=[IO.File]::OpenRead((Join-Path $AppFolder 'resources/app.asar'))
        try {
            $prefix=New-Object byte[] 16
            if($stream.Read($prefix,0,16) -ne 16){return $null}
            $headerSize=[BitConverter]::ToUInt32($prefix,4);$jsonSize=[BitConverter]::ToUInt32($prefix,12)
            if($headerSize -gt 16777216 -or $jsonSize -gt $headerSize-8){return $null}
            $bytes=New-Object byte[] $jsonSize
            if($stream.Read($bytes,0,$jsonSize) -ne $jsonSize){return $null}
            $index=[Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json
            $entry=$index.files.'package.json'
            if($entry.size -gt 1048576 -or $entry.size -lt 1){return $null}
            $stream.Position=8+$headerSize+[long]$entry.offset
            $body=New-Object byte[] $entry.size
            if($stream.Read($body,0,$body.Length) -ne $body.Length){return $null}
            $pkg=[Text.Encoding]::UTF8.GetString($body) | ConvertFrom-Json
            if($pkg.name -eq 'opora' -and $pkg.version -match '^\d+\.\d+\.\d+$'){return [version]$pkg.version}
        } finally {$stream.Dispose()}
    } catch {}
    return $null
}

function Get-OporaProcesses([string]$AppFolder) {
    if ($env:OS -ne 'Windows_NT') { return @() }
    $exe = Join-Path $AppFolder 'Opora.exe'
    return @(Get-CimInstance Win32_Process -Filter "Name = 'Opora.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.ExecutablePath -and [string]::Equals($_.ExecutablePath, $exe, [StringComparison]::OrdinalIgnoreCase) })
}

function Assert-OporaClosed([string]$AppFolder) {
    $running = @(Get-OporaProcesses $AppFolder)
    if ($running.Count) { throw 'Опора ещё работает из этой папки. Закройте её окно и терминальные сессии Claude/Codex с MCP Опоры, затем повторите запуск. Принудительно завершать процессы не нужно.' }
}

function Expand-OporaArchive([string]$Archive, [string]$Destination) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead($Archive)
    try {
        if ($zip.Entries.Count -gt 5000) { throw 'Слишком много файлов в архиве.' }
        [long]$total = 0
        foreach ($entry in $zip.Entries) {
            $parts = ($entry.FullName -replace '\\','/').Split('/')
            if ($parts[0] -ne 'Opora-win32-x64' -or $parts -contains '..' -or $parts -contains '.' -or $entry.FullName.Contains(':') -or (($entry.ExternalAttributes -shr 16) -band 61440) -eq 40960) { throw 'Недопустимый путь в архиве.' }
            $total += $entry.Length
            if ($total -gt 1610612736) { throw 'Слишком большой распакованный архив.' }
        }
    } finally { $zip.Dispose() }
    # Always a fresh, unique directory. Never extract over an installed/running exe.
    # ZipFile treats both paths literally, including brackets in folder names.
    [IO.Compression.ZipFile]::ExtractToDirectory($Archive, $Destination)
}

function Start-Opora([string]$AppFolder) {
    foreach ($running in @(Get-OporaProcesses $AppFolder)) {
        $process = Get-Process -Id $running.ProcessId -ErrorAction SilentlyContinue
        if ($process -and $process.MainWindowHandle -ne 0) {
            Write-Host 'Опора уже открыта. Переключитесь на её окно через панель задач.'
            return
        }
    }
    $start=New-Object Diagnostics.ProcessStartInfo
    $start.FileName=Join-Path $AppFolder 'Opora.exe';$start.WorkingDirectory=$AppFolder
    $start.UseShellExecute=$false;$start.CreateNoWindow=$true
    $start.EnvironmentVariables.Remove('ELECTRON_RUN_AS_NODE')
    $start.EnvironmentVariables['ELECTRON_NO_ATTACH_CONSOLE']='1'
    [Diagnostics.Process]::Start($start) | Out-Null
}

function Invoke-OporaLauncher([string]$PackageRoot) {
    $destination = Join-Path $PackageRoot 'Opora-App'
    $appFolder = Join-Path $destination 'Opora-win32-x64'
    $stage = $null
    $lock = $null
    $backup = $null
    $movedOld = $false
    $movedNew = $false
    $phase = 'подготовка'
    try {
        $starter=Join-Path $PackageRoot 'OPORA-START.cjs'
        if(Test-Path -LiteralPath $starter -PathType Leaf){
            $runtime=Join-Path $appFolder 'Opora.exe'
            if(!(Test-Path -LiteralPath $runtime -PathType Leaf)){$runtime=Join-Path $PackageRoot 'Opora.exe'}
            if(Test-Path -LiteralPath $runtime -PathType Leaf){
                $start=New-Object Diagnostics.ProcessStartInfo
                $start.FileName=$runtime;$start.Arguments='"'+$starter+'"';$start.WorkingDirectory=$PackageRoot
                $start.UseShellExecute=$false;$start.CreateNoWindow=$true
                $start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
                $start.EnvironmentVariables['ELECTRON_RUN_AS_NODE']='1'
                $child=[Diagnostics.Process]::Start($start)
                if(!$child.WaitForExit(30000)){throw 'Запуск текущей версии занял слишком много времени.'}
                if($child.ExitCode -ne 0){throw $child.StandardError.ReadToEnd()}
                return
            }
        }
        try { $lock = [IO.File]::Open((Join-Path $PackageRoot '.opora-launch.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
        catch { throw 'Не удалось начать запуск: уже открыт другой запускатель или нет доступа к этой папке. Дождитесь его завершения либо распакуйте ZIP в новую пользовательскую папку.' }
        $manifest = Read-OporaManifest (Join-Path $PackageRoot 'distribution/windows')
        $phase = 'запуск готовой копии'
        $installedVersion = Get-OporaInstalledVersion $appFolder
        if ((Test-OporaInstall $destination $manifest) -or ($installedVersion -and $installedVersion -gt [version]$manifest.version)) {
            Write-Host 'Приложение уже распаковано. Открываю Опору...'
            Start-Opora $appFolder
            return
        }
        $phase = 'проверка открытой Опоры'
        Assert-OporaClosed $appFolder
        $stage = Join-Path $PackageRoot ('.opora-install-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $stage | Out-Null
        $archive = Join-Path $stage 'Opora-Windows.zip'
        $payload = Join-Path $PackageRoot 'distribution/windows'
        $phase = 'проверка частей архива'
        foreach ($part in $manifest.parts) {
            $file = Join-Path $payload $part.name
            if (!(Test-Path -LiteralPath $file -PathType Leaf)) { throw ('Нет файла ' + $part.name + '. Полностью распакуйте ZIP из GitHub.') }
            if ((Get-Item -LiteralPath $file).Length -ne $part.size -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $part.sha256) { throw ('Повреждён файл ' + $part.name + '. Скачайте ZIP заново.') }
        }
        Write-Host 'Части проверены. Собираю архив...'
        $phase = 'сборка архива'
        $outputStream = [IO.File]::Create($archive)
        try {
            foreach ($part in $manifest.parts) {
                $inputStream = [IO.File]::OpenRead((Join-Path $payload $part.name))
                try { $inputStream.CopyTo($outputStream) } finally { $inputStream.Dispose() }
            }
        } finally { $outputStream.Dispose() }
        if ((Get-Item -LiteralPath $archive).Length -ne $manifest.size -or (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $manifest.sha256) { throw 'Контрольная сумма ZIP не совпала. Установка отменена.' }
        $phase = 'распаковка в отдельную папку'
        Write-Host 'Архив проверен. Распаковываю новую копию...'
        $unpacked = Join-Path $stage 'unpacked'
        Expand-OporaArchive $archive $unpacked
        $files = @{}
        foreach ($relative in $script:OporaCriticalFiles) {
            $file = Join-Path (Join-Path $unpacked 'Opora-win32-x64') $relative
            if (!(Test-Path -LiteralPath $file -PathType Leaf)) { throw ('В распакованном архиве нет ' + $relative + '. Файл мог быть заблокирован защитой Windows; проверьте её журнал.') }
            $files[$relative] = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
        }
        $receipt = @{schemaVersion=1;version=$manifest.version;archiveSha256=$manifest.sha256;files=$files} | ConvertTo-Json -Depth 4
        [IO.File]::WriteAllText((Join-Path $unpacked '.opora-install.json'), $receipt, (New-Object Text.UTF8Encoding $false))
        $phase = 'замена папки приложения'
        Assert-OporaClosed $appFolder
        if (Test-Path -LiteralPath $destination) {
            $backup = $destination + '.backup-' + [guid]::NewGuid().ToString('N')
            Move-Item -LiteralPath $destination -Destination $backup
            $movedOld = $true
        }
        Move-Item -LiteralPath $unpacked -Destination $destination
        $movedNew = $true
        $phase = 'запуск приложения'
        Start-Opora $appFolder
        Write-Host 'Опора запущена. Следующий запуск не требует повторной распаковки.'
        if ($backup) { Write-Host ('Прежняя копия сохранена: ' + $backup) }
    } catch {
        $message = '[' + $phase + '] ' + $_.Exception.Message
        if ($movedOld) {
            try {
                if ($movedNew) { Move-Item -LiteralPath $destination -Destination (Join-Path $stage 'failed-install') }
                Move-Item -LiteralPath $backup -Destination $destination
                $message += ' Прежняя копия восстановлена.'
            } catch { $message += ' Резервная копия сохранена: ' + $backup }
        }
        throw $message
    } finally {
        if ($stage -and (Test-Path -LiteralPath $stage)) { Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue }
        if ($lock) { $lock.Dispose() }
    }
}

if ($MyInvocation.InvocationName -ne '.') {
    try { Invoke-OporaLauncher $env:OPORA_PACKAGE_ROOT }
    catch {
        $message = $_.Exception.Message
        Write-Host ('Ошибка: ' + $message) -ForegroundColor Red
        Write-Host 'Закройте Опору и её MCP-сессии. Если ошибка повторяется, распакуйте ZIP в новую папку и проверьте журнал защиты Windows.'
        try {
            $log = Join-Path $env:OPORA_PACKAGE_ROOT 'OPORA-LAUNCH.log'
            [IO.File]::WriteAllText($log, ((Get-Date -Format o) + [Environment]::NewLine + $message), (New-Object Text.UTF8Encoding $false))
            Write-Host ('Диагностика: ' + $log)
        } catch {}
        exit 1
    }
}
