const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const Reminders=require('../app/reminders'),store=require('../app/store'),{normalize}=require('../app/archive');
const reminder=id=>({id,text:'Felhívni a minta ügyfelet',done:false,createdAt:'2026-11-05T08:00:00.000Z'});
const note=rows=>({id:'n',title:'Minta ügyfél',body:'Megmaradó szöveg',day:'2026-11-05',updated:'2026-11-05T08:00:00Z',reminders:rows});
test('több teendő, kész jelölés és adatérvényesség',()=>{
 const data=[note([reminder('one'),{...reminder('done'),done:true},reminder('two')])];Reminders.validate(data[0].reminders);assert.deepEqual(Reminders.entries(data).map(e=>e.reminder.id),['one','two','done']);
 for(const bad of [{text:' '},{done:'igen'},{createdAt:''}])assert.throws(()=>Reminders.validate([{...reminder('bad'),...bad}]));assert.throws(()=>Reminders.validate([reminder('a'),reminder('a')]));
});
test('a régi jegyzet és eredeti forrás megmarad, emlékeztetők mentődnek, hibás adat nem írja felül őket',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'toki-reminders-'));
 try{const old={id:'old',title:'Régi minta',body:'Eredeti tartalom',updated:'2024-06-27T12:00:00Z',vin:'Régi alvázszám',source:{originalText:'Eredeti forrás'}};const normalized=normalize([old],{years:[],days:[]}).notes[0];assert.deepEqual(normalized.reminders,[]);assert.equal(normalized.vin,old.vin);assert.equal(normalized.source.originalText,old.source.originalText);
 const file=path.join(dir,'notes.json');store.write(file,[note([reminder('call')]),normalized]);const before=fs.readFileSync(file);assert.equal(store.read(file)[0].reminders[0].text,'Felhívni a minta ügyfelet');assert.throws(()=>store.write(file,[note([{...reminder('bad'),done:1}])]));assert.ok(before.equals(fs.readFileSync(file)));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('a tényleges Electron ablakban Vissza az alapértelmezés, csak kifejezett igen engedi a továbblépést',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'toki-review-ipc-')),handlers=new Map(),options=[];let result=1;
 try{const filePath=path.resolve('app/main.js'),actualRequire=createRequire(filePath);
 class Window{constructor(){this.webContents={on(){},setWindowOpenHandler(){}};}setMenuBarVisibility(){}loadFile(){} }
 const electron={app:{requestSingleInstanceLock:()=>true,on(){},whenReady:()=>Promise.resolve(),getPath:()=>dir},BrowserWindow:Window,ipcMain:{handle(){},on:(name,handler)=>handlers.set(name,handler)},dialog:{showMessageBoxSync:(win,config)=>{options.push(config);return result;}},Menu:{}};
 vm.runInNewContext(fs.readFileSync(filePath,'utf8'),{require:name=>name==='electron'?electron:actualRequire(name),__dirname:path.dirname(filePath)},{filename:filePath});await new Promise(resolve=>setImmediate(resolve));
 const request={title:'Minta ügyfél',pending:['Felhívni az ügyfelet']},event={};handlers.get('confirm-note-exit')(event,request);assert.equal(event.returnValue,false);assert.equal(options[0].defaultId,1);assert.equal(options[0].cancelId,1);assert.equal(options[0].message,'Biztosan minden tételt felírtál?');assert.match(options[0].detail,/Felhívni az ügyfelet/);
 result=0;handlers.get('confirm-note-exit')(event,request);assert.equal(event.returnValue,true);assert.equal(fs.existsSync(path.join(dir,'notes.json')),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
