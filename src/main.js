import { app, BrowserWindow, dialog, ipcMain, session } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { groups } from './parameters.js';
import { readLibrary, exportProgram, exportReceivedPrograms } from './library.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const loaded=new Map();
let mainWindow;

ipcMain.handle('program:groups',()=>groups);

function createWindow(){
  mainWindow=new BrowserWindow({width:1280,height:820,minWidth:900,minHeight:600,backgroundColor:'#101114',title:'MiniLibrarian',webPreferences:{preload:path.join(here,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  mainWindow.loadFile(path.join(here,'index.html'));
  mainWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  mainWindow.on('closed',()=>{mainWindow=null;});
}

ipcMain.handle('library:open',async(event)=>{
  const {canceled,filePaths}=await dialog.showOpenDialog({properties:['openFile'],filters:[{name:'minilogue xd library or program',extensions:['mnlgxdlib','mnlgxdprog']},{name:'All files',extensions:['*']}]});
  if(canceled||!filePaths[0]) return null;
  const filePath=filePaths[0];
  const programs=readLibrary(filePath);
  const archive=new AdmZip(filePath);
  loaded.clear();
  for(const p of programs) loaded.set(p.id,{archive,program:p});
  return {source:path.basename(filePath),programs};
});

ipcMain.handle('program:export',async(_event,id,suggestedName)=>{
  const item=loaded.get(id);
  if(!item) throw new Error('This program is no longer available. Open the library again.');
  const safeName=String(suggestedName||'Program').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').trim()||'Program';
  const {canceled,filePath}=await dialog.showSaveDialog({defaultPath:`${safeName}.mnlgxdprog`,filters:[{name:'minilogue xd program',extensions:['mnlgxdprog']}]});
  if(canceled||!filePath) return false;
  const outputPath=filePath.toLowerCase().endsWith('.mnlgxdprog')?filePath:`${filePath}.mnlgxdprog`;
  exportProgram(item.archive,item.program,outputPath);
  return true;
});

ipcMain.handle('library:save-received',async(event,received)=>{
  if(event.sender!==mainWindow?.webContents) throw new Error('Unexpected save request.');
  if(!Array.isArray(received)||received.length<1||received.length>500) throw new Error('Received program list is invalid.');
  const single=received.length===1;
  const extension=single?'mnlgxdprog':'mnlgxdlib';
  const {canceled,filePath}=await dialog.showSaveDialog(mainWindow,{
    defaultPath:single?'Received Program.mnlgxdprog':'minilogue xd Programs.mnlgxdlib',
    filters:[{name:single?'minilogue xd program':'minilogue xd library',extensions:[extension]}]
  });
  if(canceled||!filePath) return null;
  const outputPath=filePath.toLowerCase().endsWith(`.${extension}`)?filePath:`${filePath}.${extension}`;
  const result=exportReceivedPrograms(received,outputPath);
  const programs=readLibrary(outputPath);
  const archive=new AdmZip(outputPath);
  loaded.clear();
  for(const program of programs) loaded.set(program.id,{archive,program});
  return {path:path.basename(outputPath),...result,programs};
});

app.whenReady().then(()=>{
  session.defaultSession.setPermissionRequestHandler((webContents,permission,callback)=>{
    const localApp=webContents===mainWindow?.webContents&&webContents.getURL().startsWith('file://');
    callback(localApp&&(permission==='midi'||permission==='midiSysex'));
  });
  session.defaultSession.setPermissionCheckHandler((webContents,permission,origin)=>{
    return webContents===mainWindow?.webContents&&origin.startsWith('file://')&&(permission==='midi'||permission==='midiSysex');
  });
  createWindow();
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
