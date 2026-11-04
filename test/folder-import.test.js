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
