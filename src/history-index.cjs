// Bounded in-memory index. Stat every record, parse only new/changed JSON.
// Atomic replacement, edits, deletion and new records are detected on each read.
const fs=require('node:fs/promises'),path=require('node:path');
const {assertSafePath}=require('./core.cjs');
const indexes=new Map(),bodies=new Map();let bodyBytes=0;const BUDGET=6*1024*1024;
const signature=s=>[s.size,s.mtimeNs,s.ctimeNs,s.ino].join(':');
function remember(key,signature,data,bytes){const old=bodies.get(key);if(old)bodyBytes-=old.bytes;bodies.delete(key);bodies.set(key,{signature,data,bytes});bodyBytes+=bytes;while(bodyBytes>BUDGET&&bodies.size){const [k,v]=bodies.entries().next().value;bodies.delete(k);bodyBytes-=v.bytes;}}
async function load(file,max,sig){const cached=bodies.get(file);if(cached?.signature===sig)return structuredClone(cached.data);const h=await fs.open(file,'r');try{const stat=await h.stat({bigint:true});if(!stat.isFile()||Number(stat.size)>max)throw new Error('Запись истории слишком большая.');const buffer=Buffer.alloc(Number(stat.size)+1),{bytesRead}=await h.read(buffer,0,buffer.length,0);if(bytesRead!==Number(stat.size))throw new Error('Запись истории изменилась во время чтения.');const after=await fs.lstat(file,{bigint:true});if(after.isSymbolicLink()||signature(after)!==sig||signature(stat)!==sig)throw new Error('Запись истории изменена.');const data=JSON.parse(buffer.subarray(0,bytesRead).toString('utf8'));remember(file,sig,data,bytesRead);return structuredClone(data);}finally{await h.close();}}
async function scan(root,{directory,match,child,max,summary}){
 await assertSafePath(root,directory);const dir=path.join(root,directory);let listing;try{listing=await fs.readdir(dir,{withFileTypes:true});}catch(e){if(e.code==='ENOENT')return {rows:[],unreadable:0};throw e;}
 let index=indexes.get(dir);if(!index){index=new Map();indexes.set(dir,index);if(indexes.size>6)indexes.delete(indexes.keys().next().value);}
 const entries=listing.filter(e=>match.test(e.name)&&(child?e.isDirectory():e.isFile())),seen=new Set(entries.map(e=>e.name)),rows=[];let unreadable=0;
 for(const name of index.keys())if(!seen.has(name))index.delete(name);
 for(let offset=0;offset<entries.length;offset+=24)await Promise.all(entries.slice(offset,offset+24).map(async e=>{const file=path.join(dir,e.name,...(child?[child]:[]));try{const stat=await fs.lstat(file,{bigint:true});if(!stat.isFile()||stat.isSymbolicLink())throw new Error('Необычная запись истории.');const sig=signature(stat),old=index.get(e.name);let meta;if(old?.signature===sig){if(old.invalid)throw new Error('Недоступная запись истории.');meta=old.meta;}else{try{meta=summary(await load(file,max,sig),e.name);index.set(e.name,{signature:sig,meta});}catch(error){index.set(e.name,{signature:sig,invalid:true});throw error;}}rows.push({...meta,file,signature:sig,max});}catch{unreadable++;}}));
 return {rows,unreadable};
}
async function read(row){return load(row.file,row.max,row.signature);}
module.exports={scan,read};
