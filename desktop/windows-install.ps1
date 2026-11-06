# Copied to a sibling job directory before the GUI closes. PowerShell 5.1+.
$ErrorActionPreference = 'Stop'
function Get-UpdateProcesses([string]$Directory) {
    if ($env:OS -ne 'Windows_NT') { return @() }
    $exe = Join-Path $Directory 'Opora.exe'
    return @(Get-CimInstance Win32_Process -Filter "Name = 'Opora.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.ExecutablePath -and [string]::Equals($_.ExecutablePath,$exe,[StringComparison]::OrdinalIgnoreCase) })
}
function Assert-NoUpdateMcp([string]$Directory) {
    $mcp = @(Get-UpdateProcesses $Directory | Where-Object { $_.CommandLine -match '[\\/]mcp[\\/]server\.cjs(?:"|\s|$)' })
    if ($mcp.Count) { throw 'Закройте терминальные сессии Claude/Codex с MCP Опоры и повторите установку. MCP использует файлы этой версии; принудительно завершать процессы не нужно.' }
}
function Test-UpdateProcess([int]$ProcessId) { return $null -ne (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue) }
function Move-UpdateDirectory([string]$Source,[string]$Destination) { [IO.Directory]::Move($Source,$Destination) }
function Write-UpdateJson([string]$File,$Value) { [IO.File]::WriteAllText($File,($Value | ConvertTo-Json -Depth 5),(New-Object Text.UTF8Encoding $false)) }
function Write-UpdateProgress($Plan,[string]$Phase) {
    $progress=@{token=$Plan.token;pid=$PID;phase=$Phase;recordedAt=(Get-Date -Format o)}
    Write-UpdateJson (Join-Path $Plan.job 'progress.json') $progress
    [IO.File]::AppendAllText((Join-Path $Plan.job 'installer.log'),($progress.recordedAt+' / '+$Phase+[Environment]::NewLine),(New-Object Text.UTF8Encoding $false))
}
function Write-UpdateState($Plan,[string]$Status,[string]$Phase,[string]$ErrorMessage='',[string]$Rollback='') {
    $state=@{status=$Status;phase=$Phase;version=$Plan.version;directory=$Plan.directory;backup=$Plan.backup;job=$Plan.job;log=(Join-Path $Plan.job 'installer.log');error=$ErrorMessage;rollback=$Rollback;recordedAt=(Get-Date -Format o)}
    Write-UpdateJson (Join-Path $Plan.job 'result.json') $state
    Write-UpdateJson $Plan.resultFile $state
    [IO.File]::AppendAllText($state.log,($state.recordedAt+' '+$Status+' / '+$Phase+' '+$ErrorMessage+[Environment]::NewLine),(New-Object Text.UTF8Encoding $false))
}
function Read-UpdatePlan([string]$Job) {
    $plan=Get-Content -LiteralPath (Join-Path $Job 'plan.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $parent=[IO.Path]::GetDirectoryName($plan.directory)
    $backupPrefix=$plan.directory+'.opora-backup-'
    if ($plan.schemaVersion -ne 1 -or $plan.token -notmatch '^[a-f0-9]{64}$' -or $plan.version -notmatch '^\d+\.\d+\.\d+$' -or $plan.parentPid -lt 1 -or ![string]::Equals([IO.Path]::GetFullPath($plan.job),[IO.Path]::GetFullPath($Job),[StringComparison]::OrdinalIgnoreCase) -or ![string]::Equals([IO.Path]::GetDirectoryName($Job),$parent,[StringComparison]::OrdinalIgnoreCase) -or ![string]::Equals([IO.Path]::GetFullPath($plan.source),[IO.Path]::GetFullPath((Join-Path $Job 'unpacked/Opora-win32-x64')),[StringComparison]::OrdinalIgnoreCase) -or !$plan.backup.StartsWith($backupPrefix,[StringComparison]::OrdinalIgnoreCase) -or $plan.backup.Substring($backupPrefix.Length) -notmatch '^[a-f0-9-]{36}$') { throw 'Некорректный план обновления. Приложение не заменено.' }
    return $plan
}
function Start-UpdateApplication($Plan,[bool]$Confirm) {
    $oldJob=$env:OPORA_UPDATE_JOB; $oldToken=$env:OPORA_UPDATE_TOKEN; $oldNode=$env:ELECTRON_RUN_AS_NODE
    try {
        $env:ELECTRON_RUN_AS_NODE=$null
        if ($Confirm) { $env:OPORA_UPDATE_JOB=$Plan.job; $env:OPORA_UPDATE_TOKEN=$Plan.token }
        else { $env:OPORA_UPDATE_JOB=$null; $env:OPORA_UPDATE_TOKEN=$null }
        # Start-Process resolves wildcard characters in FilePath. ProcessStartInfo
        # passes the actual path, including square brackets, directly to the OS.
        $startInfo=New-Object Diagnostics.ProcessStartInfo
        $startInfo.FileName=Join-Path $Plan.directory 'Opora.exe'
        $startInfo.WorkingDirectory=$Plan.directory
        $startInfo.UseShellExecute=$false
        $startInfo.CreateNoWindow=$true
        return [Diagnostics.Process]::Start($startInfo)
    } finally { $env:OPORA_UPDATE_JOB=$oldJob; $env:OPORA_UPDATE_TOKEN=$oldToken; $env:ELECTRON_RUN_AS_NODE=$oldNode }
}
function Show-UpdateFailure([string]$Message) {
    if ($env:OS -ne 'Windows_NT') { return }
    try { Add-Type -AssemblyName System.Windows.Forms; [Windows.Forms.MessageBox]::Show($Message,'Обновление Опоры',0,16) | Out-Null } catch {}
}
function Invoke-OporaUpdate($Plan,[int]$ParentTimeoutSeconds=90,[int]$ChildrenTimeoutSeconds=15,[int]$LaunchTimeoutSeconds=30,[int]$LockTimeoutSeconds=60) {
    $movedOld=$false; $movedNew=$false; $parentClosed=$false; $readySent=$false; $newProcess=$null; $lock=$null
    $phase='Подготовка установщика'
    try {
        # Leave the application directory in both the provider and native process.
        [Environment]::CurrentDirectory=$Plan.job
        Set-Location -LiteralPath $Plan.job
        Write-UpdateProgress $Plan 'Проверка подготовленной копии'
        $lockFile=Join-Path ([IO.Path]::GetDirectoryName($Plan.directory)) ('.'+[IO.Path]::GetFileName($Plan.directory)+'.update.lock')
        $lockDeadline=(Get-Date).AddSeconds($LockTimeoutSeconds);$lockWaitReported=$false
        while (!$lock) {
            if (Test-Path -LiteralPath (Join-Path $Plan.job 'cancel')) { throw 'Приложение отменило установку.' }
            try { $lock=[IO.File]::Open($lockFile,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None) }
            catch [IO.IOException] {
                if ((Get-Date) -ge $lockDeadline) { throw 'Предыдущий установщик ещё использует файлы. Дождитесь его завершения и повторите обновление.' }
                if (!$lockWaitReported) { $phase='Ожидание завершения предыдущего установщика';Write-UpdateProgress $Plan $phase;$lockWaitReported=$true }
                Start-Sleep -Milliseconds 250
            }
        }
        $checkFiles=@('Opora.exe','resources/app.asar')+@($Plan.hashes.PSObject.Properties.Name | Where-Object { $_ -ne 'Opora.exe' -and $_ -ne 'resources/app.asar' })
        foreach ($relative in $checkFiles) {
            if ($relative -ne 'Opora.exe' -and $relative -ne 'resources/app.asar' -and ($relative -notmatch '^resources/app\.asar\.unpacked/[a-zA-Z0-9_./-]+$' -or $relative.Split('/') -contains '..' -or $relative.Split('/') -contains '.' -or $relative.Split('/') -contains '')) { throw 'Некорректный путь файла приложения.' }
            if (Test-Path -LiteralPath (Join-Path $Plan.job 'cancel')) { throw 'Приложение отменило установку.' }
            $phase='Проверка SHA256: '+$relative
            Write-UpdateProgress $Plan $phase
            $expected=$Plan.hashes.PSObject.Properties[$relative].Value
            if ($expected -notmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath (Join-Path $Plan.source $relative) -Algorithm SHA256).Hash -ne $expected) { throw 'Файлы подготовленного обновления изменились. Скачайте обновление заново.' }
        }
        $phase='Проверка открытых MCP-сессий'
        Write-UpdateProgress $Plan $phase
        Assert-NoUpdateMcp $Plan.directory
        if (Test-Path -LiteralPath (Join-Path $Plan.job 'cancel')) { throw 'Запуск установки отменён приложением.' }
        Write-UpdateState $Plan 'waiting' 'Ожидание закрытия Опоры'
        Write-UpdateProgress $Plan 'Установщик готов. Ожидание закрытия Опоры'
        Write-UpdateJson (Join-Path $Plan.job 'ready.json') @{token=$Plan.token;pid=$PID}
        $readySent=$true
        $phase='Ожидание закрытия Опоры'
        $deadline=(Get-Date).AddSeconds($ParentTimeoutSeconds)
        while (Test-UpdateProcess $Plan.parentPid) {
            if (Test-Path -LiteralPath (Join-Path $Plan.job 'cancel')) { throw 'Приложение отменило установку.' }
            if ((Get-Date) -gt $deadline) { throw 'Опора не закрылась вовремя. Прежняя версия сохранена.' }
            Start-Sleep -Milliseconds 200
        }
        $parentClosed=$true
        if (Test-Path -LiteralPath (Join-Path $Plan.job 'cancel')) { throw 'Приложение отменило установку.' }
        $phase='Ожидание освобождения файлов'
        $deadline=(Get-Date).AddSeconds($ChildrenTimeoutSeconds)
        while (@(Get-UpdateProcesses $Plan.directory).Count) {
            if ((Get-Date) -gt $deadline) { throw 'Файлы Опоры ещё используются другим процессом. Закройте её MCP-сессии и повторите обновление.' }
            Start-Sleep -Milliseconds 200
        }
        $phase='Замена приложения'
        Write-UpdateState $Plan 'installing' $phase
        Move-UpdateDirectory $Plan.directory $Plan.backup
        $movedOld=$true
        Move-UpdateDirectory $Plan.source $Plan.directory
        $movedNew=$true
        $phase='Проверка запуска новой версии'
        Write-UpdateState $Plan 'restarting' $phase
        $newProcess=Start-UpdateApplication $Plan $true
        $deadline=(Get-Date).AddSeconds($LaunchTimeoutSeconds)
        $confirmed=$false
        do {
            $ackFile=Join-Path $Plan.job 'launch-ack.json'
            if (Test-Path -LiteralPath $ackFile) {
                try {
                    $ack=Get-Content -LiteralPath $ackFile -Raw -Encoding UTF8 | ConvertFrom-Json
                    $confirmed=$ack.token -eq $Plan.token -and $ack.version -eq $Plan.version -and $ack.pid -eq $newProcess.Id -and [string]::Equals($ack.executable,(Join-Path $Plan.directory 'Opora.exe'),[StringComparison]::OrdinalIgnoreCase)
                } catch {}
            }
            if ($confirmed) { break }
            if (!(Test-UpdateProcess $newProcess.Id)) { throw 'Новая Опора завершилась до подтверждения запуска.' }
            Start-Sleep -Milliseconds 200
        } while ((Get-Date) -lt $deadline)
        if (!$confirmed -or !(Test-UpdateProcess $newProcess.Id)) { throw 'Новая Опора не подтвердила запуск нужной версии. Проверьте её окно и журнал обновления.' }
        Write-UpdateState $Plan 'installed' 'Новая версия запущена'
        return $true
    } catch {
        $message=$_.Exception.Message; $rollback='not_needed'; $status='failed'
        # Keep both copies, and never delete or roll back a running new GUI.
        if ($movedNew -and $newProcess -and (Test-UpdateProcess $newProcess.Id)) {
            $status='needs_attention'; $rollback='blocked'
            $message+=' Приложение ещё работает; его папка оставлена на месте. Резервная копия: '+$Plan.backup
        } elseif ($movedOld) {
            try {
                if ($movedNew) { Move-UpdateDirectory $Plan.directory (Join-Path $Plan.job 'failed-install') }
                Move-UpdateDirectory $Plan.backup $Plan.directory
                $rollback='restored'
            } catch { $rollback='blocked'; $message+=' Не удалось восстановить папку автоматически. Резервная копия: '+$Plan.backup }
        }
        Write-UpdateState $Plan $status $phase $message $rollback
        if ($parentClosed -and $status -ne 'needs_attention' -and $rollback -ne 'blocked') {
            try { Start-UpdateApplication $Plan $false | Out-Null } catch { $message+=' Не удалось открыть прежнюю Опору: '+$_.Exception.Message; Write-UpdateState $Plan $status $phase $message $rollback }
        }
        if ($readySent) { Show-UpdateFailure ($message+[Environment]::NewLine+'Журнал: '+(Join-Path $Plan.job 'installer.log')) }
        return $false
    } finally { if ($lock) { $lock.Dispose() } }
}
# Library only. update-bootstrap.ps1 and the manual recovery bootstrap invoke
# Read-UpdatePlan / Invoke-OporaUpdate explicitly after importing this file.
