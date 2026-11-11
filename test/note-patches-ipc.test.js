const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
test('a helyi részleges mentés nem ír felül más jegyzetet és eltűnt adatfájlnál megáll',async()=>{
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'toki-patch-ipc-')),file=path.join(data,'notes.json'),handlers=new Map(),main=path.resolve('app/main.js'),actual=createRequire(main);
 const note=id=>({id,title:id,body:'Megmarad '+id,updated:'2026-11-06T08:00:00Z'});fs.writeFileSync(file,JSON.stringify([note('a'),note('b')]));
 class Window{constructor(){this.webContents={on(){},setWindowOpenHandler(){}};}on(){}setMenuBarVisibility(){}loadFile(){}show(){}}
 const electron={app:{requestSingleInstanceLock:()=>true,on(){},once(){},whenReady:()=>Promise.resolve(),getPath:()=>data},BrowserWindow:Window,ipcMain:{on(){},handle:(k,v)=>handlers.set(k,v)},dialog:{},Menu:{}};
 try{vm.runInNewContext(fs.readFileSync(main,'utf8'),{require:n=>n==='electron'?electron:actual(n),__dirname:path.dirname(main)},{filename:main});await new Promise(r=>setImmediate(r));handlers.get('load')();
 await handlers.get('save-note-changes')(null,{upserts:[{...note('a'),body:'Új A'}],removed:[]});assert.equal(JSON.parse(fs.readFileSync(file))[1].body,'Megmarad b');
 fs.unlinkSync(file);assert.throws(()=>handlers.get('save-note-changes')(null,{upserts:[note('a')],removed:[]}),/eltűnt/);assert.equal(fs.existsSync(file),false);
 }finally{fs.rmSync(data,{recursive:true,force:true});}
});
