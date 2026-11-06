const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {configure}=require('../desktop/profile.cjs');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'opora-profile-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const legacy=path.join(dir,'opora');fs.mkdirSync(legacy);const paths={appData:dir,userData:legacy};return {dir,legacy,paths,app:{isPackaged:true,commandLine:{hasSwitch:()=>false},getPath:name=>paths[name],setPath:(name,value)=>{paths[name]=value;}}};}
test('Fresh portable profile imports saved project, excluding legacy locks, runtime pointers and broker state',t=>{
  const f=fixture(t),project=path.join(f.dir,'game');fs.mkdirSync(project);
  fs.writeFileSync(path.join(f.legacy,'preferences.json'),JSON.stringify({lastProject:project}));
  fs.writeFileSync(path.join(f.legacy,'claude-terminal.json'),JSON.stringify({executable:path.join(f.dir,'claude.exe')}));
  for(const name of ['terminal-broker.json','SingletonLock','opora-active.json'])fs.writeFileSync(path.join(f.legacy,name),'broken legacy state');
  configure(f.app);assert.equal(f.paths.userData,path.join(f.dir,'opora-desktop'));
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.paths.userData,'preferences.json'))).lastProject,project);
  assert.deepEqual(fs.readdirSync(f.paths.userData).sort(),['claude-terminal.json','preferences.json']);
  const next=path.join(f.dir,'another-game');fs.writeFileSync(path.join(f.paths.userData,'preferences.json'),JSON.stringify({lastProject:next}));
  f.paths.userData=f.legacy;configure(f.app);assert.equal(JSON.parse(fs.readFileSync(path.join(f.paths.userData,'preferences.json'))).lastProject,next);
  assert.equal(fs.readFileSync(path.join(f.legacy,'terminal-broker.json'),'utf8'),'broken legacy state');
});
test('Invalid old preferences do not prevent a clean launch; custom profiles stay isolated',t=>{
  const f=fixture(t);fs.writeFileSync(path.join(f.legacy,'preferences.json'),'{invalid');
  const result=configure(f.app);assert.equal(result.warnings.length,1);assert.equal(fs.existsSync(path.join(f.paths.userData,'preferences.json')),false);
  f.paths.userData=f.legacy;f.app.commandLine.hasSwitch=()=>true;assert.equal(configure(f.app).migrated,false);assert.equal(f.paths.userData,f.legacy);
});
test('A structurally valid live Claude broker remains available after profile migration',t=>{
  const f=fixture(t),record={schemaVersion:1,pid:process.pid,port:46321,token:'a'.repeat(64)};
  fs.writeFileSync(path.join(f.legacy,'terminal-broker.json'),JSON.stringify(record));configure(f.app);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.paths.userData,'terminal-broker.json'))),record);
});
