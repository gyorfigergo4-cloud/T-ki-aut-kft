const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Items=require('../app/items'),Statuses=require('../app/note-status'),{normalize}=require('../app/archive'),store=require('../app/store'),W=require('../app/workorders-model'),workStore=require('../app/workorders-store'),print=require('../app/workorder-print');
const row=()=>({...Items.blank('row'),partNumber:'DEMO-001'});
test('a bejegyzés négy állapota külön mentődik, a korábbi jegyzet alapállapota Felírva',()=>{
 assert.deepEqual(Statuses.all.map(x=>x.label),['Megrendelve','Ajánlat','Félbehagyott','Felírva']);
 const old={id:'old',title:'Minta ügyfél',body:'Eredeti szöveg',updated:'2026-11-04T12:00:00Z',items:[row()]};
 const normalized=normalize([old],{years:[2026],days:[]}).notes[0];assert.equal(normalized.workflowStatus,'written');assert.equal(normalized.body,old.body);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'note-status-'));
 try{const file=path.join(dir,'notes.json');for(const status of Statuses.all){store.write(file,[{...normalized,workflowStatus:status.id}]);assert.equal(store.read(file)[0].workflowStatus,status.id);}
 const before=fs.readFileSync(file);assert.throws(()=>store.write(file,[{...normalized,workflowStatus:'unknown'}]),/állapot/);assert.ok(fs.readFileSync(file).equals(before));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('a kétirányú árszámítás a legutóbb szerkesztett ár vagy százalék alapján működik',()=>{
 let item=Items.edit(row(),{fullPrice:'10000'});item=Items.edit(item,{discountPercent:'20'});assert.equal(item.discountedPrice,'8000');assert.equal(item.priceMode,'auto');
 item=Items.edit(item,{discountedPrice:'7500'});assert.equal(item.discountPercent,'25');assert.equal(item.priceMode,'manual');Items.validate([item]);
 item=Items.edit(item,{fullPrice:'12000'});assert.equal(item.discountedPrice,'7500');assert.equal(item.discountPercent,'37.5');
 item=Items.edit(item,{discountPercent:'10'});assert.equal(item.discountedPrice,'10800');assert.equal(item.priceMode,'auto');
 item=Items.edit(item,{fullPrice:'10000'});assert.equal(item.discountedPrice,'9000');
 const legacy={...row(),fullPrice:'19990',discountedPrice:'17000',discountPercent:Items.discountFromPrices('19990','17000'),priceMode:'legacy'};
 const changed=Items.edit(legacy,{fullPrice:'20000'});assert.equal(changed.discountedPrice,'17000');assert.equal(changed.discountPercent,'15');Items.validate([changed]);
});
test('hiányzó ár, nulla, teljes kedvezmény, pontos kézi összeg és hibás árpár kezelése',()=>{
 let item=Items.edit(row(),{discountedPrice:'8000'});assert.equal(item.discountPercent,'');Items.validate([item]);
 item=Items.edit(item,{fullPrice:'10000'});assert.equal(item.discountPercent,'20');
 const cleared=Items.edit(item,{discountedPrice:''});assert.equal(cleared.discountPercent,'');Items.validate([cleared]);
 const zero=Items.edit(Items.edit(row(),{fullPrice:'0'}),{discountedPrice:'0'});assert.equal(zero.discountPercent,'0');Items.validate([zero]);
 assert.equal(Items.edit(item,{discountedPrice:'0'}).discountPercent,'100');
 assert.throws(()=>Items.edit(item,{discountedPrice:'11000'}),/magasabb/);
 const exact=Items.edit(Items.edit(row(),{fullPrice:'999999999999.99'}),{discountedPrice:'0.01'});Items.validate([exact]);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'manual-pricing-'));
 try{const note={id:'n',title:'Minta ügyfél',body:'',updated:'2026-11-04T12:00:00Z',items:[exact]};store.write(path.join(dir,'notes.json'),[note]);assert.equal(store.read(path.join(dir,'notes.json'))[0].items[0].discountedPrice,'0.01');assert.equal(normalize([note],{years:[2026],days:[]}).notes[0].items[0].discountedPrice,'0.01');}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('Unitrack átnevezése Unitrakra az eredeti forrássor és rendelésjelölés megőrzésével',()=>{
 const source='DEMO-001 Unitrack 10000Ft-8000Ft Rendelve',parsed=Items.parseLegacyLine(source,0);
 assert.equal(parsed.supplier,'Unitrak');assert.equal(parsed.legacyLine,source);assert.equal(parsed.ordered,true);
 assert.equal(Items.normalizeItem({...parsed,supplier:'UNITRACK'}).supplier,'Unitrak');assert.equal(Items.edit(row(),{supplier:'unitrack'}).supplier,'Unitrak');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'supplier-normalize-'));
 try{const doc=W.blank('doc','2026-11-04',[],'row');doc.customer='Minta ügyfél';doc.vin='WVWZZZ1KZ6W123456';doc.items=[Items.edit(Items.edit({...row(),supplier:'Unitrack',description:'Olajszűrő'},{fullPrice:'10000'}),{discountedPrice:'7500'})];
 const file=path.join(dir,'workorders.json');workStore.write(file,[doc]);const saved=workStore.read(file)[0];assert.equal(saved.items[0].supplier,'Unitrak');assert.equal(saved.items[0].discountPercent,'25');assert.equal(saved.items[0].discountedPrice,'7500');
 const html=print.html(saved);assert.ok(!html.includes('DEMO-001'));assert.ok(html.includes('25%'));assert.ok(html.includes('7500'));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
