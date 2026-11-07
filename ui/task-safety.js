/* Task drafts belong to a local editor; trash belongs to the shared project. */
const OporaTaskSafety=(()=>{
 const fields=t=>({title:t?.title||'',acceptance:t?.acceptance||'',files:Array.isArray(t?.files)?t.files.join('\n'):t?.files||''});
 function drafts(storage,project){
  const key=id=>'opora:task-draft:'+JSON.stringify([project||'demo',id||'new']);
  return {
   read(id){try{const d=JSON.parse(storage.getItem(key(id)));return d?.version===1&&['title','acceptance','files'].every(k=>typeof d[k]==='string')?d:null;}catch{return null;}},
   write(id,value,base){storage.setItem(key(id),JSON.stringify({version:1,...fields(value),base:base||null,updatedAt:new Date().toISOString()}));},
   clear(id,expected){const d=this.read(id);if(!expected||!d||JSON.stringify(fields(d))===JSON.stringify(fields(expected)))storage.removeItem(key(id));}
  };
 }
 function remove(state,id){const task=state.tasks.find(t=>t.id===id);if(!task)throw new Error('Задача уже удалена.');state.deletedTasks||={};if(Object.hasOwn(state.deletedTasks,id))throw new Error('Задача с этим ID уже есть в корзине.');Object.defineProperty(state.deletedTasks,id,{value:{task:structuredClone(task),deletedAt:new Date().toISOString()},enumerable:true,writable:true,configurable:true});state.tasks=state.tasks.filter(t=>t.id!==id);if(state.activeTaskId===id)state.activeTaskId=null;return task;}
 function restore(state,id){const entry=Object.hasOwn(state.deletedTasks||{},id)?state.deletedTasks[id]:null;if(!entry)throw new Error('Задача не найдена в корзине.');if(state.tasks.some(t=>t.id===id))throw new Error('Задача с этим ID уже существует. Существующая задача не изменена.');state.tasks.push(structuredClone(entry.task));delete state.deletedTasks[id];return entry.task;}
 return {fields,drafts,remove,restore};
})();
if(typeof module!=='undefined')module.exports=OporaTaskSafety;
if(typeof window!=='undefined')window.OporaTaskSafety=OporaTaskSafety;
