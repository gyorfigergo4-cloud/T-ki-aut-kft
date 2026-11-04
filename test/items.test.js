const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const items=require('../app/items');
const {normalize}=require('../app/archive');
const store=require('../app/store');
test('százalékból kedvezményes egységár, nulla és teljes kedvezmény, pontos kerekítés',()=>{
 assert.equal(items.discounted('10000','20'),'8000');
 assert.equal(items.discounted('25000','0'),'25000');
 assert.equal(items.discounted('25000','100'),'0');
 assert.equal(items.discounted('0','20'),'0');
 assert.equal(items.discounted('','20'),'');
 assert.equal(items.discounted('19.99','33.333333'),'13.33');
 assert.equal(items.discounted('0.01','50'),'0.01');
 assert.throws(()=>items.discounted('100','101'));
 assert.throws(()=>items.discounted('-100','20'));
});
test('darabszám és több sor összesítése az egységárakból',()=>{
 const first={...items.blank('a'),partNumber:'A123',fullPrice:'10000',discountPercent:'20',discountedPrice:'8000',quantity:'3'};
 const second={...items.blank('b'),partNumber:'B456',fullPrice:'5000',discountPercent:'10',discountedPrice:'4500',quantity:'2'};
 assert.deepEqual(items.totals([first,second]),{fullPrice:'40000',discountedPrice:'33000',savings:'7000',missing:0,active:2,priced:2});
 assert.equal(items.totals([first,{...items.blank('c'),partNumber:'Ár nélkül'}]).missing,1);
 assert.equal(items.formatMoney('19.99'),'19,99 Ft');
 assert.equal(items.formatMoney('0'),'0 Ft');
 const huge={...first,fullPrice:'999999999999.99',discountedPrice:'799999999999.99',quantity:'999999'};
 assert.equal(items.totals([huge]).fullPrice,'999998999999990000.01');
 assert.ok(items.formatMoney(items.totals([huge]).fullPrice).endsWith(',01 Ft'));
});
test('régi sorok szétbontása beszállítóval, árral és darabszámmal, az eredeti ár megtartásával',()=>{
 const row=items.parseLegacyLine('0 986 479 123 IC 10.000Ft/db-6000Ft/db x2 Rendelve',0);
 assert.equal(row.fullPrice,'10000');assert.equal(row.discountPercent,'40');assert.equal(row.discountedPrice,'6000');
 assert.equal(row.legacyLine,'0 986 479 123 IC 10.000Ft/db-6000Ft/db x2 Rendelve');
 assert.equal(row.quantity,'2');
 const clear=items.parseLegacyLine('DEMO-001 IC 19.990Ft-17.000Ft Rendelve',1);
 assert.equal(clear.partNumber,'DEMO-001');assert.equal(clear.supplier,'IC');assert.equal(clear.fullPrice,'19990');assert.equal(clear.discountedPrice,'17000');
 assert.equal(clear.priceMode,'legacy');assert.ok(Number(clear.discountPercent)>9);
 items.validate([clear]);
 const unknown=items.parseLegacyLine('ABC 30.000Ft-18.00Ft Rendelve',2);
 assert.equal(unknown.fullPrice,'30000');assert.equal(unknown.discountedPrice,'');assert.ok(unknown.legacyLine.includes('18.00Ft'));
});
test('régi jegyzet átállítása idempotens; eredeti mezők és kézi összegek megmaradnak',()=>{
 const old={id:'old',title:'Ügyfél',part:'A123 IC 10000Ft-6000Ft\nB456 Láng 5000Ft-4000Ft',fullPrice:'15000',discountPrice:'10000',body:'Megjegyzés',day:'2026-11-03',updated:'2026-11-03T12:00:00Z',source:{originalText:'Eredeti teljes szöveg'}};
 const result=normalize([old],{years:[2026],days:[]});const n=result.notes[0];
 assert.equal(n.items.length,2);assert.equal(n.legacyParts,old.part);assert.equal(n.part,old.part);
 assert.deepEqual(n.legacyTotals,{fullPrice:'15000',discountedPrice:'10000'});assert.equal(n.source.originalText,old.source.originalText);
 assert.deepEqual(normalize(result.notes,{years:result.years,days:result.days}),result);
 assert.equal(items.normalizeNote({...n,items:[]}).items.length,0,'A törölt sorok nem jöhetnek vissza a korábbi mezőből');
});
test('érvénytelen tétel nem írhatja felül a mentett fájlt; számított ár megmarad újraolvasáskor',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'line-items-'));
 try{
  const file=path.join(dir,'notes.json'),row={...items.blank('a'),partNumber:'A123',fullPrice:'10000',discountPercent:'20',discountedPrice:'8000',quantity:'2',supplier:'IC'};
  const note={id:'n',title:'Ügyfél',body:'',updated:'2026-11-03T12:00:00Z',items:[row]};store.write(file,[note]);const before=fs.readFileSync(file,'utf8');
  for(const change of [{quantity:'0'},{quantity:'1.5'},{discountPercent:'101'},{discountedPrice:'1'}]){assert.throws(()=>store.write(file,[{...note,items:[{...row,...change}]}]));assert.equal(fs.readFileSync(file,'utf8'),before);}
  assert.equal(store.read(file)[0].items[0].discountedPrice,'8000');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('első táblázatos mentéskor külön másolat marad a korábbi adattárolóról',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'items-migration-'));
 try{
  const file=path.join(dir,'notes.json');const old={id:'old',title:'Ügyfél',body:'Eredeti',part:'A123 IC 10000Ft-8000Ft',fullPrice:'10000',discountPrice:'8000',updated:'2026-11-03T12:00:00Z'};
  store.write(file,[old]);const original=fs.readFileSync(file,'utf8');
  const modern=normalize([old],{years:[2026],days:[]}).notes;
  store.write(file,modern);assert.equal(fs.readFileSync(file+'.before-items-v1.json','utf8'),original);
  modern[0].title='Módosítva';store.write(file,modern);assert.equal(fs.readFileSync(file+'.before-items-v1.json','utf8'),original);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
