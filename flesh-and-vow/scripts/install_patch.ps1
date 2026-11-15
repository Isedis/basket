param([Parameter(Mandatory=$true)][string]$Payload, [switch]$NoRestart)
$ErrorActionPreference = 'Stop'
$log = Join-Path ([IO.Path]::GetTempPath()) 'FleshAndVow-update.log'
$committed = $false
$hadCatalog = $false
$lock = $null
$temporary = @()
function Valid-Hash([string]$value) { return $value -cmatch '^[0-9a-f]{64}$' }
function Verify-File($path,$entry) {
    if (-not (Valid-Hash ([string]$entry.sha256))) { throw 'Invalid hash' }
    if (-not (Test-Path -LiteralPath $path)) { throw 'Missing patch' }
    if ((Get-Item -LiteralPath $path).Length -ne [long]$entry.size) { throw 'Unexpected patch size' }
    if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne [string]$entry.sha256) { throw 'Patch hash mismatch' }
    $stream = [IO.File]::OpenRead($path)
    try { $magic = New-Object byte[] 4; if ($stream.Read($magic,0,4) -ne 4 -or [Text.Encoding]::ASCII.GetString($magic) -cne 'GDPC') { throw 'Invalid pack header' } }
    finally { $stream.Dispose() }
}
try {
    $data = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Payload)) | ConvertFrom-Json
    $exe = [IO.Path]::GetFullPath([string]$data.exe)
    if ($exe -notlike '*.exe' -or $data.runtime -cne 'godot-4.6.3-patch-1') { throw 'Incompatible runtime' }
    if ($data.base_version -notmatch '^\d+\.\d+\.\d+$' -or $data.current_version -notmatch '^\d+\.\d+\.\d+$' -or $data.version -notmatch '^\d+\.\d+\.\d+$') { throw 'Invalid version' }
    if ([version]$data.version -le [version]$data.current_version) { throw 'Downgrade refused' }
    $folder = Join-Path ([IO.Path]::GetDirectoryName($exe)) '.flesh-updates'
    New-Item -ItemType Directory -Path $folder -Force | Out-Null
    $lock = [IO.File]::Open((Join-Path $folder 'install.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
    $active = Join-Path $folder 'active.json'
    $backup = Join-Path $folder 'active.previous.json'
    $hadCatalog = Test-Path -LiteralPath $active
    $oldText = if ($hadCatalog) { [IO.File]::ReadAllText($active) } else { '' }
    $existing = $null
    if ($hadCatalog) {
        try { $existing = $oldText | ConvertFrom-Json }
        catch { if (-not $data.repair) { throw } }
    }
    # A newly installed full exe has a new embedded base and ignores older overlay chains.
    if ($existing -and $existing.base_version -cne $data.base_version) { $existing = $null }
    $current = if ($existing) { [string]$existing.version } else { [string]$data.base_version }
    if ($data.repair) {
        if (-not $data.replace) { throw 'Recovery requires a complete content snapshot' }
        if ($existing -and [version]$current -gt [version]$data.current_version) {
            $validInstalled = $true
            try {
                foreach ($entry in @($existing.packs)) {
                    if ($entry.file -cne (([string]$entry.sha256)+'.pck')) { throw 'Invalid filename' }
                    Verify-File (Join-Path $folder ([string]$entry.file)) $entry
                }
            } catch { $validInstalled = $false }
            if ($validInstalled) { throw 'A newer valid installation already exists' }
        }
        $current = [string]$data.current_version
    }
    if ($current -cne $data.current_version) { throw 'Another installation changed the version; check again' }
    $process = Get-Process -Id ([int]$data.pid) -ErrorAction SilentlyContinue
    if ($process -and -not $process.WaitForExit(60000)) { throw 'Game did not exit in time' }
    $entries = @()
    if (-not $data.replace -and $existing) {
        foreach ($entry in @($existing.packs)) {
            if ($entry.file -cne (([string]$entry.sha256)+'.pck')) { throw 'Invalid installed filename' }
            Verify-File (Join-Path $folder ([string]$entry.file)) $entry
            $entries += $entry
        }
    }
    $previous = [string]$data.current_version
    if (@($data.packs).Count -eq 0) { throw 'Empty patch list' }
    foreach ($entry in @($data.packs)) {
        if ($entry.from -cne $previous -or [version]$entry.to -le [version]$previous) { throw 'Broken patch chain' }
        $source = [IO.Path]::GetFullPath([string]$entry.source)
        Verify-File $source $entry
        $name = ([string]$entry.sha256)+'.pck'
        $destination = Join-Path $folder $name
        if (Test-Path -LiteralPath $destination) { Verify-File $destination $entry }
        else {
            $staged = Join-Path $folder ($name+'.pending-'+[guid]::NewGuid().ToString('N'))
            $temporary += $staged
            Copy-Item -LiteralPath $source -Destination $staged
            Verify-File $staged $entry
            [IO.File]::Move($staged,$destination)
        }
        $from = [string]$entry.from
        if ($data.replace -and $entries.Count -eq 0) { $from = [string]$data.base_version }
        $entries += @{file=$name;sha256=[string]$entry.sha256;size=[long]$entry.size;from=$from;to=[string]$entry.to}
        $previous = [string]$entry.to
    }
    if ($previous -cne $data.version -or $entries.Count -gt 128) { throw 'Incomplete patch chain' }
    $catalog = @{runtime=[string]$data.runtime;base_version=[string]$data.base_version;version=[string]$data.version;packs=@($entries)}
    $stagedCatalog = Join-Path $folder ('active.new-'+[guid]::NewGuid().ToString('N')+'.json')
    $temporary += $stagedCatalog
    $bytes = (New-Object Text.UTF8Encoding($false)).GetBytes(($catalog | ConvertTo-Json -Depth 12 -Compress))
    $writer = [IO.File]::Open($stagedCatalog,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try { $writer.Write($bytes,0,$bytes.Length); $writer.Flush($true) } finally { $writer.Dispose() }
    # One atomic pointer switch activates all packs together. The engine is never rewritten.
    if ($hadCatalog) { [IO.File]::Replace($stagedCatalog,$active,$backup,$true) }
    else { [IO.File]::Move($stagedCatalog,$active) }
    $committed = $true
    if (-not $NoRestart) { Start-Process -FilePath $exe -WorkingDirectory ([IO.Path]::GetDirectoryName($exe)) }
    'Content patch installed successfully' | Set-Content -LiteralPath $log
    foreach ($entry in @($data.packs)) { Remove-Item -LiteralPath ([string]$entry.source) -Force -ErrorAction SilentlyContinue }
} catch {
    $failure = $_.Exception.Message
    if ($committed) {
        try {
            if ($hadCatalog) {
                $restore = Join-Path $folder ('restore-'+[guid]::NewGuid().ToString('N')+'.json')
                [IO.File]::WriteAllText($restore,$oldText,(New-Object Text.UTF8Encoding($false)))
                [IO.File]::Replace($restore,$active,$null,$true)
            } else { Remove-Item -LiteralPath $active -Force }
        } catch { }
    }
    "Patch failed: $failure" | Set-Content -LiteralPath $log
    if ($NoRestart) { throw }
    try {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show("Update failed. The previous game version is preserved.`n$failure`nLog: $log", 'Flesh and Vow update') | Out-Null
        Start-Process -FilePath $exe -WorkingDirectory ([IO.Path]::GetDirectoryName($exe))
    } catch { }
} finally {
    foreach ($path in $temporary) { Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue }
    if ($lock) { $lock.Dispose() }
    if (-not $NoRestart) { Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue }
}
