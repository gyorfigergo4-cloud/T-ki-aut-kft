const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const ExcelJS=require('exceljs'),excel=require('../app/excel-import'),importer=require('../app/initial-import'),store=require('../app/store');
async function fixture(root,rows){const w=new ExcelJS.Workbook(),s=w.addWorksheet('Régi tételek');s.addRow(['Dátum','Név','Alvázszám','Cikkszám','Megnevezés','Teli ár','Kedvezmény %','Db','Beszállító','Egyéb']);for(const row of rows)s.addRow(row);s.getColumn(1).numFmt='yyyy-mm-dd';s.getColumn(7).numFmt='0%';w.addWorksheet('Második lap').addRow(['Cikkszám','Teli ár']);const file=path.join(root,'minta.xlsx');await w.xlsx.writeFile(file);return file;}
function config(view){return {sheet:view.sheet,headerRow:view.headerRow,mapping:view.mapping,fallbackDay:'2026-11-04',fallbackName:'Alap név',fillDown:false};}
test('Excel-dátumok, százalékos cella, darabszám, több név és munkalap helyes beolvasása',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'excel-'));
 try{const file=await fixture(root,[[new Date('2024-06-27T00:00:00Z'),'Ügyfél A','VIN-A','DEMO-A','Szűrő',10000,0.2,2,'IC','Megőrzendő extra mező'],[new Date('2024-06-27T00:00:00Z'),'Ügyfél A','VIN-A','DEMO-B','Betét',5000,0.1,1,'Láng',''],[new Date('2025-01-05T00:00:00Z'),'Ügyfél B','VIN-B','DEMO-C','Tétel',2000,0,3,'Egyéni','']]);const original=fs.readFileSync(file);const {session,view}=await excel.open(file);assert.equal(view.sheets.length,2);assert.equal(view.mapping.quantity,8);const result=excel.build(session,config(view));assert.equal(result.preview.rows,3);assert.equal(result.preview.notes,2);assert.equal(result.preview.days,2);assert.deepEqual(result.errors,[]);const first=result.bundle.notes[0];assert.equal(first.items[0].discountPercent,'20');assert.equal(first.items[0].discountedPrice,'8000');assert.equal(first.items[0].quantity,'2');assert.equal(first.discountPrice,'20500');assert.ok(first.source.originalText.includes('Megőrzendő extra mező'));assert.deepEqual(fs.readFileSync(file),original);
 const directory=path.join(root,'data');assert.equal(importer.applyBundle(directory,result.bundle).imported,2);assert.equal(importer.applyBundle(directory,result.bundle).alreadyImported,true);assert.equal(store.read(path.join(directory,'notes.json')).length,2);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('kézi oszloppárosítás és szöveges magyar árak beolvasása',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'excel-mapping-'));
 try{const w=new ExcelJS.Workbook(),s=w.addWorksheet('Adatok');s.addRow(['Régi készlet']);s.addRow(['Kód','ÁrForrás','KedvForrás','Menny']);s.addRow(['DEMO','12.500 Ft','20%','2']);const file=path.join(root,'custom.xlsx');await w.xlsx.writeFile(file);const {session}=await excel.open(file);const result=excel.build(session,{sheet:'Adatok',headerRow:2,mapping:{partNumber:1,fullPrice:2,discountPercent:3,quantity:4},fallbackDay:'2026-11-04',fallbackName:'Kézi ügyfél'});assert.deepEqual(result.errors,[]);assert.equal(result.bundle.notes[0].items[0].fullPrice,'12500');assert.equal(result.bundle.notes[0].items[0].discountedPrice,'10000');assert.equal(result.bundle.notes[0].title,'Kézi ügyfél');}finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('hibás ár és darabszám nem importálható, a képletet nem hajtja végre',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'excel-invalid-'));
 try{const file=await fixture(root,[[new Date('2026-11-04T00:00:00Z'),'Ügyfél','','BAD','Tétel',-100,0.2,0,'IC',''],[new Date('2026-11-04T00:00:00Z'),'Ügyfél','','FORMULA','Tétel',{formula:'SUM(1,2)'},0.2,1,'IC','']]);const {session,view}=await excel.open(file);const result=excel.build(session,config(view));assert.equal(result.errors.length,2);assert.equal(result.preview.rows,0);assert.ok(result.errors.some(e=>e.includes('képlet')));}finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('készített Excel-minta ténylegesen importálható',async()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'excel-template-'));try{const file=path.join(root,'template.xlsx');await excel.template(file);const {session,view}=await excel.open(file);const result=excel.build(session,config(view));assert.deepEqual(result.errors,[]);assert.equal(result.items[0].quantity,'2');assert.equal(result.items[0].discountedPrice,'8000');}finally{fs.rmSync(root,{recursive:true,force:true});}});
test('Excel-tételek munkalapba fűzése megőrzi a meglévő tételeket, nem dupláz és megtartja a forrást',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'excel-workorder-'));
 try{
  const file=await fixture(root,[[new Date('2026-11-04T00:00:00Z'),'Minta Ügyfél','VIN-A','DEMO-A','Szűrő',10000,0.2,2,'IC','Eredeti megjegyzés']]);
  const {session,view}=await excel.open(file),built=excel.build(session,config(view));
  const model=require('../app/workorders-model');const doc=model.blank('doc','2026-11-04',[],'empty');
  const result=excel.appendWorkorder([doc],'doc',built);assert.equal(result.added,1);assert.equal(result.docs[0].items.length,1);assert.equal(result.docs[0].customer,'Minta Ügyfél');assert.equal(result.docs[0].items[0].discountedPrice,'8000');assert.ok(result.docs[0].items[0].excelSource.originalText.includes('Eredeti megjegyzés'));
  result.docs[0].items[0].description='Felhasználó módosította';const second=excel.appendWorkorder(result.docs,'doc',built);assert.equal(second.added,0);assert.equal(second.docs[0].items[0].description,'Felhasználó módosította');
  const mixed={...built,items:[...built.items,{...built.items[0],id:'other',name:'Másik ügyfél'}]};assert.throws(()=>excel.appendWorkorder(result.docs,'doc',mixed),/egy ügyfél/);assert.equal(result.docs[0].items.length,1);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('ügyfélnév nélküli árlista nem válik automatikusan ügyfélnévvé a munkalapon',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'excel-no-customer-'));
 try{const w=new ExcelJS.Workbook(),s=w.addWorksheet('Árak');s.addRow(['Cikkszám','Megnevezés','Teli ár','Kedvezmény %','Db']);s.addRow(['DEMO','Szűrő',10000,20,1]);const file=path.join(root,'arlista.xlsx');await w.xlsx.writeFile(file);const {session,view}=await excel.open(file);const built=excel.build(session,config(view));const model=require('../app/workorders-model'),doc=model.blank('doc','2026-11-04',[],'r');const result=excel.appendWorkorder([doc],'doc',built);assert.equal(result.docs[0].customer,'');assert.throws(()=>model.printable(result.docs[0]),/ügyfél/);assert.equal(result.docs[0].items.length,1);}finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('Excel számai pénznemre pontosan kerekednek, a százalékos cella helyes marad',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'excel-rounding-'));
 try{const file=await fixture(root,[[new Date('2026-11-04T00:00:00Z'),'Minta','','DEMO','Tétel',1.005,0.125,1,'IC','']]);const {session,view}=await excel.open(file);const built=excel.build(session,config(view));assert.deepEqual(built.errors,[]);assert.equal(built.items[0].fullPrice,'1.01');assert.equal(built.items[0].discountPercent,'12.5');assert.equal(built.items[0].discountedPrice,'0.88');}finally{fs.rmSync(root,{recursive:true,force:true});}
});
