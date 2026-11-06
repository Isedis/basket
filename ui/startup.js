window.opora.startupInfo().then(info=>{document.querySelector('#error').textContent=info.error;document.querySelector('#log').textContent='Журнал: '+info.log;});
document.querySelector('#retry').onclick=()=>window.opora.startupRetry();
document.querySelector('#copy').onclick=async()=>{await window.opora.startupCopy();document.querySelector('#copy').textContent='Скопировано';};
