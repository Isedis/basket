const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..');
const executable=process.env.OPORA_PWSH || (process.platform==='win32'?'powershell.exe':'pwsh');
const result=spawnSync(executable,['-NoLogo','-NoProfile','-NonInteractive','-Command','& ([scriptblock]::Create([IO.File]::ReadAllText($env:OPORA_INSTALLER_TEST)))'],{
  stdio:'inherit',env:{...process.env,OPORA_REPO_ROOT:root,OPORA_INSTALLER_TEST:path.join(root,'test/windows-install.test.ps1')}
});
if(result.error){console.error(result.error.message);process.exitCode=1;}else process.exitCode=result.status??1;
