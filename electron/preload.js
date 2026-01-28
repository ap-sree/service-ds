const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    sendNotification: (title, body) => ipcRenderer.send('show-notification', { title, body }),
    onNotification: (callback) => ipcRenderer.on('on-notification', (_event, value) => callback(value))
});
