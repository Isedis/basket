const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {assertSafePath, validateState} = require('./core.cjs');

const SKIP = new Set(['.git','.godot','.opora','node_modules','release','distribution','build','dist','vendor']);
const TEXT = new Set(['.godot','.tscn','.tres','.gd','.svg']);
const RASTER = new Set(['.png','.jpg','.jpeg','.webp']);
const FONT = new Set(['.ttf','.otf','.woff','.woff2','.fnt']);
const num = '[-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][-+]?\\d+)?';

// Keep character offsets/newlines while hiding quoted strings and comments.
// This prevents examples in GDScript comments/docstrings becoming design tokens.
function codeMask(text, comment = '#', keepStrings = false) {
  let out = '', quote = '', triple = false;
  for (let i=0; i<text.length; i++) {
    const ch=text[i];
    if (quote) {
      const visible=keepStrings && !triple;
      if (ch==='\\') {out+=visible?ch:' '; if (i+1<text.length){const escaped=text[++i];out+=visible?escaped:escaped==='\n'?'\n':' ';} continue;}
      if (triple && text.slice(i,i+3)===quote.repeat(3)) {out+='   '; i+=2; quote=''; triple=false; continue;}
      if (!triple && ch===quote) quote='';
      out+=visible?ch:ch==='\n'?'\n':' '; continue;
    }
    if (ch==='"' || ch==="'") {
      quote=ch; triple=text.slice(i,i+3)===ch.repeat(3);
      out+=triple?'   ':keepStrings?ch:' '; if(triple)i+=2; continue;
    }
    if (ch===comment) {
      while(i<text.length && text[i]!=='\n') {out+=' ';i++;}
      if(i<text.length)out+='\n'; continue;
    }
    out+=ch;
  }
  return out;
}
function hexColor(values, integer = false) {
  if (values.length<3 || values.length>4 || values.some(n=>!Number.isFinite(n) || n<0 || n>(integer?255:1))) return null;
  const scale=integer?1:255;
  const bytes=values.map(n=>Math.round(n*scale));
  if(bytes.length===3)bytes.push(255);
  if(bytes[3]===0)return null;
  return '#'+bytes.slice(0,bytes[3]===255?3:4).map(n=>n.toString(16).padStart(2,'0')).join('').toUpperCase();
}
function normalizeHex(hex) {
  let value=hex.replace(/^#/,'');
  if(!/^(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value))return null;
  if(value.length<=4)value=[...value].map(c=>c+c).join('');
  if(value.length===8 && value.slice(6).toUpperCase()==='00')return null;
  if(value.length===8 && value.slice(6).toUpperCase()==='FF')value=value.slice(0,6);
  return '#'+value.toUpperCase();
}
function sourceLocator(text, file) {
  const starts=[0];
  for(let i=0;i<text.length;i++)if(text[i]==='\n')starts.push(i+1);
  return offset=>{
    let lo=0,hi=starts.length;
    while(lo+1<hi){const mid=(lo+hi)>>1;if(starts[mid]<=offset)lo=mid;else hi=mid;}
    const current=text.slice(starts[lo],Math.min(starts[lo]+180,starts[lo+1]??text.length));
    const property=current.includes('=')?current.split('=')[0].trim().slice(0,100):'Color';
    return {file,line:lo+1,property};
  };
}
function countValue(map, key, source, extras = {}) {
  if(!map.has(key) && map.size>=512){map.limited=true;return;}
  if(!map.has(key))map.set(key,{...extras,count:0,sources:[]});
  const item=map.get(key); item.count++;
  if(item.sources.length<4 && !item.sources.some(s=>s.file===source.file && s.line===source.line))item.sources.push(source);
}
async function boundedFile(file, maxBytes) {
  const handle=await fs.open(file,'r');
  try {
    const stat=await handle.stat();
    if(!stat.isFile() || stat.size>maxBytes)return null;
    const buffer=Buffer.alloc(Math.min(maxBytes+1,stat.size+1));
    const {bytesRead}=await handle.read(buffer,0,buffer.length,0);
    return bytesRead>maxBytes?null:buffer.subarray(0,bytesRead);
  } finally {await handle.close();}
}
async function boundedText(file,maxBytes){return (await boundedFile(file,maxBytes))?.toString('utf8')??null;}

async function scanProject(root, options = {}) {
  const realRoot=await fs.realpath(root);
  await assertSafePath(realRoot,'project.godot');
  const config=await boundedText(path.join(realRoot,'project.godot'),2*1024*1024);
  if(config===null)throw new Error('Не удалось прочитать project.godot.');
  const maxFiles=options.maxFiles??6000;
  const maxBytes=options.maxTextBytes??2*1024*1024;
  const stats={files:0,entries:0,textFiles:0,omitted:0,symlinks:0,unreadable:0,limited:false,scenes:0,themes:0,styleBoxes:0};
  const inventory=[];
  async function walk(relative='') {
    let entries;
    try {entries=await fs.readdir(path.join(realRoot,relative),{withFileTypes:true});} catch {stats.unreadable++;return;}
    entries.sort((a,b)=>a.name.localeCompare(b.name));
    for(const entry of entries) {
      if(stats.files>=maxFiles || stats.entries>=maxFiles*2){stats.limited=true;return;}
      stats.entries++;
      if(entry.isSymbolicLink()){stats.symlinks++;continue;}
      if(entry.name.startsWith('.') || SKIP.has(entry.name.toLowerCase()))continue;
      const file=relative?relative+'/'+entry.name:entry.name;
      if(entry.isDirectory())await walk(file);
      else if(entry.isFile()){stats.files++;inventory.push({file,ext:path.extname(entry.name).toLowerCase()});}
    }
  }
  await walk();
  const colors=new Map(), sizes=new Map(), metrics=new Map(), settings={};
  let section='';
  for(const line of config.split('\n')) {
    const header=line.match(/^\s*\[([^\]]+)\]/);
    if(header){section=header[1];continue;}
    const item=line.match(/^\s*([\w/]+)\s*=\s*("[^"]*"|-?\d+)\s*$/);
    if(item && ((section==='display' && /^window\/(?:size\/(?:viewport_width|viewport_height|width|height)|stretch\/mode)$/.test(item[1])) || (section==='rendering' && item[1]==='textures/canvas_textures/default_texture_filter'))) {
      settings[section+'/'+item[1]]=item[2].startsWith('"')?item[2].slice(1,-1):Number(item[2]);
    }
  }
  const fontFiles=inventory.filter(f=>FONT.has(f.ext)).slice(0,128).map(f=>({file:f.file,sources:[]}));
  let textBudget=options.maxTotalTextBytes??32*1024*1024;
  for(const entry of inventory) {
    if(!TEXT.has(entry.ext))continue;
    if(textBudget<=0){stats.limited=true;continue;}
    let text;
    try {
      await assertSafePath(realRoot,entry.file);
      text=await boundedText(path.join(realRoot,entry.file),Math.min(maxBytes,textBudget));
    } catch {stats.unreadable++;continue;}
    if(text===null){stats.omitted++;continue;}
    textBudget-=Buffer.byteLength(text);
    const locate=sourceLocator(text,entry.file);
    stats.textFiles++;
    if(entry.ext==='.tscn')stats.scenes++;
    if(entry.ext==='.tres' && /^\[gd_resource[^\n]*type="Theme"/m.test(text))stats.themes++;
    stats.styleBoxes+=(text.match(/^\[(?:sub_resource|gd_resource)[^\n]*type="StyleBoxFlat"/gm)||[]).length;
    if(entry.ext==='.svg') {
      const svg=text.replace(/<!--[\s\S]*?-->/g,match=>match.replace(/[^\n]/g,' '));
      for(const match of svg.matchAll(/(?:fill|stroke|stop-color)\s*[:=]\s*["']?\s*(#[0-9a-f]{3,8})\b/gi)) {
        const hex=normalizeHex(match[1]);
        if(hex)countValue(colors,hex,locate(match.index),{hex});
      }
      continue;
    }
    const masked=codeMask(text,entry.ext==='.gd'?'#':';');
    for(const match of masked.matchAll(/\bColor(8|\.html)?\s*\(/g)) {
      const argument=text.slice(match.index+match[0].length);
      const numeric=argument.match(new RegExp('^\\s*('+num+'(?:\\s*,\\s*'+num+'){2,3})\\s*\\)'));
      const literal=argument.match(/^\s*["'](#?[0-9a-f]{3,8})["']\s*\)/i);
      const hex=numeric?hexColor(numeric[1].split(',').map(Number),match[1]==='8'):literal?normalizeHex(literal[1]):null;
      if(hex)countValue(colors,hex,locate(match.index),{hex});
    }
    const named={WHITE:'#FFFFFF',BLACK:'#000000',RED:'#FF0000',GREEN:'#00FF00',BLUE:'#0000FF',CYAN:'#00FFFF',MAGENTA:'#FF00FF',YELLOW:'#FFFF00'};
    for(const match of masked.matchAll(/\bColor\.(WHITE|BLACK|RED|GREEN|BLUE|CYAN|MAGENTA|YELLOW)\b/g))countValue(colors,named[match[1]],locate(match.index),{hex:named[match[1]]});
    for(const match of masked.matchAll(/^\s*(?:const\s+|var\s+)?([\w/]+)(?:\s*:\s*\w+)?\s*=\s*(-?\d+)\s*$/gm)) {
      const key=match[1], value=Number(match[2]), source=locate(match.index+match[0].indexOf(key));
      source.property=key;
      if(/(?:font_size|font_sizes)/i.test(key) && value>0 && value<=512)countValue(sizes,value,source,{value});
      if(/^(?:corner_radius_(?:top|bottom)_(?:left|right)|border_width_(?:left|top|right|bottom)|content_margin_(?:left|top|right|bottom))$/.test(key) && value>=0 && value<=1024)countValue(metrics,key+'='+value,source,{property:key,value});
    }
    // Static resource references are evidence of a reference, not proof of runtime use.
    const references=codeMask(text,entry.ext==='.gd'?'#':';',true);
    for(const font of fontFiles) {
      const needle='res://'+font.file;
      let at=references.indexOf(needle);
      while(at>=0) {
        if(font.sources.length<4 && ['"',"'"].includes(references[at-1]) && references[at+needle.length]===references[at-1])font.sources.push(locate(at));
        at=references.indexOf(needle,at+needle.length);
      }
    }
  }
  const ranked=inventory.filter(f=>RASTER.has(f.ext)).map(f=>({...f,score:/(screenshot|screen|menu|title|hud|interface|[/_-]ui[/_-])/i.test(f.file)?2:/(button|panel|icon)/i.test(f.file)?1:0})).sort((a,b)=>b.score-a.score || a.file.localeCompare(b.file));
  const assets=[], imageColors=new Map();
  for(const entry of ranked) {
    if(assets.length>=6)break;
    try {
      await assertSafePath(realRoot,entry.file);
      const stat=await fs.stat(path.join(realRoot,entry.file));
      if(stat.size>4*1024*1024){stats.omitted++;continue;}
      const data=await boundedFile(path.join(realRoot,entry.file),4*1024*1024);
      if(!data){stats.omitted++;continue;}
      const sampled=options.readImage?await options.readImage(data):null;
      if(options.readImage && !sampled){stats.omitted++;continue;}
      assets.push({file:entry.file,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex'),thumbnail:sampled?.thumbnail||null});
      for(const color of sampled?.colors||[]) {
        const hex=normalizeHex(color.hex);
        if(hex)countValue(imageColors,hex,{file:entry.file,line:0,property:'приблизительный цвет изображения'},{hex});
      }
    } catch {stats.unreadable++;}
  }
  const sortCounts=map=>[...map.values()].sort((a,b)=>b.count-a.count);
  const report={version:1,id:crypto.randomUUID(),scannedAt:new Date().toISOString(),stats,settings,colors:sortCounts(colors).slice(0,24),imageColors:sortCounts(imageColors).slice(0,8),fonts:fontFiles.sort((a,b)=>b.sources.length-a.sources.length).slice(0,16),fontSizes:sortCounts(sizes).slice(0,16),metrics:sortCounts(metrics).slice(0,20),assets,warnings:[]};
  if(stats.limited)report.warnings.push(`Достигнут лимит анализа (${maxFiles} файлов или 32 МБ текста); проект просмотрен не полностью.`);
  if([colors,sizes,metrics].some(map=>map.limited))report.warnings.push('В отдельных категориях больше 512 уникальных значений; список ограничен.');
  if(stats.omitted)report.warnings.push(`Пропущено крупных или неподдерживаемых файлов: ${stats.omitted}.`);
  if(stats.unreadable)report.warnings.push(`Не удалось прочитать файлов или папок: ${stats.unreadable}.`);
  if(stats.symlinks)report.warnings.push(`Символические ссылки пропущены: ${stats.symlinks}.`);
  if(!report.colors.length)report.warnings.push('Явные цвета не найдены. Цвета изображений, если доступны, приблизительны; их назначение нужно выбрать.');
  if(!report.fonts.length)report.warnings.push('Файлы шрифтов не найдены. Проект может использовать системный шрифт или тему Godot по умолчанию.');
  report.warnings.push('Скрипты не исполняются. Динамические значения, итоговый вид экранов и художественное настроение не определяются. Частота в файлах не означает важность цвета.');
  const preferredColors=report.colors.length?report.colors:report.imageColors;
  report.draft={
    direction:[`Черновик по файлам проекта Godot. Найдено сцен: ${stats.scenes}, ресурсов Theme: ${stats.themes}, StyleBoxFlat: ${stats.styleBoxes}.`,
      Object.keys(settings).length?'Настройки проекта:\n'+Object.entries(settings).map(([key,value])=>`${key} = ${value}`).join('\n'):'',
      report.metrics.length?'Найденные параметры оформления:\n'+report.metrics.slice(0,10).map(m=>`${m.property} = ${m.value} (${m.sources[0].file}:${m.sources[0].line})`).join('\n'):'',
      'Художественное направление и настроение пока не установлены. Проверьте кандидаты в эталоны и уточните описание.'].filter(Boolean).join('\n\n'),
    palette:preferredColors.slice(0,12).map(c=>`${c.hex} — ${report.colors.length?'объявлен в файлах':'приблизительно из изображения'}; ${c.sources[0].file}${c.sources[0].line?':'+c.sources[0].line:''}; назначение не утверждено`).join('\n'),
    fonts:[...report.fonts.slice(0,8).map(f=>`res://${f.file} — ${f.sources.length?'найдена статическая ссылка: '+f.sources[0].file+':'+f.sources[0].line:'файл найден; применение не подтверждено'}`),...report.fontSizes.slice(0,8).map(s=>`${s.value} px — ${s.sources[0].property}, ${s.sources[0].file}:${s.sources[0].line}`)].join('\n'),
    avoid:'Предлагаемые правила: сначала переиспользовать найденные темы, шрифты и компоненты. Новые цвета, шрифты и формы согласовывать как предложения. Найденные варианты могут противоречить друг другу; не считать их все утверждённым стилем.'
  };
  return report;
}

async function applyDraft(root, state, report, selection) {
  validateState(state);
  if(!Array.isArray(selection.fields) || selection.fields.some(k=>!['direction','palette','fonts','avoid'].includes(k)))throw new Error('Некорректный выбор полей брендбука.');
  if(!Array.isArray(selection.assets) || selection.assets.some(f=>!report.assets.some(a=>a.file===f)))throw new Error('Выбран неизвестный образец.');
  const next=structuredClone(state);
  for(const key of selection.fields)next.brand[key]=report.draft[key];
  if(selection.fields.length)next.brand.status='draft';
  // Store evidence, but not potentially large thumbnail data URLs.
  next.brand.analysis={...report,assets:report.assets.map(({thumbnail,...rest})=>rest)};
  delete next.brand.analysis.id;
  for(const file of selection.assets) {
    await assertSafePath(root,file);
    const stat=await fs.stat(path.join(root,file));
    if(stat.size>4*1024*1024)throw new Error('Образец изменился или стал слишком большим. Повторите анализ.');
    const data=await fs.readFile(path.join(root,file));
    const digest=crypto.createHash('sha256').update(data).digest('hex');
    if(digest!==report.assets.find(a=>a.file===file).sha256)throw new Error('Образец изменился после анализа. Повторите анализ; исходник сохранён.');
    const target=`.opora/references/${digest}${path.extname(file).toLowerCase()}`;
    if(next.references.some(r=>r.file===target))continue;
    await assertSafePath(root,target);
    await fs.mkdir(path.join(root,'.opora/references'),{recursive:true});
    try {await fs.writeFile(path.join(root,target),data,{flag:'wx'});} catch(error) {
      if(error.code!=='EEXIST')throw error;
      const existing=await fs.readFile(path.join(root,target));
      if(!existing.equals(data))throw new Error('Конфликт файла образца; существующая копия сохранена.');
    }
    next.references.push({id:crypto.randomUUID(),name:path.basename(file),file:target,status:'draft',source:file});
  }
  next.updatedAt=new Date().toISOString();
  return validateState(next);
}

module.exports={scanProject,applyDraft,normalizeHex,codeMask};
