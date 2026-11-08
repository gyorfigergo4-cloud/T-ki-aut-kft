const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{randomUUID}=require('node:crypto');
const V=require('../app/vehicles'),{createDatabase}=require('../app/inventory-db');
test('vehicle oil migrates once, switches separately and selected workorder keeps its own oil',()=>{
 let n=V.normalize({oil:'Régi 5W30',vehicles:[{id:'a',vin:'VIN-A',brand:'Suzuki'},{id:'b',vin:'VIN-B',brand:'Opel'}],items:[],activeVehicleId:'a'});
 assert.equal(n.vehicles[0].oil,'Régi 5W30');assert.equal(n.vehicles[1].oil,'');n.vehicles[1].oil='0W20';n.activeVehicleId='b';assert.equal(V.selectedNote(n).oil,'0W20');
 n=V.normalize(JSON.parse(JSON.stringify(n)));assert.equal(n.vehicles[0].oil,'Régi 5W30');assert.equal(n.vehicles[1].oil,'0W20');V.remove(n,'b');assert.equal(n.activeVehicleId,'a');assert.equal(V.selectedNote(n).oil,'Régi 5W30');
});
test('four staff share stock with named, idempotent receipts and note claim corrections',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'toki-operators-'));try{const db=createDatabase(path.join(dir,'inventory.json'));db.command({type:'product',id:randomUUID(),product:{name:'Szűrő',sku:'ABC',barcodes:['123']}});const id=db.read().products[0].id;
 for(const operator of ['Anna','Béla','Csaba','Dóra']){const c={type:'receive',id:randomUUID(),productId:id,quantity:2,operator};db.command(c);db.command(c);}assert.equal(db.read().products[0].quantity,8);assert.deepEqual(new Set(db.read().movements.map(m=>m.operator)),new Set(['Anna','Béla','Csaba','Dóra']));
 const device=randomUUID();db.command({type:'claims',device,seq:1,allocations:[{id:'opaque',productId:id,quantity:3}],operator:'Anna'});db.command({type:'claims',device,seq:2,allocations:[],operator:'Béla'});assert.equal(db.read().products[0].quantity,8);assert.equal(db.read().movements[0].operator,'Béla');assert.throws(()=>db.command({type:'receive',id:randomUUID(),productId:id,quantity:1,operator:'x'.repeat(81)}));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
