// Read-only Godot inventory. Static references are evidence, not runtime reachability.
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {assertSafePath}=require('./core.cjs');
const SKIP=new Set(['node_modules','vendor','build','dist','release','distribution']);
const TEXT=new Set(['.godot','.tscn','.tres','.gd','.cs','.gdshader','.shader','.glsl','.uid']);
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function kindOf(file){const ext=path.posix.extname(file).toLowerCase();return file==='project.godot'?'project':['.tscn','.scn'].includes(ext)?'scene':['.gd','.cs'].includes(ext)?'script':['.tres','.res'].includes(ext)?'resource':['.gdshader','.shader','.glsl'].includes(ext)?'shader':['.png','.jpg','.jpeg','.webp','.svg','.ttf','.otf','.wav','.ogg','.mp3','.glb','.gltf','.obj'].includes(ext)?'asset':'other';}
function safeFile(file){if(typeof file!=='string'||!file||file.length>2048||file.includes('\\')||file.includes('\0')||file.includes(':')||file.startsWith('/')||file.split('/').some(p=>!p||p==='.'||p==='..'))throw new Error('Нужен относительный путь файла внутри проекта.');return file;}
function normalizeReference(source,value){const raw=value.startsWith('res://')?value.slice(6):path.posix.join(path.posix.dirname(source),value);const normalized=path.posix.normalize(raw);try{return safeFile(normalized);}catch{return null;}}
function literals(text,csharp=false){
  const tokens=[];const mask=text.split('');let line=1;
  for(let i=0;i<text.length;){
    if(text[i]==='\n'){line++;i++;continue;}
    if((!csharp&&text[i]==='#')||(csharp&&text.slice(i,i+2)==='//')){while(i<text.length&&text[i]!=='\n')mask[i++]=' ';continue;}
    if(csharp&&text.slice(i,i+2)==='/*'){mask[i++]=' ';mask[i++]=' ';while(i<text.length&&text.slice(i,i+2)!=='*/'){if(text[i]==='\n')line++;else mask[i]=' ';i++;}if(i<text.length){mask[i++]=' ';mask[i++]=' ';}continue;}
    if(text[i]!=="'"&&text[i]!=='"'){i++;continue;}
    const start=i,atLine=line,quote=text[i],triple=text.slice(i,i+3)===quote.repeat(3);let value='',closed=false;
    const width=triple?3:1;for(let n=0;n<width;n++)mask[i++]=' ';
    while(i<text.length){
      if(text.slice(i,i+width)===quote.repeat(width)){for(let n=0;n<width;n++)mask[i++]=' ';closed=true;break;}
      if(text[i]==='\n'){line++;mask[i]='\n';value+='\n';i++;continue;}
      if(text[i]==='\\'&&i+1<text.length){mask[i++]=' ';const ch=text[i];value+=ch==='n'?'\n':ch;mask[i]=ch==='\n'?'\n':' ';if(ch==='\n')line++;i++;continue;}
      value+=text[i];mask[i++]=' ';
    }
    if(!triple&&closed)tokens.push({value,start,end:i,line:atLine});
  }
  return {tokens,mask:mask.join('')};
}
function parse(file,text,maxRefs=1024){
  if(file.endsWith('.uid'))return {uid:text.trim().match(/^uid:\/\/[a-z0-9]+$/)?.[0],refs:[],dynamic:0};
  const {tokens,mask}=literals(text,file.endsWith('.cs'));const refs=[];
  for(const token of tokens){
    const prefix=mask.slice(Math.max(0,token.start-100),token.start);
    const value=token.value;
    if(/\b(?:preload|load)\s*\(\s*$/.test(prefix)&&!/^\s*\)/.test(text.slice(token.end)))continue;
    if(value.startsWith('uid://')){
      const start=text.lastIndexOf('\n',token.start)+1,end=text.indexOf('\n',token.start);
      const row=text.slice(start,end<0?undefined:end);
      if(/\bpath\s*=/.test(row)||/^\[(?:gd_scene|gd_resource)\b/.test(row))continue; // Definition, or ext_resource with authoritative path.
    }
    if(!/^(res|uid):\/\//.test(value)&&!/(?:\bextends\s+|\b(?:preload|load)\s*\(\s*)$/.test(prefix))continue;
    const relation=/\bextends\s*$/.test(prefix)?'extends':/\bpreload\s*\(\s*$/.test(prefix)?'preload':/\bload\s*\(\s*$/.test(prefix)?'load':file==='project.godot'&&/run\/main_scene\s*=\s*$/.test(prefix)?'main':file==='project.godot'?'setting':file.endsWith('.gd')||file.endsWith('.cs')?'literal':'resource';
    refs.push({value:value.replace(/^\*(?=res:\/\/)/,''),line:token.line,kind:relation});
  }
  // Autoload strings start with '*' rather than res://.
  if(file==='project.godot')for(const token of tokens)if(token.value.startsWith('*res://'))refs.push({value:token.value.slice(1),line:token.line,kind:'autoload'});
  const calls=[...mask.matchAll(/\b(?:load|preload|change_scene_to_file|load_threaded_request)\s*\(/g)];
  const dynamic=calls.filter(m=>{const after=m.index+m[0].length;const token=tokens.find(t=>t.start>=after&&mask.slice(after,t.start).trim()==='');return !token||!/^\s*\)/.test(text.slice(token.end));}).length;
  const starts=[0];for(let i=0;i<mask.length;i++)if(mask[i]==='\n')starts.push(i+1);
  const lineAt=offset=>{let lo=0,hi=starts.length;while(lo+1<hi){const mid=(lo+hi)>>1;if(starts[mid]<=offset)lo=mid;else hi=mid;}return lo+1;};
  const names=pattern=>{const values=[];let total=0;for(const m of mask.matchAll(pattern)){total++;if(values.length<1024)values.push({name:m[1].slice(0,160),line:lineAt(m.index)});}return {values,total};};
  const functions=names(/^[ \t]*(?:static[ \t]+)?func[ \t]+(\w+)/gm),signals=names(/^[ \t]*signal[ \t]+(\w+)/gm);
  const classRefs=new Map();for(const m of mask.matchAll(/\b([A-Za-z_]\w*)\s*\.\s*[A-Za-z_]\w*|(?:\bas\s+|\bis\s+|:\s*)([A-Za-z_]\w*)/g)){const name=m[1]||m[2];if(!classRefs.has(name)&&classRefs.size<1024)classRefs.set(name,{name,line:lineAt(m.index)});}

  const inherited=mask.match(/^[ \t]*extends[ \t]+(\w+)/m);
  return {refs:refs.slice(0,maxRefs),refs_limited:refs.length>maxRefs,dynamic,extends_class:inherited?.[1]||null,extends_line:inherited?mask.slice(0,inherited.index).split('\n').length:null,class_name:mask.match(/\bclass_name\s+(\w+)/)?.[1]?.slice(0,160)||null,functions:functions.values,signals:signals.values,functions_total:functions.total,signals_total:signals.total,symbols_limited:functions.total>1024||signals.total>1024,class_refs:[...classRefs.values()],uid:text.match(/^\[(?:gd_scene|gd_resource)\b[^\n]*\buid="(uid:\/\/[a-z0-9]+)"/)?.[1]||null};
}
class ProjectMap {
  constructor(root,limits={}){this.root=root;this.limits={files:6000,entries:18000,bytes:32*1024*1024,fileBytes:2*1024*1024,edges:24000,...limits};this.cache=new Map();this.pending=null;}
  scan(){if(this.pending)return this.pending;this.pending=this.build().finally(()=>{this.pending=null;});return this.pending;}
  async build(){
    const root=await fs.realpath(this.root);await assertSafePath(root,'project.godot');await fs.access(path.join(root,'project.godot'));
    const nodes=[],parsed=new Map(),seen=new Set(),warnings=[];let entries=0,bytes=0,read=0,reused=0,skipped=0,limited=false,totalRefs=0;
    const warn=message=>{if(warnings.length<30)warnings.push(message);};
    const walk=async(relative='',depth=0)=>{
      if(depth>40){limited=true;return;}
      let listing;try{listing=await fs.readdir(path.join(root,relative),{withFileTypes:true});}catch{warn('Недоступна папка: '+relative);return;}
      listing.sort((a,b)=>(a.name==='project.godot'?-1:b.name==='project.godot'?1:a.name.localeCompare(b.name,'en')));
      for(const entry of listing){
        if(++entries>this.limits.entries||nodes.length>=this.limits.files){limited=true;return;}
        if(entry.isSymbolicLink()){skipped++;continue;}
        if(entry.name.startsWith('.')||SKIP.has(entry.name.toLowerCase()))continue;
        const file=relative?relative+'/'+entry.name:entry.name;
        if(file.length>2048){skipped++;continue;}
        if(entry.isDirectory()){await walk(file,depth+1);continue;}if(!entry.isFile())continue;
        try{
          await assertSafePath(root,file);const stat=await fs.lstat(path.join(root,file),{bigint:true});if(!stat.isFile()){skipped++;continue;}
          const signature=[stat.size,stat.mtimeNs,stat.ctimeNs].join(':');const node={file,kind:kindOf(file),size:Number(stat.size),exists:true};nodes.push(node);seen.add(file);
          if(!TEXT.has(path.posix.extname(file).toLowerCase())){node.fingerprint=signature;continue;}
          if(stat.size>BigInt(this.limits.fileBytes)||bytes+Number(stat.size)>this.limits.bytes){node.unparsed=true;skipped++;limited=true;continue;}
          bytes+=Number(stat.size);const cached=this.cache.get(file),maxRefs=Math.min(1024,Math.max(0,this.limits.edges-totalRefs));
          let item;
          if(cached?.signature===signature&&(!cached.parsed.refs_limited||cached.maxRefs===maxRefs)&&cached.parsed.refs.length<=maxRefs){item=cached;reused++;}
          else {
            // Bounded read even if another process grows the file after lstat.
            const handle=await fs.open(path.join(root,file),'r');let data;try{const buffer=Buffer.alloc(Number(stat.size)+1);const result=await handle.read(buffer,0,buffer.length,0);data=buffer.subarray(0,result.bytesRead);}finally{await handle.close();}
            if(data.length!==Number(stat.size)){node.unparsed=true;warn('Файл изменялся во время чтения: '+file);continue;}
            item={signature,maxRefs,hash:hash(data),parsed:parse(file,data.toString('utf8'),maxRefs)};this.cache.set(file,item);read++;
          }
          node.fingerprint=item.hash;parsed.set(file,item.parsed);node.dynamic=item.parsed.dynamic||0;totalRefs+=item.parsed.refs.length;if(item.parsed.refs_limited){node.references_limited=true;limited=true;}
          if(node.kind==='script'){node.class_name=item.parsed.class_name;node.functions=item.parsed.functions;node.signals=item.parsed.signals;node.functions_total=item.parsed.functions_total;node.signals_total=item.parsed.signals_total;node.symbols_limited=item.parsed.symbols_limited;if(node.symbols_limited)limited=true;}
        }catch{warn('Не удалось прочитать: '+file);}
      }
    };
    await walk();for(const file of this.cache.keys())if(!seen.has(file))this.cache.delete(file);
    const byFile=new Map(nodes.map(n=>[n.file,n]));const uids=new Map();
    for(const [file,item] of parsed)if(item.uid){const target=file.endsWith('.uid')?file.slice(0,-4):file;if(byFile.has(target)){if(uids.has(item.uid)&&uids.get(item.uid)!==target)uids.set(item.uid,null);else uids.set(item.uid,target);}}
    const classes=new Map();for(const [file,item] of parsed)if(item.class_name){if(classes.has(item.class_name))classes.set(item.class_name,null);else classes.set(item.class_name,file);}
    const edges=[],dedupe=new Set(),unresolved=[],targets=new Map();let main=null;
    for(const [file,item] of parsed)for(const ref of [...item.refs,...(classes.get(item.extends_class)?[{value:'res://'+classes.get(item.extends_class),line:item.extends_line,kind:'extends'}]:[]),...(item.class_refs||[]).filter(ref=>classes.get(ref.name)&&classes.get(ref.name)!==file).map(ref=>({value:'res://'+classes.get(ref.name),line:ref.line,kind:'class'}))]){
      if(edges.length>=this.limits.edges){limited=true;break;}
      const target=ref.value.startsWith('uid://')?uids.get(ref.value):normalizeReference(file,ref.value);
      if(!target){if(unresolved.length<100)unresolved.push({file,line:ref.line,value:ref.value});continue;}
      const key=[file,target,ref.line,ref.kind].join('\0');if(dedupe.has(key))continue;dedupe.add(key);
      if(!byFile.has(target)&&!targets.has(target)){
        try{await assertSafePath(root,target);const stat=await fs.lstat(path.join(root,target));targets.set(target,stat.isFile()?'unindexed':'unknown');}
        catch(error){targets.set(target,error.code==='ENOENT'?'missing':'unknown');}
      }
      edges.push({from:file,to:target,line:ref.line,kind:ref.kind,missing:targets.get(target)==='missing',unindexed:!byFile.has(target)});if(ref.kind==='main')main=target;
    }
    for(const edge of edges){const from=byFile.get(edge.from),to=byFile.get(edge.to);from.outgoing=(from.outgoing||0)+1;if(to)to.incoming=(to.incoming||0)+1;}
    const dynamic=nodes.reduce((sum,n)=>sum+(n.dynamic||0),0),missing=edges.filter(e=>e.missing).length;
    if(limited)warn('Достигнут лимит сканирования. Карта неполная; отсутствие связи не доказывает, что файл не используется.');
    if(dynamic)warn('Есть динамические загрузки: их цели могут зависеть от выполнения игры.');
    if(unresolved.length)warn('Некоторые UID или пути не удалось разрешить по доступным файлам.');
    const revision=hash(JSON.stringify({nodes,edges,unresolved,limited,warnings}));
    return {map_revision:revision,indexed_at:new Date().toISOString(),nodes,edges,unresolved,main,summary:{files:nodes.length,scenes:nodes.filter(n=>n.kind==='scene').length,scripts:nodes.filter(n=>n.kind==='script').length,resources:nodes.filter(n=>n.kind==='resource').length,links:edges.length,missing,dynamic,unresolved:unresolved.length,limited,skipped,read,reused},warnings,limits:this.limits};
  }
}
function projectView(map,options={}){
  const {file,query='',kind='all',offset=0,limit=60,symbol_offset=0,symbol_limit=32,symbol_query=''}=options;
  if(!Number.isInteger(symbol_offset)||symbol_offset<0||!Number.isInteger(symbol_limit)||symbol_limit<1||symbol_limit>100||typeof symbol_query!=='string'||symbol_query.length>200)throw new Error('Некорректная страница символов.');
  if(!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>100||typeof query!=='string'||query.length>200||!['all','scene','script','resource','shader','asset','project','other','unlinked'].includes(kind))throw new Error('Некорректный фильтр карты.');
  const base={map_revision:map.map_revision,indexed_at:map.indexed_at,main:map.main,summary:map.summary,warnings:map.warnings,limits:map.limits,offset,limit,evidence:'Static references found in files, not proof of runtime use. No incoming links does not mean unused. Dynamic loading, generated paths and binary scene contents may be unknown.'};
  if(file){
    safeFile(file);const selected=map.nodes.find(n=>n.file===file);const incoming=map.edges.filter(e=>e.to===file),outgoing=map.edges.filter(e=>e.from===file);
    if(!selected&&!incoming.length)throw new Error('Файл не найден в текущей карте. Обновите карту или проверьте путь.');
    const lookup=new Map(map.nodes.map(n=>[n.file,n]));const enrich=(edge,direction)=>({...edge,node:compactNode(lookup.get(direction==='in'?edge.from:edge.to)||{file:edge.to,kind:kindOf(edge.to),exists:edge.missing?false:null})});
    const node=selected||{file,kind:kindOf(file),exists:incoming.some(e=>e.missing)?false:null,unparsed:true};
    const functions=(node.functions||[]).filter(f=>f.name.toLowerCase().includes(symbol_query.toLowerCase())),signals=(node.signals||[]).filter(f=>f.name.toLowerCase().includes(symbol_query.toLowerCase()));
    return {...base,selected:{...node,functions:functions.slice(symbol_offset,symbol_offset+symbol_limit),signals:signals.slice(symbol_offset,symbol_offset+symbol_limit)},symbol_page:{offset:symbol_offset,limit:symbol_limit,functions_total:node.functions_total||0,signals_total:node.signals_total||0,available:Math.max(functions.length,signals.length),has_more:symbol_offset+symbol_limit<Math.max(functions.length,signals.length),query:symbol_query},incoming:incoming.slice(offset,offset+limit).map(e=>enrich(e,'in')),outgoing:outgoing.slice(offset,offset+limit).map(e=>enrich(e,'out')),incoming_total:incoming.length,outgoing_total:outgoing.length,unresolved:map.unresolved.filter(r=>r.file===file)};
  }
  const terms=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches=map.nodes.filter(n=>(kind==='all'||(kind==='unlinked'?!n.incoming:n.kind===kind))&&terms.every(term=>(n.file+' '+(n.class_name||'')).toLocaleLowerCase().includes(term)));
  return {...base,total:matches.length,files:matches.slice(offset,offset+limit).map(compactNode),query,kind};
}
function compactNode({fingerprint,functions,signals,...node}){return node;}
const scanners=new Map();
async function scanProjectMap(root){const real=await fs.realpath(root);if(!scanners.has(real)){if(scanners.size>=3)scanners.delete(scanners.keys().next().value);scanners.set(real,new ProjectMap(real));}return scanners.get(real).scan();}
async function getProjectMap(root,options={}){return projectView(await scanProjectMap(root),options);}
module.exports={ProjectMap,getProjectMap,projectView,scanProjectMap};
