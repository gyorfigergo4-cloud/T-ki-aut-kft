const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{randomUUID}=require('node:crypto'),{EventEmitter}=require('node:events');
const {createCatalog}=require('../app/filter-catalog'),{run}=require('../app/filter-catalog-worker'),{createDatabase}=require('../app/inventory-db'),{createJob}=require('../app/filter-catalog-job');
const fixture=()=>({version:1,meta:{source:'Szintetikus teszt',year:2019},records:[{id:'a',brand:'Minta Filter',sku:'OF 001',category:'oil'},{id:'b',brand:'Minta Filter',sku:'AF-001',category:'air'},{id:'c',brand:'Más gyártó',sku:'CF-001',category:'cabin'}]});
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'toki-catalog-'));
test('katalógus különálló, ékezet- és szóközfüggetlen keresés, típus és lapozás; készlet nélkül',()=>{
 const dir=tmp();try{const c=createCatalog(dir);assert.equal(c.search({query:'OF001'}).total,0);c.install(fixture());assert.equal(c.search({query:'of001'}).rows[0].sku,'OF 001');assert.equal(c.search({query:'pollenszuro'}).rows[0].category,'cabin');assert.equal(c.search({category:'air'}).total,1);assert.equal(c.search({offset:2}).rows.length,1);assert.equal(fs.existsSync(path.join(dir,'inventory.json')),false);
 const before=fs.readFileSync(c.file);assert.throws(()=>c.install({...fixture(),records:[]}));assert.throws(()=>c.install({...fixture(),notes:[{title:'MAGÁN'}]}));assert.throws(()=>c.install({...fixture(),records:[{...fixture().records[0],quantity:12}]}));assert.ok(before.equals(fs.readFileSync(c.file)));assert.equal(JSON.parse(c.export()).records.length,3);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('darabolt forrás feldolgozása UTF-8 és sorhatáron át, csak valódi érvényes szűrők, vezető nulla megmarad',async()=>{
 const dir=tmp();try{const row=(id,sku,cat,valid='1',pseudo='0')=>[id,sku,'4',cat,'English name',...Array(13).fill('0'),pseudo,valid,...Array(7).fill('')].join('\t')+'\n';
 const data=Buffer.from(row('1','000123','7')+row('2','AF 01','8')+row('3','CF01','424')+row('4','BRAKE','70')+row('5','BAD','7','0')+row('6','PSEUDO','7','1','1'));const cut=37;
 const chunks=[data.subarray(0,cut),data.subarray(cut)];const output=path.join(dir,'out.json');const fetcher=async url=>url.endsWith('suppliers.csv')?{ok:true,text:async()=> '1118\t4\t423\tMinta Á Filter\t1\t0\tBrand'}:{ok:true,body:(async function*(){const n=Number(url.slice(-3));for(let i=0;i<chunks[n].length;i+=7)yield chunks[n].subarray(i,i+7);})()};
 const result=await run({output,base:'https://fixture.invalid/',parts:2,fetcher});const d=JSON.parse(fs.readFileSync(output));assert.equal(result.count,3);assert.equal(d.records[0].sku,'000123');assert.equal(d.records[0].brand,'Minta Á Filter');assert.deepEqual(d.meta.categories,{oil:1,air:1,cabin:1});assert.ok(d.records.every(r=>!Object.hasOwn(r,'quantity')));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('vonalkód hozzárendelése megőrzi a készletet, többi kódot és ismétléskor sem dupláz',()=>{
 const dir=tmp();try{const db=createDatabase(path.join(dir,'stock.json'));db.command({type:'product',id:randomUUID(),product:{name:'Meglévő saját név',sku:'OF001',barcodes:['000OLD'],brand:'Minta'}});const p=db.read().products[0];db.command({type:'receive',id:randomUUID(),productId:p.id,quantity:5});const c={type:'link-barcode',id:randomUUID(),productId:p.id,barcode:'000NEW',catalogId:'cat-a'};db.command(c);db.command(c);assert.equal(db.read().products[0].quantity,5);assert.deepEqual(db.read().products[0].barcodes,['000OLD','000NEW']);assert.equal(db.read().products[0].name,'Meglévő saját név');assert.equal(db.read().movements.length,1);assert.throws(()=>db.command({...c,id:randomUUID(),barcode:'OTHER',catalogId:'cat-b'}),/másik/);assert.equal(db.read().products[0].quantity,5);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('háttérletöltés csak kész és validált listát telepít; hiba vagy leállítás megtartja a korábbit',()=>{
 const dir=tmp();try{const c=createCatalog(dir);c.install(fixture());let child;const job=createJob({dir:path.join(dir,'tmp'),catalog:c,fork:()=>{child=new EventEmitter();child.postMessage=input=>{child.input=input;};child.kill=()=>child.emit('exit',0);return child;}});job.start();child.emit('spawn');assert.ok(job.status().running);child.emit('message',{type:'error',error:'Hálózati hiba'});assert.equal(job.status().running,false);assert.equal(c.meta().count,3);
 job.start();child.emit('spawn');const out=child.input.output;fs.writeFileSync(out,JSON.stringify({...fixture(),records:[fixture().records[0]]}));child.emit('message',{type:'complete',data:{file:out}});assert.equal(c.meta().count,1);job.start();child.emit('spawn');job.cancel();assert.equal(c.meta().count,1);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
