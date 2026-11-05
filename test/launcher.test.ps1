$ErrorActionPreference = 'Stop'
$repo = $env:OPORA_REPO_ROOT
$launcherSource = [IO.File]::ReadAllText((Join-Path $repo 'scripts/windows-launcher.ps1'))
. ([scriptblock]::Create($launcherSource))
$sourceStart = (Get-Command Start-Opora).ScriptBlock
Add-Type -AssemblyName System.IO.Compression.FileSystem
$script:Started = @()
$script:FailStart = $false
$script:InstalledVersion = $null
# Exercise real ZIP, hashes, files, exclusive handles and rollback. No GUI is started.
function Start-Opora([string]$AppFolder) {
    if ($script:FailStart) { throw 'TEST: Start-Process denied access' }
    $script:Started += $AppFolder
}
function Get-OporaInstalledVersion([string]$AppFolder) { return $script:InstalledVersion }
function Assert-That($Condition, [string]$Message) { if (!$Condition) { throw $Message } }
function Assert-Throws([scriptblock]$Action, [string]$Pattern) {
    $caught = $null
    try { & $Action } catch { $caught = $_.Exception.Message }
    Assert-That ($caught -and $caught -match $Pattern) ('Expected failure: ' + $Pattern + '; got: ' + $caught)
}
$suite = Join-Path ([IO.Path]::GetTempPath()) ('opora-launcher-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $suite | Out-Null
function Write-Payload([string]$Root, [string]$Zip) {
    $payload = Join-Path $Root 'distribution/windows'
    New-Item -ItemType Directory -Path $payload -Force | Out-Null
    $bytes = [IO.File]::ReadAllBytes($Zip)
    $half = [int][Math]::Floor($bytes.Length / 2)
    $parts = @()
    foreach ($i in 1,2) {
        $name = 'Opora-Windows.zip.part0' + $i
        $file = Join-Path $payload $name
        if ($i -eq 1) { [IO.File]::WriteAllBytes($file, $bytes[0..($half-1)]) }
        else { [IO.File]::WriteAllBytes($file, $bytes[$half..($bytes.Length-1)]) }
        $parts += @{name=$name;size=(Get-Item -LiteralPath $file).Length;sha256=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash}
    }
    $manifest = @{version='0.5.0';size=$bytes.Length;sha256=(Get-FileHash -LiteralPath $Zip -Algorithm SHA256).Hash;parts=$parts}
    $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $payload 'manifest.json') -Encoding UTF8
}
function New-Fixture([string]$Name) {
    $root = Join-Path $suite ('проект [' + $Name + "] % ! & '")
    $source = Join-Path $root 'source'
    $app = Join-Path $source 'Opora-win32-x64'
    New-Item -ItemType Directory -Path (Join-Path $app 'resources') -Force | Out-Null
    [IO.File]::WriteAllText((Join-Path $app 'Opora.exe'),'new executable')
    [IO.File]::WriteAllText((Join-Path $app 'resources/app.asar'),'new application')
    [IO.File]::WriteAllText((Join-Path $root 'game.keep'),'game data')
    $zip = Join-Path $root 'fixture.zip'
    [IO.Compression.ZipFile]::CreateFromDirectory($source,$zip)
    Write-Payload $root $zip
    return $root
}
function Add-OldInstall([string]$Root) {
    $app = Join-Path $Root 'Opora-App/Opora-win32-x64'
    New-Item -ItemType Directory -Path (Join-Path $app 'resources') -Force | Out-Null
    [IO.File]::WriteAllText((Join-Path $app 'Opora.exe'),'old executable')
    [IO.File]::WriteAllText((Join-Path $app 'resources/app.asar'),'old application')
}
function Assert-OldInstall([string]$Root) {
    Assert-That ([IO.File]::ReadAllText((Join-Path $Root 'Opora-App/Opora-win32-x64/Opora.exe')) -eq 'old executable') 'Old executable was changed'
    Assert-That ([IO.File]::ReadAllText((Join-Path $Root 'Opora-App/Opora-win32-x64/resources/app.asar')) -eq 'old application') 'Old application was changed'
}
$script:count = 0
function Check([string]$Name, [scriptblock]$Action) { & $Action; $script:count++; Write-Host ('PASS ' + $Name) }
try {
    Check 'fresh install and paths with Cyrillic, brackets, spaces and shell characters' {
        $root = New-Fixture 'fresh'
        Invoke-OporaLauncher $root
        Assert-That ([IO.File]::ReadAllText((Join-Path $root 'Opora-App/Opora-win32-x64/Opora.exe')) -eq 'new executable') 'Incorrect executable'
        Assert-That (Test-OporaInstall (Join-Path $root 'Opora-App') (Read-OporaManifest (Join-Path $root 'distribution/windows'))) 'Missing valid install receipt'
        Assert-That ([IO.File]::ReadAllText((Join-Path $root 'game.keep')) -eq 'game data') 'Game data changed'
        Assert-That (@(Get-ChildItem -LiteralPath $root -Force | Where-Object Name -like '.opora-install-*').Count -eq 0) 'Staging directory left behind'
    }
    Check 'repeat launch reads an existing locked exe, without reassembly or extraction' {
        $root = New-Fixture 'repeat'
        Invoke-OporaLauncher $root
        $exe = Join-Path $root 'Opora-App/Opora-win32-x64/Opora.exe'
        $handle = [IO.File]::Open($exe,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
        try {
            Get-ChildItem -LiteralPath (Join-Path $root 'distribution/windows') -Filter '*.part*' | Remove-Item
            $before = $script:Started.Count
            Invoke-OporaLauncher $root
            Assert-That ($script:Started.Count -eq $before+1) 'Existing install did not launch'
            Assert-That (@(Get-ChildItem -LiteralPath $root | Where-Object Name -like 'Opora-App.backup-*').Count -eq 0) 'Repeat launch replaced the app'
        } finally { $handle.Dispose() }
    }
    Check 'a corrupt part preserves the previous install and does not launch it as the update' {
        $root = New-Fixture 'corrupt'
        Add-OldInstall $root
        [IO.File]::WriteAllText((Join-Path $root 'distribution/windows/Opora-Windows.zip.part01'),'corrupt')
        Assert-Throws { Invoke-OporaLauncher $root } 'Повреждён файл'
        Assert-OldInstall $root
    }
    Check 'a mismatching whole-archive checksum is rejected before replacement' {
        $root = New-Fixture 'whole-hash'
        Add-OldInstall $root
        $file = Join-Path $root 'distribution/windows/manifest.json'
        $manifest = Get-Content -LiteralPath $file -Raw | ConvertFrom-Json
        $manifest.sha256 = 'f' * 64
        $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $file -Encoding UTF8
        Assert-Throws { Invoke-OporaLauncher $root } 'Контрольная сумма ZIP'
        Assert-OldInstall $root
    }
    Check 'a partial or modified install is repaired, retaining the previous copy' {
        $root = New-Fixture 'repair'
        Invoke-OporaLauncher $root
        [IO.File]::WriteAllText((Join-Path $root 'Opora-App/Opora-win32-x64/resources/app.asar'),'damaged app')
        Invoke-OporaLauncher $root
        $backups = @(Get-ChildItem -LiteralPath $root | Where-Object Name -like 'Opora-App.backup-*')
        Assert-That ($backups.Count -eq 1) 'Backup missing'
        Assert-That ([IO.File]::ReadAllText((Join-Path $backups[0].FullName 'Opora-win32-x64/resources/app.asar')) -eq 'damaged app') 'Previous copy lost'
        Assert-That ([IO.File]::ReadAllText((Join-Path $root 'Opora-App/Opora-win32-x64/resources/app.asar')) -eq 'new application') 'Repair failed'
    }
    Check 'a failed folder replacement restores the old install' {
        $root = New-Fixture 'replace-failure'
        Add-OldInstall $root
        function Move-Item($LiteralPath,$Destination) {
            if ((Split-Path $LiteralPath -Leaf) -eq 'unpacked') { throw 'TEST: replacement is locked' }
            Microsoft.PowerShell.Management\Move-Item -LiteralPath $LiteralPath -Destination $Destination
        }
        try { Assert-Throws { Invoke-OporaLauncher $root } 'Прежняя копия восстановлена' }
        finally { Remove-Item function:Move-Item }
        Assert-OldInstall $root
    }
    Check 'a launch failure rolls back to the previous copy' {
        $root = New-Fixture 'start-failure'
        Add-OldInstall $root
        $script:FailStart = $true
        try { Assert-Throws { Invoke-OporaLauncher $root } 'Прежняя копия восстановлена' }
        finally { $script:FailStart = $false }
        Assert-OldInstall $root
    }
    Check 'a second launcher cannot enter while the first holds its lock' {
        $root = New-Fixture 'concurrent'
        $handle = [IO.File]::Open((Join-Path $root '.opora-launch.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
        try { Assert-Throws { Invoke-OporaLauncher $root } 'другой запускатель' }
        finally { $handle.Dispose() }
        Assert-That (!(Test-Path -LiteralPath (Join-Path $root 'Opora-App'))) 'Concurrent launch wrote an install'
    }
    Check 'a newer in-app update is launched rather than overwritten by an older ZIP' {
        $root = New-Fixture 'newer'
        Add-OldInstall $root
        Get-ChildItem -LiteralPath (Join-Path $root 'distribution/windows') -Filter '*.part*' | Remove-Item
        $script:InstalledVersion = [version]'0.6.0'
        try { Invoke-OporaLauncher $root } finally { $script:InstalledVersion = $null }
        Assert-OldInstall $root
    }
    Check 'a running MCP/app in this exact folder blocks replacement with a useful message' {
        $root = New-Fixture 'running'
        Add-OldInstall $root
        $savedOS = $env:OS
        $env:OS = 'Windows_NT'
        $script:RunningExe = Join-Path $root 'Opora-App/Opora-win32-x64/Opora.exe'
        function Get-CimInstance { [pscustomobject]@{ExecutablePath=$script:RunningExe} }
        try { Assert-Throws { Invoke-OporaLauncher $root } 'MCP Опоры' }
        finally { $env:OS = $savedOS; Remove-Item function:Get-CimInstance }
        Assert-OldInstall $root
    }
    Check 'an archive with a traversal path is rejected without writes outside staging' {
        $root = New-Fixture 'unsafe-zip'
        Add-OldInstall $root
        $file = Join-Path $root 'unsafe.zip'
        $zip = [IO.Compression.ZipFile]::Open($file,[IO.Compression.ZipArchiveMode]::Create)
        try { $entry = $zip.CreateEntry('../outside.txt'); $stream = $entry.Open(); try { $stream.WriteByte(42) } finally { $stream.Dispose() } } finally { $zip.Dispose() }
        Write-Payload $root $file
        Assert-Throws { Invoke-OporaLauncher $root } 'Недопустимый путь'
        Assert-OldInstall $root
        Assert-That (!(Test-Path -LiteralPath (Join-Path $root 'outside.txt'))) 'Unsafe entry escaped staging'
    }
    Check 'an existing GUI is not duplicated; an MCP-only process still allows opening the GUI' {
        $root = New-Fixture 'existing-window'
        $app = Join-Path $root 'Opora-App/Opora-win32-x64'
        $savedOS = $env:OS
        $env:OS = 'Windows_NT'
        $script:RunningExe = Join-Path $app 'Opora.exe'
        $script:WindowHandle = 123
        $script:NativeStarts = 0
        function Get-CimInstance { [pscustomobject]@{ExecutablePath=$script:RunningExe;ProcessId=1234} }
        function Get-Process { [pscustomobject]@{MainWindowHandle=$script:WindowHandle} }
        function Start-Process { $script:NativeStarts++ }
        try {
            & $sourceStart $app
            Assert-That ($script:NativeStarts -eq 0) 'Duplicate GUI was started'
            $script:WindowHandle = 0
            & $sourceStart $app
            Assert-That ($script:NativeStarts -eq 1) 'MCP-only session prevented opening the GUI'
        } finally { $env:OS=$savedOS; Remove-Item function:Get-CimInstance,function:Get-Process,function:Start-Process }
    }
    Check 'the single downloadable CMD contains the exact tested PowerShell source' {
        $bytes = [IO.File]::ReadAllBytes((Join-Path $repo 'START-OPORA.cmd'))
        $text = [Text.Encoding]::UTF8.GetString($bytes)
        Assert-That ($text -notmatch '(?<!\r)\n') 'CMD requires CRLF line endings'
        $marker = '# OPORA_POWERSHELL_START'
        $embedded = $text.Substring($text.LastIndexOf($marker)+$marker.Length).TrimStart("`r","`n")
        Assert-That ($embedded.Replace("`r`n","`n") -eq $launcherSource.Replace("`r`n","`n")) 'Launcher is out of date; run python scripts/prepare-launcher.py'
        $errors = $null
        $tokens = $null
        [Management.Automation.Language.Parser]::ParseInput($embedded,[ref]$tokens,[ref]$errors) | Out-Null
        Assert-That (@($errors).Count -eq 0) 'Embedded PowerShell does not parse'
    }
    Assert-That ($script:count -eq 13) 'Not all launcher scenarios executed'
    Write-Host ('PASS ' + $script:count + ' PowerShell launcher scenarios; GUI/process and PE version checks stubbed.')
} finally {
    Remove-Item -LiteralPath $suite -Recurse -Force -ErrorAction SilentlyContinue
}
