const crypto=require('node:crypto');
function fingerprint(task){return crypto.createHash('sha256').update(JSON.stringify([task.id,task.title,task.acceptance,task.files||[],task.feedbackNoteId||null,task.feedbackShotId||null])).digest('hex');}
module.exports={fingerprint};
