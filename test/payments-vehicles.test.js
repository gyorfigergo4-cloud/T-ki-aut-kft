const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Items=require('../app/items'),Vehicles=require('../app/vehicles'),{normalize}=require('../app/archive'),store=require('../app/store'),W=require('../app/workorders-model'),workStore=require('../app/workorders-store'),print=require('../app/workorder-print');
const vin1='WVWZZZ1KZ6W123456',vin2='WBAHT71010G123456';
const row=id=>({...Items.blank(id),partNumber:'DEMO-'+id,fullPrice:'10000',discountPercent:'20',discountedPrice:'8000'});
test('soronkénti és együttes fizetésjelölés, részleges állapot és üres sorok kezelése',()=>{
 const items=[row('one'),row('two'),Items.blank('empty')];
 const marked=[Items.withPaid(items[0],true),items[1],items[2]];assert.equal(items[0].paid,false);
 assert.deepEqual(Items.paymentState(marked),{paid:false,partial:true,paidCount:1,total:2});
 const all=Items.setAllPaid(marked,true);assert.equal(all[0].paid,true);assert.equal(all[1].paid,true);assert.equal(all[2].paid,false);assert.equal(Items.paymentState(all).paid,true);
 const cleared=Items.setAllPaid(all,false);assert.equal(Items.paymentState(cleared).partial,false);assert.equal(Items.paymentState(cleared).paid,false);
 assert.equal(Items.paymentState([],true).paid,true);assert.equal(Items.paymentState([Items.blank('blank')],true).paid,true);
 assert.throws(()=>Items.withPaid(Items.blank('empty'),true));assert.throws(()=>Items.validate([{...row('bad'),paid:'yes'}]),/fizetés/);
 const changed=Items.edit(all[0],{partNumber:'OTHER-PART'});assert.equal(changed.paid,false);assert.equal(Items.edit(all[0],{quantity:'3'}).paid,true);
 assert.equal(Items.totals(all).discountedPrice,'16000');assert.equal(all[0].ordered,false);
});
test('régi alvázszámok és eredeti szöveg megőrzése, ismételhető átállítás',()=>{
 const old={id:'legacy',title:'Minta ügyfél',body:'Eredeti jegyzet',vin:vin1+' / '+vin2,updated:'2026-11-05T08:00:00Z',source:{originalText:'Eredeti forrás'}};
 const data=normalize([old],{years:[2026],days:[]});assert.equal(data.notes[0].vin,old.vin);assert.equal(data.notes[0].vehicles.length,2);assert.equal(data.notes[0].vehicles[0].vin,vin1);assert.equal(data.notes[0].vehicles[1].vin,vin2);assert.equal(data.notes[0].source.originalText,old.source.originalText);assert.equal(data.notes[0].paid,false);
 assert.deepEqual(normalize(data.notes,{years:data.years,days:data.days}),data);
 assert.equal(Vehicles.get({vin:'1963-AS-FRAME'})[0].vin,'1963-AS-FRAME');assert.deepEqual(Vehicles.get({vin:vin1,vehicles:[]}),[]);
});
test('433 márka, ismert névváltozatok és saját márka szabad megadása',()=>{
 assert.ok(Vehicles.brands.length>=400);assert.equal(Vehicles.normalizeBrand('vw'),'Volkswagen');assert.equal(Vehicles.normalizeBrand('Skoda'),'Škoda');assert.equal(Vehicles.normalizeBrand('Mercedes'),'Mercedes-Benz');assert.equal(Vehicles.normalizeBrand(''),'');assert.equal(Vehicles.normalizeBrand('Saját márka'),'Saját márka');
 const note={vin:'',vehicles:[{id:'first',vin:vin1,brand:'Volkswagen'},{id:'second',vin:vin2,brand:'Saját márka'}]};Vehicles.validate(note.vehicles);Vehicles.sync(note);assert.equal(note.vin,vin1+' / '+vin2);assert.ok(Vehicles.searchText(note).includes('Saját márka'));assert.deepEqual(Vehicles.quoteInfo(note),{vin:vin1+' / '+vin2,vehicle:'Volkswagen / Saját márka'});
 note.vehicles.splice(0,1);Vehicles.sync(note);assert.equal(note.vin,vin2);note.vehicles=[];Vehicles.sync(note);assert.equal(note.vin,'');
 assert.throws(()=>Vehicles.validate([{id:'same',vin:vin1,brand:''},{id:'same',vin:vin2,brand:''}]),/jármű|alváz/);
});
test('fizetési és járműadatok mentése, hibás adat nem írja felül a jegyzetet',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paid-vehicles-'));
 try{const note={id:'note',title:'Minta ügyfél',body:'Eredeti tartalom',updated:'2026-11-05T08:00:00Z',workflowStatus:'quote',items:Items.setAllPaid([row('one'),row('two')],true),paid:true,vehicles:[{id:'a',vin:vin1,brand:'Ford'},{id:'b',vin:vin2,brand:'BMW'}]};Vehicles.sync(note);Items.syncLegacy(note);
 const file=path.join(dir,'notes.json');store.write(file,[note]);const saved=store.read(file)[0];assert.equal(saved.paid,true);assert.equal(saved.items[1].paid,true);assert.equal(saved.vehicles[1].brand,'BMW');assert.equal(saved.workflowStatus,'quote');assert.equal(saved.discountPrice,'16000');const before=fs.readFileSync(file);
 for(const change of [{paid:'yes'},{vehicles:[{id:'x',vin:42,brand:'Ford'}]}]){assert.throws(()=>store.write(file,[{...note,...change}]));assert.ok(fs.readFileSync(file).equals(before));}
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('munkalap mindkét járművet átveszi, fizetési pipák és cikkszámok nem kerülnek a nyomtatásba',()=>{
 const doc=W.blank('doc','2026-11-05',[],'row');doc.customer='Minta ügyfél';Object.assign(doc,Vehicles.quoteInfo({vehicles:[{id:'a',vin:vin1,brand:'Volkswagen'},{id:'b',vin:vin2,brand:'BMW'}]}));doc.items=Items.setAllPaid([row('HIDDEN-ONE'),row('HIDDEN-TWO')],true);doc.paid=true;
 const html=print.html(doc);for(const secret of ['DEMO-HIDDEN-ONE','DEMO-HIDDEN-TWO','Fizetve','"paid"'])assert.ok(!html.includes(secret),secret);assert.ok(html.includes(vin1));assert.ok(html.includes(vin2));assert.ok(html.includes('Volkswagen / BMW'));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paid-docs-'));try{const file=path.join(dir,'workorders.json');workStore.write(file,[doc]);assert.equal(workStore.read(file)[0].paid,true);assert.equal(workStore.read(file)[0].items[0].paid,true);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
