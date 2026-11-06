# Explicit -File entry point. Keep this file ASCII for Windows PowerShell 5.1.
$ErrorActionPreference='Stop'
$job=$PSScriptRoot
$plan=$null
$stage='read-plan'
try {
    $plan=([IO.File]::ReadAllText((Join-Path $job 'plan.json')) | ConvertFrom-Json)
    $started=@{token=$plan.token;pid=$PID;powerShellVersion=$PSVersionTable.PSVersion.ToString();stage='bootstrap';recordedAt=(Get-Date -Format o)}
    [IO.File]::WriteAllText((Join-Path $job 'bootstrap-started.json'),($started | ConvertTo-Json),(New-Object Text.UTF8Encoding $false))
    if(Test-Path -LiteralPath (Join-Path $job 'cancel')){throw 'Update was cancelled before the bootstrap started.'}
    $stage='load-helper'
    # Import the library, then invoke its entry point explicitly. Do not infer
    # execution from MyInvocation or depend on -Command/stdin console handling.
    . ([scriptblock]::Create([IO.File]::ReadAllText((Join-Path $job 'installer.ps1'))))
    $stage='validate-plan'
    $plan=Read-UpdatePlan $job
    $stage='install'
    if(Invoke-OporaUpdate $plan){exit 0}
    exit 1
} catch {
    $failure=@{token=$plan.token;pid=$PID;stage=$stage;error=$_.Exception.Message;recordedAt=(Get-Date -Format o)}
    try{[IO.File]::WriteAllText((Join-Path $job 'bootstrap-error.json'),($failure | ConvertTo-Json),(New-Object Text.UTF8Encoding $false))}catch{}
    exit 2
}
