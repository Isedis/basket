param([Parameter(Mandatory=$true)][string]$Payload, [switch]$NoRestart)
$ErrorActionPreference = 'Stop'
$log = Join-Path ([IO.Path]::GetTempPath()) 'FleshAndVow-update.log'
$backupMade = $false
$replaced = $false
try {
    $data = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Payload)) | ConvertFrom-Json
    $target = [IO.Path]::GetFullPath([string]$data.target)
    $source = [IO.Path]::GetFullPath([string]$data.source)
    $staged = $target + '.update-new'
    $backup = $target + '.previous'
    if ($source -eq $target -or $target -notlike '*.exe') { throw 'Invalid update paths' }
    $process = Get-Process -Id ([int]$data.pid) -ErrorAction SilentlyContinue
    if ($process -and -not $process.WaitForExit(60000)) { throw 'Game did not exit in time' }
    $file = Get-Item -LiteralPath $source
    if ($file.Length -ne [long]$data.size) { throw 'Unexpected download size' }
    if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne [string]$data.sha256) { throw 'Download hash mismatch' }
    Copy-Item -LiteralPath $source -Destination $staged -Force
    if ((Get-FileHash -LiteralPath $staged -Algorithm SHA256).Hash -ne [string]$data.sha256) { throw 'Staged hash mismatch' }
    # Replace on the same filesystem; the previous exe is kept as a local rollback.
    [IO.File]::Replace($staged, $target, $backup, $true)
    $backupMade = $true
    $replaced = $true
    if (-not $NoRestart) { Start-Process -FilePath $target -WorkingDirectory ([IO.Path]::GetDirectoryName($target)) }
    Remove-Item -LiteralPath $source -Force -ErrorAction SilentlyContinue
    'Update installed successfully' | Set-Content -LiteralPath $log
} catch {
    $failure = $_.Exception.Message
    if ($replaced -and $backupMade -and (Test-Path -LiteralPath $backup)) {
        try { Copy-Item -LiteralPath $backup -Destination $target -Force } catch { }
    }
    "Update failed: $failure" | Set-Content -LiteralPath $log
    if (-not $NoRestart) { try {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show("Update failed. The previous game version is preserved.`n$failure`nLog: $log", 'Flesh and Vow update') | Out-Null
        if (Test-Path -LiteralPath $target) { Start-Process -FilePath $target -WorkingDirectory ([IO.Path]::GetDirectoryName($target)) }
    } catch { } }
} finally {
    if ($staged -and (Test-Path -LiteralPath $staged)) { Remove-Item -LiteralPath $staged -Force -ErrorAction SilentlyContinue }
    Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue
}
