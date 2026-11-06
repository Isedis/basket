const crypto=require('node:crypto');
const {scanProjectMap}=require('./project-map.cjs');
function fromMap(map){
  const sources=map.nodes.filter(n=>['project','script','scene','resource','shader'].includes(n.kind)||n.file.endsWith('.uid'));
  return {revision:crypto.createHash('sha256').update(JSON.stringify(sources.map(n=>[n.file,n.fingerprint||null]))).digest('hex'),files:sources.length,limited:map.summary.limited||sources.some(n=>n.unparsed),recordedAt:map.indexed_at,coverage:'Static project, scene, script, resource, shader and UID files. Image/audio assets and runtime state are not covered. Attachment time does not prove capture/execution time.'};
}
async function sourceSnapshot(root){return fromMap(await scanProjectMap(root));}
module.exports={sourceSnapshot,fromMap};
