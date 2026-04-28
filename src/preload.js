const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kickAlerts', {
  getState: () => ipcRenderer.invoke('state:get'),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),
  addStreamer: (input) => ipcRenderer.invoke('streamer:add', input),
  importStreamers: (text) => ipcRenderer.invoke('streamer:import', text),
  updateStreamer: (id, patch) => ipcRenderer.invoke('streamer:update', id, patch),
  removeStreamer: (id) => ipcRenderer.invoke('streamer:remove', id),
  pollNow: () => ipcRenderer.invoke('poll:now'),
  testEmail: () => ipcRenderer.invoke('email:test'),
  openExternal: (url) => ipcRenderer.invoke('external:open', url),
  onStateChanged: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('state:changed', listener);
    return () => ipcRenderer.removeListener('state:changed', listener);
  }
});
