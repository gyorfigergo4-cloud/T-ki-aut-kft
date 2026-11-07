const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {createDatabase}=require('../app/inventory-db'),{createService}=require('../app/inventory-service'),Items=require('../app/items'),Store=require('../app/store');
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'toki-stock-'));
function product(db,sku='000123'){db.command({type:'product',id:randomUUID(),product:{name:'Olajszűrő',sku,barcodes:['0590001234567']}});return db.read().products[0];}
function receive(db,p,n,id=randomUUID()){return db.command({type:'receive',id,productId:p.id,quantity:n});}
const claims=(device,seq,productId,quantity)=>({type:'claims',device,seq,allocations:quantity?[{id:'opaque-item',productId,quantity}]:[]});
test('négy gép közös készlete: eladás, mennyiségi korrekció, pipa kivétele, ismétlés és elégtelen készlet',()=>{
 const dir=tmp();try{const db=createDatabase(path.join(dir,'stock.json')),p=product(db);receive(db,p,10);const devices=Array.from({length:4},randomUUID);
 for(const d of devices)db.command(claims(d,1,p.id,2));assert.equal(db.read().products[0].quantity,2);
 const revision=db.read().revision;db.command(claims(devices[0],1,p.id,2));assert.equal(db.read().revision,revision);
 db.command(claims(devices[0],2,p.id,3));assert.equal(db.read().products[0].quantity,1);
 const before=fs.readFileSync(path.join(dir,'stock.json'));assert.throws(()=>db.command(claims(devices[1],2,p.id,4)),/Nincs elegendő/);assert.ok(before.equals(fs.readFileSync(path.join(dir,'stock.json'))));
 db.command(claims(devices[0],3,p.id,0));assert.equal(db.read().products[0].quantity,4);assert.throws(()=>db.command(claims(devices[0],2,p.id,2)),/Régi/);assert.throws(()=>db.command({...claims(devices[2],2,p.id,1),name:'PRIVÁT ÜGYFÉL'}),/Csak készlet/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('bevételezés újraküldése nem dupláz, vonalkód és cikkszám egyedi, aktív készlet nem törölhető',()=>{
 const dir=tmp();try{const db=createDatabase(path.join(dir,'stock.json')),p=product(db),id=randomUUID();receive(db,p,3,id);receive(db,p,3,id);assert.equal(db.read().products[0].quantity,3);assert.throws(()=>db.command({type:'product',id:randomUUID(),product:{name:'Ütköző',sku:'OTHER',barcodes:[p.sku]}}),/már másik/);assert.throws(()=>receive(db,p,4,id),/Eltérő/);assert.throws(()=>db.command({type:'product',id:randomUUID(),product:{name:'Más',sku:'OTHER',barcodes:p.barcodes}}),/már másik/);assert.throws(()=>db.command({type:'delete',id:randomUUID(),productId:p.id}),/nem törölhető/);assert.throws(()=>db.command({type:'adjust',id:randomUUID(),productId:p.id,quantity:-4,reason:'Leltár'}));assert.equal(db.read().products[0].quantity,3);
 const before=fs.readFileSync(path.join(dir,'stock.json'));fs.writeFileSync(path.join(dir,'stock.json'),'hibás');assert.throws(()=>createDatabase(path.join(dir,'stock.json')));assert.equal(fs.readFileSync(path.join(dir,'stock.json'),'utf8'),'hibás');assert.ok(before.length);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('megszakadt helyi jegyzetmentés újraindítás után helyreáll, stocklevonás egyszer történik, személyes adat nem kerül a raktárfájlba',async()=>{
 const dir=tmp();let fail=true;try{const file=path.join(dir,'notes.json');Store.write(file,[]);const db=createDatabase(path.join(dir,'shared-inventory','inventory.json')),p=product(db);receive(db,p,10);
 const note={id:'n',title:'PRIVÁT ÜGYFÉL',body:'TITKOS JEGYZET',updated:'2026-11-07T08:00:00Z',items:[{...Items.blank('i'),partNumber:p.sku,quantity:'2',fromStock:true,stockProductId:p.id}]};
 let service=createService(dir,{readNotes:()=>Store.read(file),writeNotes:n=>{if(fail)throw Error('disk');Store.write(file,n);}});
 await assert.rejects(service.saveNotes(()=>[note]),/disk/);assert.equal(db.read().products[0].quantity,8);assert.equal(service.hasPending(),true);assert.deepEqual(Store.read(file),[]);fail=false;
 service=createService(dir,{readNotes:()=>Store.read(file),writeNotes:n=>Store.write(file,n)});await service.recover();assert.equal(db.read().products[0].quantity,8);assert.equal(Store.read(file)[0].body,'TITKOS JEGYZET');assert.equal(service.hasPending(),false);
 await service.saveNotes(notes=>notes.map(n=>({...n,items:n.items.map(i=>({...i,quantity:'4'}))})));assert.equal(db.read().products[0].quantity,6);
 await service.saveNotes(notes=>notes.map(n=>({...n,items:n.items.map(i=>({...i,fromStock:false}))})));assert.equal(db.read().products[0].quantity,10);
 assert.doesNotMatch(fs.readFileSync(path.join(dir,'shared-inventory','inventory.json'),'utf8'),/PRIVÁT|TITKOS|notes\.json/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('normál jegyzetmentéshez nem kell raktárkapcsolat; nem jelölt tételek nem vonnak készletet',async()=>{
 const dir=tmp();try{fs.writeFileSync(path.join(dir,'garage-network.json'),JSON.stringify({mode:'client',host:'127.0.0.1',port:51000,token:'a'.repeat(32)}));const file=path.join(dir,'notes.json');Store.write(file,[]);const s=createService(dir,{readNotes:()=>Store.read(file),writeNotes:n=>Store.write(file,n)});await s.saveNotes(()=>[{id:'n',title:'Saját',body:'offline is jó',updated:'2026-11-07T08:00:00Z',items:[Items.blank('i')]}]);assert.equal(Store.read(file)[0].body,'offline is jó');assert.equal(fs.existsSync(path.join(dir,'shared-inventory')),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
