const path=require('node:path');
const fs=require('node:fs');
const os=require('node:os');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..');
const executable=process.env.OPORA_PWSH || (process.platform==='win32'?'powershell.exe':'pwsh');
const result=spawnSync(executable,['-NoLogo','-NoProfile','-NonInteractive','-Command','& ([scriptblock]::Create([IO.File]::ReadAllText($env:OPORA_LAUNCHER_TEST)))'],{
  stdio:'inherit',env:{...process.env,OPORA_REPO_ROOT:root,OPORA_LAUNCHER_TEST:path.join(root,'test/launcher.test.ps1')}
});
if(result.error){console.error('PowerShell is required. Set OPORA_PWSH to its executable. '+result.error.message);process.exitCode=1;}
else {
  process.exitCode=result.status ?? 1;
  if(result.status===0){
    // Execute the exact PowerShell command embedded in the batch entry point.
    const launcher=path.join(root,'START-OPORA.cmd');
    const command=fs.readFileSync(launcher,'utf8').replace(/\r\n/g,'\n').match(/^powershell\.exe .*?-Command "(.+)"$/m)?.[1];
    assert.ok(command,'Missing PowerShell command in START-OPORA.cmd');
    const directory=fs.mkdtempSync(path.join(os.tmpdir(),'opora-launch-entry-'));
    try {
      const failure=spawnSync(executable,['-NoLogo','-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',timeout:20000,env:{...process.env,OPORA_PACKAGE_ROOT:directory,OPORA_LAUNCHER:launcher}});
      assert.equal(failure.status,1,'Missing payload must produce a failed exit status');
      assert.match(fs.readFileSync(path.join(directory,'OPORA-LAUNCH.log'),'utf8'),/\[подготовка\]/);
      console.log('PASS embedded CMD PowerShell entry: failed exit status and diagnostic log.');
    } finally {fs.rmSync(directory,{recursive:true,force:true});}
  }
}
