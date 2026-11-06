$ErrorActionPreference='Stop'
$package=$env:OPORA_PACKAGE_ROOT
if(!$package){$package=$PSScriptRoot}
try {
 Write-Host 'Подготовка обновления Опоры. Не закрывайте окно.'
 $meta=Get-Content -LiteralPath (Join-Path $package 'runtime.json') -Raw -Encoding UTF8 | ConvertFrom-Json
 $directory=$null
 foreach($candidate in @((Join-Path $package 'Opora-App/Opora-win32-x64'),$package)) {if(Test-Path -LiteralPath (Join-Path $candidate 'Opora.exe') -PathType Leaf){$directory=$candidate;break}}
 if($directory){$directory=[IO.Path]::GetFullPath($directory).TrimEnd([char[]]'\/')}
 if(!$directory){throw 'Положите содержимое ZIP рядом с START-OPORA.cmd в папке basket-opora или рядом с Opora.exe.'}
 . ([scriptblock]::Create([IO.File]::ReadAllText((Join-Path $package 'update-helper.ps1'))))
 if(@(Get-UpdateProcesses $directory).Count){throw 'Закройте Опору и её MCP-сессии Claude/Codex, затем повторите запуск.'}
 if((Get-FileHash -LiteralPath (Join-Path $package 'new-app.asar') -Algorithm SHA256).Hash -ne $meta.appSha256){throw 'Повреждён пакет обновления.'}
 Write-Host 'Проверка установленного Electron (загрузка из интернета не требуется)...'
 foreach($file in $meta.files){
  Write-Host ('  Проверка: '+$file.name)
  if($file.name -notmatch '^[a-zA-Z0-9_./-]+$' -or $file.name.StartsWith('/') -or $file.name.Split('/') -contains '..'){throw 'Некорректный путь в пакете.'}
  if((Get-FileHash -LiteralPath (Join-Path $directory $file.name) -Algorithm SHA256).Hash -ne $file.sha256){throw 'Эта версия Electron не подходит. Потребуется полная сборка.'}
 }
 $job=Join-Path ([IO.Path]::GetDirectoryName($directory)) ('.opora-update-'+[guid]::NewGuid().ToString('N'))
 [IO.Directory]::CreateDirectory($job) | Out-Null
 [Environment]::CurrentDirectory=$job;Set-Location -LiteralPath $job
 $source=Join-Path $job 'unpacked/Opora-win32-x64'
 [IO.Directory]::CreateDirectory((Join-Path $source 'resources')) | Out-Null
 Write-Host 'Создание новой копии приложения...'
 foreach($file in $meta.files){$output=Join-Path $source $file.name;[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($output)) | Out-Null;[IO.File]::Copy((Join-Path $directory $file.name),$output);if((Get-FileHash -LiteralPath $output -Algorithm SHA256).Hash -ne $file.sha256){throw 'Ошибка копирования Electron.'}}
 [IO.File]::Copy((Join-Path $directory 'Opora.exe'),(Join-Path $source 'Opora.exe'))
 [IO.File]::Copy((Join-Path $package 'new-app.asar'),(Join-Path $source 'resources/app.asar'))
 foreach($file in $meta.appFiles){
  if($file.name -notmatch '^resources/app\.asar\.unpacked/[a-zA-Z0-9_./-]+$' -or $file.name.Split('/') -contains '..' -or $file.name.Split('/') -contains '.' -or $file.name.Split('/') -contains '' -or $file.sha256 -notmatch '^[a-f0-9]{64}$'){throw 'Некорректный файл приложения.'}
  $inputFile=Join-Path $package $file.name
  if((Get-FileHash -LiteralPath $inputFile -Algorithm SHA256).Hash -ne $file.sha256){throw 'Повреждён файл приложения.'}
  $output=Join-Path $source $file.name;[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($output)) | Out-Null;[IO.File]::Copy($inputFile,$output)
 }
 # Refresh the portable launcher too: it must read the ASAR's actual version.
 $portable=Split-Path (Split-Path $directory -Parent) -Parent
 if(Test-Path -LiteralPath (Join-Path $portable 'START-OPORA.cmd')){[IO.File]::Copy((Join-Path $package 'NEW-START-OPORA.cmd'),(Join-Path $portable 'START-OPORA.cmd'),$true)}
 $hashes=@{};foreach($file in @('Opora.exe','resources/app.asar')){$hashes[$file]=(Get-FileHash -LiteralPath (Join-Path $source $file) -Algorithm SHA256).Hash.ToLowerInvariant()}
 foreach($file in $meta.appFiles){$hashes[$file.name]=$file.sha256}
 if(Get-Process -Id 2147483647 -ErrorAction SilentlyContinue){throw 'Не удалось подготовить запуск.'}
 $result=Join-Path $env:APPDATA 'opora/update-result.json';[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($result)) | Out-Null
 $plan=@{schemaVersion=1;job=$job;source=$source;directory=$directory;backup=($directory+'.opora-backup-'+[guid]::NewGuid());version=$meta.version;parentPid=2147483647;token=([guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N'));hashes=$hashes;resultFile=$result}
 Write-UpdateJson (Join-Path $job 'plan.json') $plan
 $plan=Read-UpdatePlan $job
 if(!(Invoke-OporaUpdate $plan)){
  $failed=Get-Content -LiteralPath (Join-Path $job 'result.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  throw ('Обновление не установлено: '+$failed.error+' Журнал: '+(Join-Path $job 'installer.log'))
 }
 Write-Host ('Готово: Опора '+$meta.version)
} catch {Write-Host $_.Exception.Message -ForegroundColor Red;exit 1}
