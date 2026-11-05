const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('opora', {
  openProject: () => ipcRenderer.invoke('project:open'),
  restoreProject: () => ipcRenderer.invoke('project:restore'),
  save: state => ipcRenderer.invoke('project:save', state),
  preview: state => ipcRenderer.invoke('project:preview', state),
  sync: state => ipcRenderer.invoke('project:sync', state),
  addReferences: () => ipcRenderer.invoke('reference:add'),
  referenceImage: file => ipcRenderer.invoke('reference:image', file),
  copy: text => ipcRenderer.invoke('clipboard:copy', text),
  onCloseRequested: callback => ipcRenderer.on('app:flush', () => callback()),
  readyToClose: () => ipcRenderer.send('app:ready-to-close')
});
