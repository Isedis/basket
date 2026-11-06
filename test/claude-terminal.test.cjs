const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {resolveClaude}=require('../desktop/claude-terminal.cjs');
test('Claude lookup ignores relative PATH entries and passes selected paths without a shell',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'opora CLI & игра-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const bin=path.join(root,'bin');await fs.mkdir(bin);const cli=path.join(bin,'claude');await fs.writeFile(cli,'fixture',{mode:0o755});
  await assert.rejects(resolveClaude({home:root,env:{PATH:'.:bin'},platform:'linux'}),/не найден/);
  const command=await resolveClaude({home:root,env:{PATH:'.:'+bin},platform:'linux'});
  assert.equal(command.file,cli);assert.deepEqual(command.args,[]);
  await assert.rejects(resolveClaude({selected:'./claude',home:root,env:{PATH:bin},platform:'linux'}),/недоступен/);
});
test('The npm Windows shim is resolved to Node and cli.js without executing cmd.exe',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),"opora npm & ' "));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const cli=path.join(root,'node_modules/@anthropic-ai/claude-code/cli.js');await fs.mkdir(path.dirname(cli),{recursive:true});await fs.writeFile(cli,'fixture');
  const shim=path.join(root,'claude.cmd');await fs.writeFile(shim,'do not execute this shell');await fs.writeFile(path.join(root,'node.exe'),'fixture');
  const command=await resolveClaude({selected:shim,home:root,env:{PATH:root},platform:'win32'});
  assert.equal(command.file,path.join(root,'node.exe'));assert.deepEqual(command.args,[cli]);assert.equal(command.display,shim);
});
