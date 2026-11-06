const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');let rawFs=require('node:fs');try{rawFs=require('original-fs');}catch{}
async function readJson(file){return JSON.parse(await fs.readFile(file,'utf8'));}
async function hashFile(file){const hash=crypto.createHash('sha256');for await(const data of rawFs.createReadStream(file))hash.update(data);return hash.digest('hex');}
async function readArchivePackage(file){
  const handle=await rawFs.promises.open(file,'r');
  try {
    const prefix=Buffer.alloc(16);
    if((await handle.read(prefix,0,16,0)).bytesRead!==16)throw new Error('Неполный заголовок ASAR.');
    const headerSize=prefix.readUInt32LE(4),jsonSize=prefix.readUInt32LE(12);
    if(prefix.readUInt32LE(0)!==4 || headerSize<8 || headerSize>16*1024*1024 || prefix.readUInt32LE(8)!==headerSize-4 || jsonSize>headerSize-8)throw new Error('Некорректный заголовок ASAR.');
    const header=Buffer.alloc(jsonSize);
    if((await handle.read(header,0,jsonSize,16)).bytesRead!==jsonSize)throw new Error('Неполный индекс ASAR.');
    const entry=JSON.parse(header.toString('utf8')).files?.['package.json'];
    if(!entry || entry.unpacked || entry.link || !/^\d+$/.test(entry.offset) || !Number.isSafeInteger(entry.size) || entry.size<1 || entry.size>1024*1024)throw new Error('В ASAR нет корректного package.json.');
    const position=8+headerSize+Number(entry.offset);
    if(!Number.isSafeInteger(position) || position+entry.size>(await handle.stat()).size)throw new Error('Данные package.json выходят за пределы ASAR.');
    const body=Buffer.alloc(entry.size);
    if((await handle.read(body,0,entry.size,position)).bytesRead!==entry.size)throw new Error('Неполный package.json в ASAR.');
    return JSON.parse(body.toString('utf8'));
  } finally {await handle.close();}
}
async function appHashes(source){
  const manifest=await readJson(path.join(source,'runtime.json'));
  const hashes={};
  if(!manifest?.appFiles)return hashes;
  if(!Array.isArray(manifest.appFiles)||manifest.appFiles.length>2000)throw new Error('Некорректный список файлов приложения.');
  for(const file of manifest.appFiles){
    if(!file||!/^resources\/app\.asar\.unpacked\/[a-zA-Z0-9_./-]+$/.test(file.name)||file.name.split('/').some(p=>!p||p==='.'||p==='..')||hashes[file.name]||!/^[a-f0-9]{64}$/.test(file.sha256))throw new Error('Некорректный путь файла приложения.');
    const target=path.join(source,file.name);
    // Reject redirected parent directories as well as redirected files.
    let parent=source;for(const part of file.name.split('/')){parent=path.join(parent,part);if((await rawFs.promises.lstat(parent)).isSymbolicLink())throw new Error('Недопустимая ссылка в обновлении.');}
    if(!(await rawFs.promises.stat(target)).isFile()||await hashFile(target)!==file.sha256)throw new Error('Повреждён файл приложения: '+file.name);
    hashes[file.name]=file.sha256;
  }
  return hashes;
}
module.exports={readArchivePackage,appHashes};
