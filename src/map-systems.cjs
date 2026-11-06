// These are navigation groups inferred from paths, not claims about gameplay.
const generic=new Set(['scenes','scripts','assets','resources','src','game']);
const aliases=[['interface','Меню и интерфейс',/^(ui|gui|menus?|interface|main_menu|mainmenu|hud|settings|pause)$/],['combat','Бой',/^(combat|battle|weapons?|damage)$/],['characters','Персонажи',/^(characters?|actors?|players?|enemies|enemy|npcs?)$/],['progress','Прогрессия',/^(progression|progress|upgrades?|skills?|levels?)$/],['inventory','Инвентарь',/^(inventory|items?|equipment|loot)$/],['saves','Сохранения',/^(saves?|saving|persistence)$/],['audio','Звук',/^(audio|sounds?|music|sfx)$/]];
function systemOf(node){
  if(node.file==='project.godot')return {id:'project',label:'Запуск и настройки'};
  const parts=node.file.toLowerCase().split('/'),folders=parts.slice(0,-1),stem=parts.at(-1).replace(/\.uid$/,'').replace(/\.[^.]+$/,'');
  for(const [id,label,pattern] of aliases)if(folders.some(p=>pattern.test(p))||pattern.test(stem)||pattern.test(stem.replace(/_(controller|manager|scene|screen)$/,'')))return {id,label};
  const folder=folders.find(p=>!generic.has(p));if(folder)return {id:'folder:'+folder,label:node.file.split('/')[folders.indexOf(folder)]};
  return node.kind==='scene'?{id:'scenes',label:'Игровые сцены'}:node.kind==='script'?{id:'scripts',label:'Общие скрипты'}:node.kind==='asset'?{id:'assets',label:'Графика и ассеты'}:{id:'resources',label:'Общие ресурсы'};
}
function overview(map,{offset=0,limit=24,query=''}={}){
  const groups=new Map(),membership=new Map();
  for(const node of map.nodes){const descriptor=systemOf(node);membership.set(node.file,descriptor.id);if(!groups.has(descriptor.id))groups.set(descriptor.id,{...descriptor,files:0,scenes:0,scripts:0,resources:0,assets:0,missing:0,entry:null,entryScore:-1});const g=groups.get(descriptor.id);g.files++;if(node.kind==='scene')g.scenes++;if(node.kind==='script')g.scripts++;if(node.kind==='resource'||node.kind==='shader')g.resources++;if(node.kind==='asset')g.assets++;const score=node.file===map.main?1e6:(node.kind==='scene'?10000:0)+(node.outgoing||0);if(score>g.entryScore){g.entry=node.file;g.entryScore=score;}}
  const links=new Map();
  for(const edge of map.edges){const from=membership.get(edge.from),to=membership.get(edge.to);if(edge.missing&&from)groups.get(from).missing++;if(!from||!to||from===to)continue;const key=from+'\0'+to;if(!links.has(key))links.set(key,{from,to,count:0});links.get(key).count++;}
  const matches=[...groups.values()].filter(g=>(g.label+' '+g.id).toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>(b.entry===map.main)-(a.entry===map.main)||b.scenes-a.scenes||b.files-a.files||a.label.localeCompare(b.label,'ru'));
  const systems=matches.slice(offset,offset+limit).map(({entryScore,...g})=>g),shown=new Set(systems.map(g=>g.id));
  const connections=[...links.values()].filter(e=>shown.has(e.from)&&shown.has(e.to)).sort((a,b)=>b.count-a.count);
  return {systems,systems_total:matches.length,system_links:connections.slice(0,96),system_links_total:links.size,main_system:membership.get(map.main)||null,grouping:'Navigation groups inferred from folder/file names; verify actual responsibilities in source files.'};
}
module.exports={systemOf,overview};
