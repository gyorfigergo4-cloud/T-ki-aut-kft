const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Items=require('../app/items'),store=require('../app/store'),W=require('../app/workorders-model'),print=require('../app/workorder-print');
const stamp='2026-11-04T13:37:42.123Z';
test('a rendelésjelölés tételenként tárolódik időponttal, és az ármódosítás megőrzi',()=>{
 const first={...Items.blank('one'),partNumber:'A123',fullPrice:'10000',discountPercent:'20',discountedPrice:'8000'};
 const marked=Items.withOrder(first,true,stamp);assert.equal(first.ordered,false);assert.equal(marked.ordered,true);assert.equal(marked.orderedAt,stamp);
 const edited=Items.edit(marked,{quantity:'3',supplier:'IC'});assert.equal(edited.orderedAt,stamp);assert.equal(Items.totals([edited]).discountedPrice,'24000');
 assert.deepEqual(Items.orderCounts([edited,{...Items.blank('two'),partNumber:'B456'},Items.blank('empty')]),{ordered:1,total:2});
 const unset=Items.withOrder(marked,false);assert.equal(unset.ordered,false);assert.equal(unset.orderedAt,'');
 assert.throws(()=>Items.withOrder(Items.blank('empty'),true,stamp),/cikkszámot/);
 assert.throws(()=>Items.withOrder(first,true,'hibás dátum'),/időpont/);
 assert.throws(()=>Items.validate([{...marked,ordered:false}]),/időpont/);
});
test('más cikkszámra vagy név szerinti másik termékre a korábbi rendelésjelölés nem vihető át véletlenül',()=>{
 const marked=Items.withOrder({...Items.blank('one'),partNumber:'AB 123'},true,stamp);
 const same=Items.edit(marked,{partNumber:'ab123'});assert.equal(same.ordered,true);assert.equal(same.orderedAt,stamp);
 const changed=Items.edit(marked,{partNumber:'AB124'});assert.equal(changed.ordered,false);assert.equal(changed.orderedAt,'');
 const named=Items.withOrder({...Items.blank('named'),description:'Olajszűrő'},true,stamp);
 assert.equal(Items.edit(named,{description:'Levegőszűrő'}).ordered,false);
});
test('korábbi egyértelmű Rendelve sorok felismerése kitalált időpont nélkül, kézi visszavonással',()=>{
 const line='A123 IC 10.000Ft-8000Ft Rendelve';
 const parsed=Items.parseLegacyLine(line,0);assert.equal(parsed.ordered,true);assert.equal(parsed.orderedAt,'');assert.equal(parsed.legacyLine,line);
 const old={...parsed};delete old.ordered;delete old.orderedAt;
 assert.deepEqual(Items.order(old),{ordered:true,orderedAt:''});assert.equal(Items.normalizeNote({items:[old]}).items[0].ordered,true);
 assert.equal(Items.order({...old,ordered:false}).ordered,false);
 for(const text of ['A123 IC 10.000Ft-8000Ft Nincs rendelve','A123 még nem megrendelve','A123 rendelve lesz','A123 Rendelve?'])assert.equal(Items.parseLegacyLine(text,0).ordered,false,text);
 const unmarked=Items.withOrder(old,false);assert.equal(Items.order(unmarked).ordered,false);
});
test('mentés és újranyitás megőrzi a jelölést, az ügyfélnek készülő dokumentum nem kapja meg',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'order-status-'));
 try{
  const item=Items.withOrder({...Items.blank('one'),partNumber:'INTERNAL-ORDER-SKU',description:'Olajszűrő',fullPrice:'10000',discountPercent:'20',discountedPrice:'8000'},true,stamp);
  const note={id:'note',title:'Minta ügyfél',body:'Eredeti tartalom',day:'2026-11-04',updated:stamp,items:[item]};Items.syncLegacy(note);assert.match(note.part,/Rendelve/);
  store.write(path.join(dir,'notes.json'),[note]);const saved=store.read(path.join(dir,'notes.json'))[0];assert.equal(saved.items[0].orderedAt,stamp);assert.equal(saved.items[0].ordered,true);
  const doc=W.blank('doc','2026-11-04',[],'row');doc.customer='Minta ügyfél';doc.vin='WVWZZZ1KZ6W123456';doc.items=[item];
  const printable=JSON.stringify(W.printable(doc)),html=print.html(doc);
  for(const text of [printable,html])for(const internal of ['INTERNAL-ORDER-SKU',stamp,'orderedAt','Megrendelve'])assert.ok(!text.includes(internal),internal);
  assert.ok(html.includes('Olajszűrő'));assert.ok(html.includes('WVWZZZ1KZ6W123456'));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
