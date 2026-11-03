const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pulsecord', {
    list: () => ipcRenderer.invoke('list'), choose: () => ipcRenderer.invoke('choose'),
    operate: (action, index) => ipcRenderer.invoke('operate', action, index),
    operateMany: (action, indexes) => ipcRenderer.invoke('operate-many', action, indexes),
    license: () => ipcRenderer.invoke('license'),
    windowControl: action => ipcRenderer.invoke('window-control', action),
    onProgress: listener => {
        const handler = (_event, value) => listener(value);
        ipcRenderer.on('operation-progress', handler);
        return () => ipcRenderer.removeListener('operation-progress', handler);
    }
});
