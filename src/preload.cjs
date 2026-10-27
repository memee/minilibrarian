const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('miniLibrarian',{
  openLibrary:()=>ipcRenderer.invoke('library:open'),
  exportProgram:(id,name)=>ipcRenderer.invoke('program:export',id,name),
  saveReceivedPrograms:(programs)=>ipcRenderer.invoke('library:save-received',programs),
  getGroups:()=>ipcRenderer.invoke('program:groups')
});
