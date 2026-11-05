const fs=require('node:fs/promises');
const path=require('node:path');
const {constants}=require('node:fs');
const {validateState,assertSafePath}=require('./core.cjs');
const {assessBrandbook}=require('../ui/brand-review.js');
async function reviewProject(root,state) {
  validateState(state);
  const referenceEvidence={};
  for(const ref of state.references.slice(0,64)) {
    try {
      await assertSafePath(root,ref.file);
      const stat=await fs.stat(path.join(root,ref.file));
      if(!stat.isFile() || stat.size===0)throw new Error('Not a usable file');
      await fs.access(path.join(root,ref.file),constants.R_OK);
      referenceEvidence[ref.id]={status:'available',bytes:stat.size};
    } catch(error) {referenceEvidence[ref.id]={status:error.code==='ENOENT'?'missing':'unreadable'};}
  }
  const result=assessBrandbook(state,{referenceEvidence});
  const large=state.references.filter(ref=>(referenceEvidence[ref.id]?.bytes||0)>8*1024*1024);
  if(large.length)result.findings.push({id:'reference-mcp-size',severity:'note',title:'Некоторые эталоны слишком велики для MCP',detail:'Через opora_get_reference доступны файлы до 8 МиБ: '+large.map(r=>r.name).slice(0,8).join(', '),suggestion:'Подготовьте уменьшенные копии и добавьте их как образцы для агента.',field:'references',acceptance:'Добавить пригодные для MCP копии не больше 8 МиБ, сохранив оригиналы.'});
  if(state.references.length>64)result.findings.push({id:'reference-limit',severity:'note',title:'Проверены файлы первых 64 образцов',detail:'Остальные файлы в этом проходе не проверялись.',suggestion:'Оставьте в брендбуке основные эталоны.',field:'references',acceptance:'Выбрать основные эталоны для проверки.'});
  return {...result,checkedAt:new Date().toISOString(),referenceEvidence};
}
module.exports={reviewProject};
