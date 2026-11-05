$ErrorActionPreference='Stop'
$repo=$env:OPORA_REPO_ROOT
. ([scriptblock]::Create([IO.File]::ReadAllText((Join-Path $repo 'desktop/windows-install.ps1'))))
$nativeMove=(Get-Command Move-UpdateDirectory).ScriptBlock
$nativeGetProcesses=(Get-Command Get-UpdateProcesses).ScriptBlock
$suite=Join-Path ([IO.Path]::GetTempPath()) ('opora-installer-'+[guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($suite) | Out-Null
$originalLocation=(Get-Location).ProviderPath
$originalCwd=[Environment]::CurrentDirectory
$script:count=0
function Assert-That($Value,[string]$Message){if(!$Value){throw $Message}}
function Check([string]$Name,[scriptblock]$Action){& $Action;$script:count++;Write-Host ('PASS '+$Name)}
function New-Plan([string]$Name){
    $root=Join-Path $suite ("игра ["+$Name+"] % ! & '")
    $directory=Join-Path $root 'Opora-win32-x64'
    $job=Join-Path $root ('.opora-update-'+[guid]::NewGuid().ToString('N'))
    $source=Join-Path $job 'unpacked/Opora-win32-x64'
    [IO.Directory]::CreateDirectory((Join-Path $directory 'resources')) | Out-Null
    [IO.Directory]::CreateDirectory((Join-Path $source 'resources')) | Out-Null
    [IO.File]::WriteAllText((Join-Path $directory 'Opora.exe'),'old exe')
    [IO.File]::WriteAllText((Join-Path $directory 'resources/app.asar'),'old app')
    [IO.File]::WriteAllText((Join-Path $source 'Opora.exe'),'new exe')
    [IO.File]::WriteAllText((Join-Path $source 'resources/app.asar'),'new app')
    [IO.File]::WriteAllText((Join-Path $root 'game.keep'),'game data')
    $hashes=@{}
    foreach($file in @('Opora.exe','resources/app.asar')){$hashes[$file]=(Get-FileHash -LiteralPath (Join-Path $source $file) -Algorithm SHA256).Hash.ToLowerInvariant()}
    $plan=@{schemaVersion=1;job=$job;source=$source;directory=$directory;backup=($directory+'.opora-backup-'+[guid]::NewGuid());version='0.5.1';parentPid=12345;token=('a'*64);hashes=$hashes;resultFile=(Join-Path $root 'update-result.json')}
    Write-UpdateJson (Join-Path $job 'plan.json') $plan
    $script:ParentAlive=$false;$script:NewAlive=$true;$script:Running=@();$script:Mode='ok';$script:MoveCount=0;$script:FailMove=0;$script:Starts=@();$script:Messages=@()
    return Read-UpdatePlan $job
}
function Test-UpdateProcess([int]$ProcessId){if($ProcessId -eq 12345){return $script:ParentAlive};return $script:NewAlive}
function Get-UpdateProcesses([string]$Directory){return $script:Running}
function Move-UpdateDirectory([string]$Source,[string]$Destination){
    $script:MoveCount++
    Assert-That ([Environment]::CurrentDirectory -ne $Source) 'Installer is inside the folder it tries to rename'
    if($script:MoveCount -eq $script:FailMove){throw 'TEST: directory is locked'}
    & $nativeMove $Source $Destination
}
function Start-UpdateApplication($Plan,[bool]$Confirm){
    $script:Starts+=@($Confirm)
    if($Confirm){
        if($script:Mode -eq 'cannot-start'){throw 'TEST: launch denied'}
        if($script:Mode -eq 'died'){$script:NewAlive=$false}
        if($script:Mode -in @('ok','wrong-version')){
            $version=$Plan.version;if($script:Mode -eq 'wrong-version'){$version='0.3.0';$script:NewAlive=$false}
            Write-UpdateJson (Join-Path $Plan.job 'launch-ack.json') @{token=$Plan.token;pid=23456;version=$version;executable=(Join-Path $Plan.directory 'Opora.exe')}
        }
    }
    return [pscustomobject]@{Id=23456}
}
function Show-UpdateFailure([string]$Message){$script:Messages+=@($Message)}
function Read-State($Plan){return Get-Content -LiteralPath $Plan.resultFile -Raw -Encoding UTF8 | ConvertFrom-Json}
function Assert-Old($Plan){Assert-That ([IO.File]::ReadAllText((Join-Path $Plan.directory 'Opora.exe')) -eq 'old exe') 'Old executable lost'}
try {
    Check 'success leaves the app CWD, preserves a backup and records installed only after the new GUI acknowledges' {
        $plan=New-Plan 'success'
        [Environment]::CurrentDirectory=$plan.directory;Set-Location -LiteralPath $plan.directory
        Assert-That (Invoke-OporaUpdate $plan) 'Update failed'
        Assert-That ([Environment]::CurrentDirectory -eq $plan.job) 'Native CWD was not moved out'
        Assert-That ((Read-State $plan).status -eq 'installed') 'No confirmed success'
        Assert-That ([IO.File]::ReadAllText((Join-Path $plan.directory 'resources/app.asar')) -eq 'new app') 'New app not installed'
        Assert-That ([IO.File]::ReadAllText((Join-Path $plan.backup 'Opora.exe')) -eq 'old exe') 'Backup lost'
        Assert-That ([IO.File]::ReadAllText((Join-Path ([IO.Path]::GetDirectoryName($plan.directory)) 'game.keep')) -eq 'game data') 'Game data changed'
        Assert-That ($script:Starts.Count -eq 1 -and $script:Starts[0]) 'Unexpected restart'
    }
    Check 'a parent that never closes preserves the old files and never starts a replacement' {
        $plan=New-Plan 'parent';$script:ParentAlive=$true
        Assert-That (!(Invoke-OporaUpdate $plan -ParentTimeoutSeconds 0)) 'Expected timeout'
        Assert-Old $plan
        Assert-That ($script:MoveCount -eq 0 -and $script:Starts.Count -eq 0) 'Changed a running install'
        Assert-That ($script:Messages.Count -eq 1) 'Parent-exit timeout was silent'
    }
    Check 'MCP blocks readiness, keeping the old GUI open' {
        $plan=New-Plan 'mcp';$script:Running=@([pscustomobject]@{CommandLine='Opora.exe C:\app\resources\app.asar\mcp\server.cjs --root C:\game'})
        Assert-That (!(Invoke-OporaUpdate $plan)) 'MCP should block installation'
        Assert-That (!(Test-Path -LiteralPath (Join-Path $plan.job 'ready.json'))) 'Ready was sent despite MCP'
        Assert-Old $plan
    }
    Check 'a leftover renderer after parent exit prevents replacement and reopens the old app' {
        $plan=New-Plan 'children';$script:Running=@([pscustomobject]@{CommandLine='Opora.exe --type=renderer'})
        Assert-That (!(Invoke-OporaUpdate $plan -ChildrenTimeoutSeconds 0)) 'Expected process lock failure'
        Assert-Old $plan
        Assert-That ($script:MoveCount -eq 0 -and $script:Starts.Count -eq 1 -and !$script:Starts[0]) 'Bad recovery restart'
        Assert-That ($script:Messages.Count -eq 1) 'Failure was silent'
    }
    Check 'a failure moving the prepared folder rolls back without deleting either copy' {
        $plan=New-Plan 'move-fail';$script:FailMove=2
        Assert-That (!(Invoke-OporaUpdate $plan)) 'Expected move failure'
        Assert-Old $plan
        Assert-That ((Read-State $plan).rollback -eq 'restored') 'Old app not restored'
        Assert-That (Test-Path -LiteralPath (Join-Path $plan.source 'Opora.exe')) 'Staged copy was deleted'
    }
    Check 'a launch failure restores and reopens the old version, retaining the failed install' {
        $plan=New-Plan 'launch-fail';$script:Mode='cannot-start'
        Assert-That (!(Invoke-OporaUpdate $plan)) 'Expected start failure'
        Assert-Old $plan
        Assert-That ((Read-State $plan).rollback -eq 'restored') 'Rollback missing'
        Assert-That (Test-Path -LiteralPath (Join-Path $plan.job 'failed-install/Opora.exe')) 'Failed new copy was deleted'
    }
    Check 'a GUI that exits before acknowledgement does not count as an installed update' {
        $plan=New-Plan 'early-exit';$script:Mode='died'
        Assert-That (!(Invoke-OporaUpdate $plan)) 'Expected early exit failure'
        Assert-Old $plan
        Assert-That ((Read-State $plan).status -eq 'failed') 'False success was recorded'
    }
    Check 'an acknowledgement of the old version cannot claim successful installation' {
        $plan=New-Plan 'wrong-version';$script:Mode='wrong-version'
        Assert-That (!(Invoke-OporaUpdate $plan)) 'Accepted the wrong version'
        Assert-Old $plan
    }
    Check 'an alive GUI without acknowledgement is kept intact and reported as needing attention' {
        $plan=New-Plan 'unconfirmed';$script:Mode='no-ack'
        Assert-That (!(Invoke-OporaUpdate $plan -LaunchTimeoutSeconds 0)) 'Expected missing confirmation'
        Assert-That ((Read-State $plan).status -eq 'needs_attention') 'Incorrect result for a running unconfirmed app'
        Assert-That ([IO.File]::ReadAllText((Join-Path $plan.directory 'Opora.exe')) -eq 'new exe') 'Running new GUI was overwritten'
        Assert-That (Test-Path -LiteralPath (Join-Path $plan.backup 'Opora.exe')) 'Backup lost'
    }
    Check 'changed staged files are rejected before readiness' {
        $plan=New-Plan 'hash';[IO.File]::WriteAllText((Join-Path $plan.source 'Opora.exe'),'changed')
        Assert-That (!(Invoke-OporaUpdate $plan)) 'Accepted changed files'
        Assert-That (!(Test-Path -LiteralPath (Join-Path $plan.job 'ready.json'))) 'Quit was authorized for changed files'
        Assert-Old $plan
    }
    Check 'an abandoned helper cannot replace the app even if it starts later' {
        $plan=New-Plan 'cancel';[IO.File]::WriteAllText((Join-Path $plan.job 'cancel'),'cancelled')
        Assert-That (!(Invoke-OporaUpdate $plan)) 'Accepted cancelled install'
        Assert-Old $plan
        Assert-That ($script:MoveCount -eq 0) 'Cancelled install moved files'
    }
    Assert-That ($script:count -eq 11) 'Not all installer scenarios executed'
    Write-Host ('PASS '+$script:count+' installer scenarios; Windows process discovery, GUI creation and acknowledgement are simulated.')
} finally {
    Set-Location -LiteralPath $originalLocation;[Environment]::CurrentDirectory=$originalCwd
    Remove-Item -LiteralPath $suite -Recurse -Force -ErrorAction SilentlyContinue
}
