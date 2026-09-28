const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('charmsApi', {
  setIgnore: (ignore) => ipcRenderer.send('set-ignore', ignore),
  updateSettings: (partial) => ipcRenderer.send('update-settings', partial),
  showMenu: () => ipcRenderer.send('show-menu'),
  onSettings: (cb) => ipcRenderer.on('settings', (_e, s) => cb(s)),
});
