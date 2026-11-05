const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Items=require('../app/items'),store=require('../app/store');
const product=id=>({...Items.blank(id),partNumber:'DEMO-'+id});
test('a megadott kedvezményes ár teli ár nélkül is összesíthető, a darabszámmal együtt',()=>{
 const item=Items.edit(product('final'),{discountedPrice:'13500'});Items.validate([item]);
 let result=Items.totals([item]);assert.equal(result.discountedPrice,'13500');assert.equal(result.discountedPriced,1);assert.equal(result.missingDiscounted,0);assert.equal(result.fullPriced,0);assert.equal(result.priced,0);assert.equal(result.missingFull,1);assert.equal(result.savings,'0');
 assert.match(Items.totalsHint(result),/hiányzik a teli ár/);assert.match(Items.totalsHint(result),/végösszeg az összes tételt/);
 result=Items.totals([Items.edit(item,{quantity:'2'})]);assert.equal(result.discountedPrice,'27000');
 const note={id:'note',title:'Minta ügyfél',body:'Eredeti megjegyzés',updated:'2026-11-05T08:00:00Z',items:[Items.edit(item,{quantity:'2'})]};Items.syncLegacy(note);assert.equal(note.fullPrice,'');assert.equal(note.discountPrice,'27000');assert.match(note.part,/Kedvezményes ár: 13500Ft/);
 const legacy=Items.parseLegacyLine(note.part,0);assert.equal(legacy.fullPrice,'');assert.equal(legacy.discountedPrice,'13500');assert.equal(legacy.quantity,'2');Items.validate([legacy]);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'partial-prices-'));
 try{const file=path.join(dir,'notes.json');store.write(file,[note]);const saved=store.read(file)[0];assert.equal(saved.discountPrice,'27000');assert.equal(saved.items[0].fullPrice,'');assert.equal(saved.items[0].discountPercent,'');assert.equal(saved.items[0].discountedPrice,'13500');}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('eltérő sorok hiányzó árait nem szabad egymásból kivonni kedvezményként',()=>{
 const paired={...Items.edit(Items.edit(product('pair'),{fullPrice:'10000'}),{discountedPrice:'8000'}),quantity:'2'};
 const onlyFinal=Items.edit(product('final'),{discountedPrice:'13500'});
 const onlyFull=Items.edit(Items.edit(product('full'),{fullPrice:'5000'}),{discountedPrice:''});
 const result=Items.totals([paired,onlyFinal,onlyFull,Items.blank('empty')]);
 assert.equal(result.fullPrice,'25000');assert.equal(result.discountedPrice,'29500');assert.equal(result.savings,'4000');assert.equal(result.priced,1);assert.equal(result.fullPriced,2);assert.equal(result.discountedPriced,2);assert.equal(result.missingFull,1);assert.equal(result.missingDiscounted,1);
 const unpaired=Items.totals([onlyFinal,onlyFull]);assert.equal(unpaired.priced,0);assert.equal(unpaired.savings,'0');assert.equal(unpaired.discountedPrice,'13500');assert.equal(unpaired.fullPrice,'5000');
 const note={items:[paired,onlyFinal,onlyFull]};Items.syncLegacy(note);assert.equal(note.fullPrice,'');assert.equal(note.discountPrice,'');
});
test('a nulla ismert ár, a hiányzó ár nem nulla; az utólag kitöltött teli ár helyesen ad kedvezményt',()=>{
 const zero=Items.edit(product('zero'),{discountedPrice:'0'}),unknown=product('unknown');
 assert.equal(Items.totals([zero]).discountedPriced,1);assert.equal(Items.totals([zero]).discountedPrice,'0');assert.equal(Items.totals([unknown]).discountedPriced,0);
 const completed=Items.edit(Items.edit(product('completed'),{discountedPrice:'13500'}),{fullPrice:'20000'});assert.equal(completed.discountPercent,'32.5');
 const result=Items.totals([completed]);assert.equal(result.fullPrice,'20000');assert.equal(result.discountedPrice,'13500');assert.equal(result.savings,'6500');assert.equal(result.missing,0);
});
