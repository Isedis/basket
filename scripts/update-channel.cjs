// Run after committing the release's sources and binary parts.
// The public channel points to an immutable commit, never a moving branch for binaries.
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {validateManifest}=require('../src/updater.cjs');
const root=path.join(__dirname,'..');
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
if(git(['status','--porcelain']))throw new Error('Commit the tested release before updating the channel.');
const release=JSON.parse(fs.readFileSync(path.join(root,'distribution/windows/manifest.json'),'utf8'));
const committed=JSON.parse(git(['show','HEAD:distribution/windows/manifest.json']));
if(release.sha256!==committed.sha256 || release.version!==require('../package.json').version)throw new Error('Release manifest mismatch.');
const manifest=validateManifest({schemaVersion:1,version:release.version,commit:git(['rev-parse','HEAD']),size:release.size,sha256:release.sha256,parts:release.parts,appPatch:JSON.parse(fs.readFileSync(path.join(root,'distribution/app/manifest.json'),'utf8')),notes:'Запуск сцен Godot 4 из рабочего стола, карты и проверки задачи: настоящее игровое окно, автоматический снимок, журнал ошибок, остановка и история. MCP opora_run_scene позволяет агенту самостоятельно проверить сцену; opora_scene_result возвращает результат и PNG. Проверки привязаны к задаче и версии кода, устаревшие результаты отмечаются в контексте. Запуск сохраняется после закрытия Опоры. После обновления перезапустите внешнюю MCP-сессию.'});
fs.mkdirSync(path.join(root,'updates'),{recursive:true});
fs.writeFileSync(path.join(root,'updates/latest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Update channel prepared: ${manifest.version}, immutable commit ${manifest.commit}`);
