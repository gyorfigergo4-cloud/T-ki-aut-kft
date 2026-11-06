const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),Excel=require('exceljs');
const Export=require('../app/excel-export'),Items=require('../app/items'),W=require('../app/workorders-model');
const fixture=()=>({id:'n',title:'Minta ügyfél',body:'=HYPERLINK("https://example.invalid")',day:'2026-11-06',updated:'2026-11-06T08:00:00Z',phone:'+36 30 000 0000',vehicles:[{id:'a',vin:'00001234567890123',brand:'Suzuki'},{id:'b',vin:'BBBB1234567890123',brand:'Opel'}],activeVehicleId:'b',items:[{...Items.edit(Items.blank('i'),{partNumber:'000123',fullPrice:'20000',discountPercent:'35',supplier:'AP'}),vehicleId:'a',ordered:true,orderedAt:'2026-11-06T08:00:00.000Z',recorded:true,paid:false,arrived:true}],reminders:[{id:'r',text:'Hívás',done:false,createdAt:'2026-11-06T08:00:00.000Z'}]});
test('XLSX fájlban megmarad a vezető nulla, autó-hozzárendelés, ár, jelölés; képlet helyett szöveg',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'toki-xlsx-'));try{
 const n=fixture(),before=JSON.stringify(n),file=path.join(dir,'adatok.xlsx');await Export.write(file,'notes',[n]);const b=new Excel.Workbook();await b.xlsx.readFile(file);
 assert.equal(b.getWorksheet('Jegyzetek').getCell('G2').value,n.body);assert.equal(b.getWorksheet('Jegyzetek').getCell('G2').type,Excel.ValueType.String);
 const row=b.getWorksheet('Cikkszámok').getRow(2).values;assert.equal(row[6],n.vehicles[0].vin);assert.equal(row[8],'000123');assert.equal(row[10],20000);assert.equal(row[12],13000);assert.equal(row[15],'Igen');assert.equal(row[17],'Nem');assert.equal(row[18],'Igen');assert.equal(row[19],'Igen');assert.equal(b.getWorksheet('Járművek').rowCount,3);assert.equal(JSON.stringify(n),before);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('kijelölés és külön adatkörök nem keverik a jegyzeteket, munkalapokat, közös autókat',()=>{
 const n=fixture(),other={...n,id:'other',title:'Másik'};assert.deepEqual(Export.select([n,other],'n'),[n]);assert.throws(()=>Export.select([n],'missing'));assert.throws(()=>Export.workbook('invalid',[]));
 const w=W.blank('w','2026-11-06',[],'i');w.customer='Munkalap ügyfél';w.items=n.items;const b=Export.workbook('workorders',[w]);assert.deepEqual(b.worksheets.map(s=>s.name),['Munkalapok','Tételek']);assert.equal(b.getWorksheet('Tételek').getCell('O2').value,'Igen');
 const g=Export.workbook('garage',[{id:'p',name:'Közös ügyfél',cars:[{id:'c',vehicle:'Autó',vin:'000VIN',plate:'ABC-123'}]}]);assert.equal(g.worksheets.length,1);assert.equal(g.getWorksheet(1).getCell('E2').value,'000VIN');assert.equal(g.getWorksheet(1).getCell('F2').value,'ABC-123');
});
test('hosszú jegyzet teljes szövege külön részekből visszaolvasható, hibás adat nem írja felül a célfájlt',async()=>{
 const n=fixture();n.body='Á😀'.repeat(18000);const b=Export.workbook('notes',[n]);assert.ok(b.getWorksheet('Hosszú szövegek'));const parts=[];b.getWorksheet('Hosszú szövegek').eachRow((r,index)=>{if(index>1){assert.ok(r.getCell(5).value.length<=32000);parts.push(r.getCell(5).value);}});assert.equal(parts.join(''),n.body);
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'toki-xlsx-failure-'));try{const file=path.join(dir,'meglevo.xlsx');await fs.writeFile(file,'eredeti');await assert.rejects(Export.write(file,'notes',[{...n,items:[{...n.items[0],recorded:'igen'}]}]));assert.equal(await fs.readFile(file,'utf8'),'eredeti');assert.deepEqual(await fs.readdir(dir),['meglevo.xlsx']);}finally{await fs.rm(dir,{recursive:true,force:true});}
});
