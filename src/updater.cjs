const fs=require('node:fs/promises');
const {createReadStream}=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const SOURCE='https://raw.githubusercontent.com/Isedis/basket';
const VERSION=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const HASH=/^[a-f0-9]{64}$/;
function compareVersions(a,b) {
  if(!VERSION.test(a)||!VERSION.test(b))throw new Error('Неподдерживаемый формат версии.');
  const left=a.split('.').map(Number),right=b.split('.').map(Number);
  if(![...left,...right].every(Number.isSafeInteger))throw new Error('Некорректный номер версии.');
  for(let i=0;i<3;i++)if(left[i]!==right[i])return left[i]>right[i]?1:-1;
  return 0;
}
function validateManifest(m) {
  const invalid=()=>{throw new Error('GitHub вернул некорректное описание обновления.');};
  if(!m || m.schemaVersion!==1 || !VERSION.test(m.version) || !/^[a-f0-9]{40}$/.test(m.commit) || !HASH.test(m.sha256) || !Number.isSafeInteger(m.size) || m.size<1 || m.size>512*1024*1024 || !Array.isArray(m.parts) || m.parts.length<1 || m.parts.length>16)invalid();
  let size=0;
  const names=new Set();
  for(const part of m.parts) {
    if(!part || !/^Opora-Windows\.zip\.part\d{2}$/.test(part.name) || names.has(part.name) || !Number.isSafeInteger(part.size) || part.size<1 || part.size>64*1024*1024 || !HASH.test(part.sha256))invalid();
    names.add(part.name);size+=part.size;
  }
  if(size!==m.size || (m.notes!==undefined && (typeof m.notes!=='string' || m.notes.length>6000)))invalid();
  if(m.appPatch!==undefined){
    if(!m.appPatch || !/^\d+\.\d+\.\d+$/.test(m.appPatch.runtimeVersion))invalid();
    validateManifest({...m.appPatch,schemaVersion:1,version:m.version,commit:m.commit,appPatch:undefined});
  }
  return m;
}

class Updater {
  constructor({currentVersion,directory,fetch=globalThis.fetch,source=SOURCE,onProgress=()=>{},supported=false,runtimeVersion=null}) {
    this.runtimeVersion=runtimeVersion;this.currentVersion=currentVersion;this.directory=directory;this.fetch=fetch;
    this.source=source;this.onProgress=onProgress;this.supported=supported;
    this.manifest=null;this.downloaded=null;this.busy=false;
    this.state={status:'idle',currentVersion,supported};
  }
  info(){return {...this.state,currentVersion:this.currentVersion,supported:this.supported};}
  emit(state){this.state={...this.state,...state};this.onProgress(this.info());}
  async check() {
    if(this.busy)throw new Error('Обновление уже скачивается или проверяется.');
    this.busy=true;this.emit({status:'checking',error:null});
    try {
      const response=await this.fetch(this.source+'/opora/updates/latest.json',{redirect:'error',signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw new Error(`Не удалось получить обновление с GitHub (HTTP ${response.status}).`);
      const chunks=[];let total=0;
      for await(const chunk of response.body) {
        total+=chunk.length;if(total>64*1024)throw new Error('Описание обновления слишком большое.');chunks.push(Buffer.from(chunk));
      }
      const full=validateManifest(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      this.fullManifest=structuredClone(full);
      const patch=full.appPatch?.runtimeVersion===this.runtimeVersion?full.appPatch:null;
      const manifest=patch?{...full,...patch,kind:'app'}:{...full,kind:'full'};
      const available=compareVersions(manifest.version,this.currentVersion)>0;
      this.manifest=available?structuredClone(manifest):null;
      this.emit({status:available?'available':'up-to-date',latestVersion:manifest.version,notes:manifest.notes||'',total:manifest.size,packageKind:manifest.kind,received:0});
      return this.info();
    } catch(error){this.emit({status:'error',error:error.message});throw error;} finally {this.busy=false;}
  }
  useFullPackage(){
    if(!this.fullManifest)throw new Error('Нет описания полной сборки.');
    this.manifest={...structuredClone(this.fullManifest),kind:'full'};
    this.emit({status:'available',packageKind:'full',total:this.manifest.size,received:0});
  }
  async download() {
    if(!this.supported)throw new Error('Установка обновлений доступна в готовой Windows-сборке.');
    if(this.busy)throw new Error('Обновление уже выполняется.');
    if(!this.manifest || compareVersions(this.manifest.version,this.currentVersion)<=0)throw new Error('Сначала проверьте наличие новой версии.');
    const m=structuredClone(this.manifest);
    this.busy=true;
    const directory=path.join(this.directory,m.version+'-'+m.sha256);
    const archive=path.join(directory,'Opora-Windows.zip');
    let handle;
    this.emit({status:'downloading',latestVersion:m.version,received:0,total:m.size,error:null});
    try {
      await fs.mkdir(directory,{recursive:true});
      try {
        const stat=await fs.stat(archive);const hash=crypto.createHash('sha256');
        for await(const data of createReadStream(archive))hash.update(data);
        if(stat.size===m.size && hash.digest('hex')===m.sha256){this.downloaded={archive,directory,version:m.version,sha256:m.sha256,size:m.size,kind:m.kind,runtimeVersion:m.runtimeVersion};this.emit({status:'downloaded',received:m.size,total:m.size});return this.info();}
      }catch{}
      await fs.rm(archive,{force:true});
      handle=await fs.open(archive,'wx');
      const whole=crypto.createHash('sha256');let received=0,lastProgress=0;
      for(const part of m.parts) {
        const response=await this.fetch(`${this.source}/${m.commit}/distribution/${m.kind==='app'?'app':'windows'}/${part.name}`,{redirect:'error',signal:AbortSignal.timeout(10*60*1000)});
        if(!response.ok)throw new Error(`Не удалось скачать ${part.name} (HTTP ${response.status}).`);
        const hash=crypto.createHash('sha256');let partSize=0;
        for await(const chunk of response.body) {
          const data=Buffer.from(chunk);partSize+=data.length;received+=data.length;
          if(partSize>part.size || received>m.size)throw new Error('Размер обновления не совпадает с описанием.');
          hash.update(data);whole.update(data);
          let offset=0;
          while(offset<data.length){const {bytesWritten}=await handle.write(data,offset,data.length-offset);if(!bytesWritten)throw new Error('Не удалось записать обновление.');offset+=bytesWritten;}
          if(Date.now()-lastProgress>200){this.emit({received});lastProgress=Date.now();}
        }
        if(partSize!==part.size || hash.digest('hex')!==part.sha256)throw new Error('Контрольная сумма части обновления не совпала. Установка отменена.');
      }
      if(received!==m.size || whole.digest('hex')!==m.sha256)throw new Error('Контрольная сумма ZIP не совпала. Установка отменена.');
      await handle.close();handle=null;
      this.downloaded={archive,directory,version:m.version,sha256:m.sha256,size:m.size,kind:m.kind,runtimeVersion:m.runtimeVersion};
      this.emit({status:'downloaded',received:m.size,total:m.size});
      return this.info();
    } catch(error) {
      if(handle)await handle.close();
      await fs.rm(directory,{recursive:true,force:true});this.downloaded=null;
      this.emit({status:'error',error:error.message});throw error;
    } finally {this.busy=false;}
  }
  async verifiedDownload() {
    if(this.busy)throw new Error('Дождитесь окончания загрузки.');
    if(!this.downloaded)throw new Error('Сначала скачайте обновление.');
    const stat=await fs.stat(this.downloaded.archive);
    if(stat.size!==this.downloaded.size)throw new Error('Скачанный архив изменился. Скачайте обновление заново.');
    const hash=crypto.createHash('sha256');
    for await(const chunk of createReadStream(this.downloaded.archive))hash.update(chunk);
    if(hash.digest('hex')!==this.downloaded.sha256)throw new Error('Скачанный архив изменился. Установка отменена.');
    return {...this.downloaded};
  }
}
module.exports={Updater,validateManifest,compareVersions,SOURCE};
