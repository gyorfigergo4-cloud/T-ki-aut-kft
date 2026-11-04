const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('notesAPI', { load: () => ipcRenderer.invoke('load'), save: notes => ipcRenderer.invoke('save', notes), export: (notes, archive) => ipcRenderer.invoke('export', notes, archive), loadArchive: () => ipcRenderer.invoke('load-archive'), saveArchive: archive => ipcRenderer.invoke('save-archive', archive) });
