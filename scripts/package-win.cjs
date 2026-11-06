const fs=require('node:fs/promises');
const path=require('node:path');
async function main(){
  const {packager}=await import('@electron/packager');
  const root=path.join(__dirname,'..');
  await packager({dir:root,name:'Opora',platform:'win32',arch:'x64',out:path.join(root,'release'),electronVersion:require('../package.json').devDependencies.electron,overwrite:true,prune:true,
    asar:{unpackDir:path.join('node_modules','node-pty')},
    ignore:[/^\/release/,/^\/artifacts/,/^\/test/,/^\/docs/,/^\/scripts/,/^\/distribution/,/^\/updates/,/^\/Opora-App/,/^\/Opora-demo.html/,/^\/START-OPORA.cmd/,/^\/package-lock.json/,/^\/.git/],
    afterPrune:[async({buildPath})=>{
      const module=path.join(buildPath,'node_modules/node-pty');
      // Keep the official N-API Windows prebuild, workers and licences only.
      for(const name of await fs.readdir(module))if(!['lib','prebuilds','package.json','LICENSE','README.md'].includes(name))await fs.rm(path.join(module,name),{recursive:true,force:true});
      for(const name of await fs.readdir(path.join(module,'prebuilds')))if(name!=='win32-x64')await fs.rm(path.join(module,'prebuilds',name),{recursive:true,force:true});
      for(const file of await fs.readdir(path.join(module,'lib'),{recursive:true}))if(/\.(map|test\.js)$/.test(file))await fs.rm(path.join(module,'lib',file),{force:true});
      for(const file of await fs.readdir(path.join(module,'prebuilds'),{recursive:true}))if(/\.pdb$/i.test(file))await fs.rm(path.join(module,'prebuilds',file),{force:true});
    }]
  });
}
main().catch(error=>{console.error(error);process.exitCode=1;});
