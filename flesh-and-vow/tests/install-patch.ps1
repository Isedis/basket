$ErrorActionPreference = 'Stop'
$root = Join-Path ([IO.Path]::GetTempPath()) ('Flesh patch Ж '' space '+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $root | Out-Null
$installer = Join-Path $PSScriptRoot '../scripts/install_patch.ps1'
$exe = Join-Path $root 'FleshAndVow.exe'
[IO.File]::WriteAllText($exe,'unchanged-engine')
$engineHash = (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash
$folder = Join-Path $root '.flesh-updates'
$active = Join-Path $folder 'active.json'
function Patch([string]$from,[string]$to,[string]$text) {
    $path = Join-Path $root ([guid]::NewGuid().ToString('N')+'.pck')
    [IO.File]::WriteAllText($path,'GDPC'+$text)
    return @{from=$from;to=$to;source=$path;sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant();size=(Get-Item -LiteralPath $path).Length}
}
function Install([string]$current,[string]$version,$packs,[bool]$replace=$false,[bool]$repair=$false) {
    $data = @{pid=2147483647;exe=$exe;runtime='godot-4.6.3-patch-1';base_version='0.4.0';current_version=$current;version=$version;packs=@($packs);replace=$replace;repair=$repair}
    $payload = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($data | ConvertTo-Json -Depth 12 -Compress)))
    & $installer -Payload $payload -NoRestart
}
try {
    $save = Join-Path $root 'run_v1.json'
    [IO.File]::WriteAllText($save,'saved-progress')
    Install '0.4.0' '0.4.1' @((Patch '0.4.0' '0.4.1' 'first'))
    $state = [IO.File]::ReadAllText($active) | ConvertFrom-Json
    if ($state.version -ne '0.4.1' -or @($state.packs).Count -ne 1) { throw 'First patch not activated' }
    Install '0.4.1' '0.4.2' @((Patch '0.4.1' '0.4.2' 'second'))
    $state = [IO.File]::ReadAllText($active) | ConvertFrom-Json
    if ($state.version -ne '0.4.2' -or @($state.packs).Count -ne 2) { throw 'Patch chain not appended' }
    $backup = [IO.File]::ReadAllText((Join-Path $folder 'active.previous.json')) | ConvertFrom-Json
    if ($backup.version -ne '0.4.1') { throw 'Rollback catalog missing' }
    $before = [IO.File]::ReadAllText($active)
    $good = Patch '0.4.2' '0.4.3' 'third'
    $bad = Patch '0.4.3' '0.4.4' 'fourth'
    [IO.File]::WriteAllText($bad.source,'GDPCcorrupted')
    $rejected = $false
    try { Install '0.4.2' '0.4.4' @($good,$bad) } catch { $rejected = $true }
    if (-not $rejected -or [IO.File]::ReadAllText($active) -cne $before) { throw 'Partial download changed active version' }
    Install '0.4.2' '0.4.4' @((Patch '0.4.2' '0.4.4' 'snapshot')) $true
    $state = [IO.File]::ReadAllText($active) | ConvertFrom-Json
    if (@($state.packs).Count -ne 1 -or $state.packs[0].from -ne '0.4.0') { throw 'Snapshot did not compact the chain' }
    $before = [IO.File]::ReadAllText($active)
    $rejected = $false
    try { Install '0.4.2' '0.4.5' @((Patch '0.4.2' '0.4.5' 'stale')) } catch { $rejected = $true }
    if (-not $rejected -or [IO.File]::ReadAllText($active) -cne $before) { throw 'Stale updater overwrote a newer install' }
    $lock = [IO.File]::Open((Join-Path $folder 'install.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
    try {
        $rejected = $false
        try { Install '0.4.4' '0.4.5' @((Patch '0.4.4' '0.4.5' 'concurrent')) } catch { $rejected = $true }
        if (-not $rejected) { throw 'Concurrent installer lock ignored' }
    } finally { $lock.Dispose() }
    [IO.File]::WriteAllText($active,'broken json')
    Install '0.4.0' '0.4.5' @((Patch '0.4.0' '0.4.5' 'repair snapshot')) $true $true
    $state = [IO.File]::ReadAllText($active) | ConvertFrom-Json
    if ($state.version -ne '0.4.5' -or @($state.packs).Count -ne 1) { throw 'Corrupt catalog recovery failed' }
    if ((Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash -cne $engineHash) { throw 'Content update rewrote engine' }
    if ([IO.File]::ReadAllText($save) -cne 'saved-progress') { throw 'Save file changed' }
    'PATCH INSTALLER CHECKS PASSED: atomic chain, rollback, corruption, snapshot, stale install, lock, repair, engine unchanged, saves, Unicode paths'
} finally { Remove-Item -LiteralPath $root -Recurse -Force }
