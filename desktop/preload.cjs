const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('opora', {
  openProject: () => ipcRenderer.invoke('project:open'),
  restoreProject: () => ipcRenderer.invoke('project:restore'),
  save: state => ipcRenderer.invoke('project:save', state),
  preview: state => ipcRenderer.invoke('project:preview', state),
  sync: state => ipcRenderer.invoke('project:sync', state),
  scanBrandbook: () => ipcRenderer.invoke('brandbook:scan'),
  applyBrandbook: selection => ipcRenderer.invoke('brandbook:apply', selection),
  updateInfo: () => ipcRenderer.invoke('updates:info'),
  checkUpdates: () => ipcRenderer.invoke('updates:check'),
  downloadUpdate: () => ipcRenderer.invoke('updates:download'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  onUpdateProgress: callback => ipcRenderer.on('updates:progress', (_,info) => callback(info)),
  agentInfo: () => ipcRenderer.invoke('agents:info'),
  configureAgent: client => ipcRenderer.invoke('agents:configure', client),
  agentReports: () => ipcRenderer.invoke('agents:reports'),
  addReferences: () => ipcRenderer.invoke('reference:add'),
  referenceImage: file => ipcRenderer.invoke('reference:image', file),
  copy: text => ipcRenderer.invoke('clipboard:copy', text),
  onCloseRequested: callback => ipcRenderer.on('app:flush', () => callback()),
  readyToClose: () => ipcRenderer.send('app:ready-to-close')
});
