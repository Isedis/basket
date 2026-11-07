/* SDK counters are measurements, never estimates of subscription quota. */
const number=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
const fields={input:'input_tokens',output:'output_tokens',cacheRead:'cache_read_input_tokens',cacheWrite:'cache_creation_input_tokens'};
function counts(raw,model=false){if(!raw||typeof raw!=='object')return null;const names=model?{input:'inputTokens',output:'outputTokens',cacheRead:'cacheReadInputTokens',cacheWrite:'cacheCreationInputTokens'}:fields;if(!Object.values(names).some(name=>number(raw[name])!==null))return null;const result={};for(const [key,name]of Object.entries(names))result[key]=number(raw[name])??0;result.total=Object.values(result).reduce((sum,value)=>sum+value,0);return result;}
function sum(rows){if(!rows.length)return null;const result={input:0,output:0,cacheRead:0,cacheWrite:0,total:0};for(const row of rows)for(const key of Object.keys(result))result[key]+=row[key];return result;}
function modelTotals(models){return sum(Object.values(models||{}).map(row=>counts(row,true)).filter(Boolean));}
function state(c){return c.metrics||(c.metrics={turn:null,session:null,limits:{state:'unknown',windows:[]}});}
function begin(c){const m=state(c);m.turn=null;}
function stream(c,messages,id,usage){const row=counts(usage);if(!row||!id)return;const old=messages.get(id)||{};for(const key of Object.keys(fields))row[key]=Math.max(old[key]||0,row[key]);row.total=Object.keys(fields).reduce((n,k)=>n+row[k],0);messages.set(id,row);state(c).turn={...sum([...messages.values()]),provisional:true,scope:'main'};}
function result(c,packet){const m=state(c),turn=counts(packet.usage),session=modelTotals(packet.modelUsage);if(turn)m.turn={...turn,provisional:false,scope:'main'};if(session)m.session={...session,scope:'pipeline',updatedAt:new Date().toISOString()};}
const labels={five_hour:'За 5 часов',seven_day:'За неделю',seven_day_opus:'Opus · неделя',seven_day_sonnet:'Sonnet · неделя',seven_day_oauth_apps:'Приложения · неделя'};
function date(value){if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))return null;return new Date(value).toISOString();}
function report(c,report){if(!report||typeof report!=='object'||(!report.session&&typeof report.rate_limits_available!=='boolean'&&!report.rate_limits))return false;
 const m=state(c),session=modelTotals(report.session?.model_usage);if(session)m.session={...session,scope:'pipeline',updatedAt:new Date().toISOString()};
 const limits=report.rate_limits,windows=[];
 for(const [key,label]of Object.entries(labels)){const row=limits?.[key];if(row&&typeof row==='object')windows.push({key,label,percent:number(row.utilization)===null?null:Math.min(100,row.utilization),resetsAt:date(row.resets_at)});}
 for(const [index,row]of (Array.isArray(limits?.model_scoped)?limits.model_scoped:[]).slice(0,12).entries())if(row&&typeof row==='object')windows.push({key:'model-'+index,label:String(row.display_name||'Модель').slice(0,100)+' · неделя',percent:number(row.utilization)===null?null:Math.min(100,row.utilization),resetsAt:date(row.resets_at)});
 for(const [index,row]of (Array.isArray(limits?.limits)?limits.limits:[]).slice(0,16).entries()){if(!row||typeof row!=='object')continue;const kind=String(row.kind||''),scope=row.scope?.model?.display_name||row.scope?.surface?.display_name;windows.push({key:'meter-'+index,label:(scope?String(scope)+' · ':'')+(({session:'Сессия',weekly_all:'За неделю',weekly_scoped:'За неделю'})[kind]||kind||'Лимит'),percent:number(row.percent)===null?null:Math.min(100,row.percent),resetsAt:date(row.resets_at)});}
 m.limits={...m.limits,state:limits&&windows.length?'ready':'unavailable',windows,subscription:typeof report.subscription_type==='string'?report.subscription_type.slice(0,40):null,updatedAt:new Date().toISOString(),error:null};return true;
}
function event(c,info){if(!info||!['allowed','allowed_warning','rejected'].includes(info.status))return;const m=state(c);const reset=number(info.resetsAt),instant=reset===null?null:new Date(reset>1e12?reset:reset*1000);m.limits={...m.limits,event:{status:info.status,type:labels[info.rateLimitType]||null,resetsAt:!instant||!Number.isFinite(instant.getTime())?null:instant.toISOString(),updatedAt:new Date().toISOString()}};}
module.exports={begin,stream,result,report,event,state,counts,modelTotals};
