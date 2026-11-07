// An existing conversation keeps its task. Explicit null means general discussion.
function resolve(input,conversation,activeTaskId){
 let taskId;
 if(Object.hasOwn(input,'taskId')&&input.taskId!==undefined)taskId=input.taskId;
 else if(conversation&&Object.hasOwn(conversation,'bound_task_id'))taskId=conversation.bound_task_id;
 else if(conversation?.messages?.length)taskId=conversation.task_id||null;
 else taskId=activeTaskId||null;
 if(taskId!==null&&(typeof taskId!=='string'||!taskId||taskId.length>160))throw new Error('Некорректная задача разговора.');
 return taskId;
}
module.exports={resolve};
