const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const folderImport=require('../app/folder-import');const store=require('../app/store');
test('helyi mappa: nevek szétbontása, ékezetek, változatlan eredeti fájl és duplázásmentes betöltés',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'folder-import-'));
 try{
  const source=path.join(root,'Jegyzetek'),month=path.join(source,'2024','Május');fs.mkdirSync(month,{recursive:true});
  const text='Anna Kész\r\nWVWZZZ1KZ6W123456\r\nA123 10.000Ft-6000Ft\r\n\r\nBéla Kész\r\n5w30 4l\r\n';
  const file=path.join(month,'05,30.txt');fs.writeFileSync(file,text,'utf8');
  const data=path.join(root,'data'),first=folderImport.importFolder(source,data),second=folderImport.importFolder(source,data);
  assert.equal(first.files,1);assert.equal(first.notes,2);assert.equal(first.days,1);assert.equal(second.alreadyImported,true);
  const notes=store.read(path.join(data,'notes.json'));assert.equal(notes.length,2);assert.equal(notes[0].title,'Anna Kész');assert.equal(notes[0].day,'2024-05-30');
  assert.equal(notes.map(n=>n.source.originalText).join(''),text);assert.equal(fs.readFileSync(file,'utf8'),text);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('hibás dátumú helyi fájl betöltése nem ír át adatot',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'folder-invalid-'));
 try{
  const source=path.join(root,'Jegyzetek'),month=path.join(source,'2026','Február');fs.mkdirSync(month,{recursive:true});
  fs.writeFileSync(path.join(month,'02.30.txt'),'Ügyfél\nJegyzet');
  assert.throws(()=>folderImport.importFolder(source,path.join(root,'data')),/Érvénytelen nap/);assert.equal(fs.existsSync(path.join(root,'data')),false);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('másolás után eltérő mentési dátum: minden hiányzó nap kiválasztható adatírás nélkül',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'folder-dates-'));
 try{
  const source=path.join(root,'Jegyzetek'),month=path.join(source,'2026','Február');fs.mkdirSync(month,{recursive:true});
  const named=path.join(month,'Minta jármű.txt'),regular=path.join(month,'02.03.txt');
  const original='Minta ügyfél\r\nWVWZZZ1KZ6W123456\r\nA123 10.000Ft-8000Ft\r\n';
  fs.writeFileSync(named,original);fs.writeFileSync(regular,'Másik ügyfél\nB456 5000Ft-4000Ft');
  fs.utimesSync(named,new Date('2026-11-04T12:00:00Z'),new Date('2026-11-04T12:00:00Z'));
  assert.throws(()=>folderImport.build(source),/A nap nem állapítható meg/);
  const prepared=folderImport.prepare(source);assert.equal(prepared.files,2);assert.equal(prepared.issues.length,1);
  const issue=prepared.issues[0];assert.equal(issue.min,'2026-02-01');assert.equal(issue.max,'2026-02-28');
  assert.equal(fs.existsSync(path.join(root,'data')),false);
  assert.throws(()=>folderImport.buildFromScan(prepared.records,{[issue.path]:'2026-03-01'}),/hónapmappájába/);
  assert.throws(()=>folderImport.buildFromScan(prepared.records,{[issue.path]:'2026-02-30'}),/hónapmappájába/);
  const dates={[issue.path]:'2026-02-14'},bundle=folderImport.buildFromScan(prepared.records,dates);
  const chosen=bundle.notes.find(n=>n.source.path===issue.path);assert.equal(chosen.day,'2026-02-14');assert.equal(chosen.source.dateBasis,'user-selected');assert.equal(chosen.source.originalText,original);
  assert.ok(bundle.notes.some(n=>n.day==='2026-02-03'));
  const first=folderImport.importFolder(source,path.join(root,'data'),dates),second=folderImport.importFolder(source,path.join(root,'data'),dates);
  assert.equal(first.imported,2);assert.equal(second.alreadyImported,true);assert.equal(store.read(path.join(root,'data','notes.json')).length,2);assert.equal(fs.readFileSync(named,'utf8'),original);
  fs.writeFileSync(named,'Utólag módosult forrás');
  assert.equal(folderImport.buildFromScan(prepared.records,dates).notes.find(n=>n.source.path===issue.path).source.originalText,original,'A dátumválasztáskor ellenőrzött pillanatkép kerül beolvasásra');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
