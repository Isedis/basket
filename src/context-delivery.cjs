const crypto=require('node:crypto');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Cache only section fingerprints. The canonical values remain in Opora and the CLI session.
function prepare(packet,previous){
  const fields=Object.fromEntries(['passport','brand','task','task_plan','feedback','references','references_total','warnings'].map(k=>[k,packet[k]??null]));
  const hashes=Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,hash(v)]));
  const cache={project_id:packet.project_id,root:packet.root,task_id:packet.task?.id||null,hashes};
  const identity={project_id:packet.project_id,root:packet.root,revision:packet.revision,work_revision:packet.work_revision,versions:packet.versions};
  const full={...identity,mode:'full',fields};
  const compatible=previous?.project_id===cache.project_id&&previous.root===cache.root&&previous.task_id===cache.task_id;
  const changed=compatible?Object.fromEntries(Object.entries(fields).filter(([k])=>previous.hashes?.[k]!==hashes[k])):fields;
  const delta={...identity,mode:Object.keys(changed).length?'delta':'unchanged',replace:changed};
  const fullText=JSON.stringify(full),deltaText=JSON.stringify(delta);
  const payload=compatible&&Buffer.byteLength(deltaText)<Buffer.byteLength(fullText)?delta:full;
  const prefix='Актуальный контекст Опоры. full заменяет прежний пакет; delta заменяет перечисленные разделы целиком (включая null и массивы); unchanged сохраняет разделы. Всегда обновляй версии. Исходники и изображения читай отдельно. Если предыдущий пакет потерян или сокращён, вызови opora_get_work_context без known_revision. Поля truncated дочитывай через MCP.\n';
  const text=prefix+JSON.stringify(payload),fullBytes=Buffer.byteLength(prefix+fullText);
  return {text,cache,mode:payload.mode,sent_bytes:Buffer.byteLength(text),full_bytes:fullBytes,avoided_bytes:fullBytes-Buffer.byteLength(text)};
}
module.exports={prepare};
