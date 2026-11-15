$ErrorActionPreference = 'Stop'
$root = Join-Path ([IO.Path]::GetTempPath()) ('Flesh test Ж '' space ' + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $root | Out-Null
try {
    $target = Join-Path $root 'FleshAndVow.exe'
    $source = Join-Path $root 'candidate.exe'
    $script = Join-Path $root 'installer.ps1'
    [IO.File]::WriteAllText($target, 'old-game')
    [IO.File]::WriteAllText($source, 'MZnew-game')
    Copy-Item (Join-Path $PSScriptRoot '../scripts/install_update.ps1') $script
    $data = @{pid=2147483647;source=$source;target=$target;sha256=(Get-FileHash $source -Algorithm SHA256).Hash;size=(Get-Item $source).Length}
    $payload = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($data | ConvertTo-Json -Compress)))
    & $script -Payload $payload -NoRestart
    if ([IO.File]::ReadAllText($target) -ne 'MZnew-game') { throw 'New version not installed' }
    if ([IO.File]::ReadAllText($target+'.previous') -ne 'old-game') { throw 'Backup not preserved' }
    [IO.File]::WriteAllText($source, 'corrupt')
    Copy-Item (Join-Path $PSScriptRoot '../scripts/install_update.ps1') $script
    & $script -Payload $payload -NoRestart
    if ([IO.File]::ReadAllText($target) -ne 'MZnew-game') { throw 'Corrupt update replaced working game' }
    'WINDOWS INSTALLER CHECKS PASSED: replacement, backup, rejection, Unicode/quoted paths'
} finally { Remove-Item -LiteralPath $root -Recurse -Force }
