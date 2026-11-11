const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),{createRequire}=require('node:module');
const store=require('../app/store');
test('a tényleges app IPC-je a dátumok megadása előtt nem importál, utána a teljes mappát beolvassa',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'folder-ipc-'));
 try{
  const source=path.join(root,'Jegyzetek'),month=path.join(source,'2026','Február'),data=path.join(root,'data');fs.mkdirSync(month,{recursive:true});
  const file=path.join(month,'Minta jármű.txt');fs.writeFileSync(file,'Minta ügyfél\nWVWZZZ1KZ6W123456\nA123 10000Ft-8000Ft');fs.utimesSync(file,new Date('2026-11-04T12:00:00Z'),new Date('2026-11-04T12:00:00Z'));fs.writeFileSync(path.join(month,'02.03.txt'),'Másik ügyfél\nB456 5000Ft-4000Ft');
  const handlers=new Map(),filePath=path.resolve('app/main.js'),actualRequire=createRequire(filePath);
  class Window{on(){}constructor(){this.webContents={on(){},setWindowOpenHandler(){}};}setMenuBarVisibility(){}loadFile(){}show(){} }
  const electron={app:{requestSingleInstanceLock:()=>true,on(){},once(){},whenReady:()=>Promise.resolve(),getPath:()=>data},BrowserWindow:Window,ipcMain:{on(){},handle:(name,handler)=>handlers.set(name,handler)},dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[source]})},Menu:{}};
  vm.runInNewContext(fs.readFileSync(filePath,'utf8'),{require:name=>name==='electron'?electron:actualRequire(name),__dirname:path.dirname(filePath)},{filename:filePath});
  await new Promise(resolve=>setImmediate(resolve));
  const invoke=(name,value)=>handlers.get(name)({},value);
  const first=await invoke('import-folder');assert.equal(first.ok,true);assert.equal(first.files,2);assert.equal(first.issues.length,1);assert.equal(fs.existsSync(data),false);
  const missing=await invoke('commit-folder-import',{token:first.token,dates:{}});assert.equal(missing.ok,false);assert.equal(fs.existsSync(data),false);
  const imported=await invoke('commit-folder-import',{token:first.token,dates:{[first.issues[0].path]:'2026-02-14'}});assert.equal(imported.ok,true);assert.equal(imported.imported,2);
  const notes=store.read(path.join(data,'notes.json'));assert.equal(notes.length,2);assert.equal(notes.find(n=>n.id===imported.noteId).day,'2026-02-14');
  const again=await invoke('import-folder'),duplicate=await invoke('commit-folder-import',{token:again.token,dates:{[again.issues[0].path]:'2026-02-14'}});assert.equal(duplicate.alreadyImported,true);assert.equal(store.read(path.join(data,'notes.json')).length,2);
  const canceled=await invoke('import-folder');invoke('close-folder-import',canceled.token);assert.equal(invoke('commit-folder-import',{token:canceled.token,dates:{}}).ok,false);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
