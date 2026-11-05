const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Vehicles=require('../app/vehicles'),Items=require('../app/items'),{normalize}=require('../app/archive'),store=require('../app/store');
const vinA='WVWZZZ1KZ6W123456',vinB='WBAHT71010G123456';
const item=id=>({...Items.blank(id),partNumber:'SAME-SKU',fullPrice:'10000',discountPercent:'20',discountedPrice:'8000',ordered:true,orderedAt:'2026-11-05T08:00:00.000Z',paid:true});
const note=()=>({id:'customer',title:'Minta ügyfél',phone:'+36 30 123 4567',body:'Eredeti közös megjegyzés',vin:vinA+' / '+vinB,updated:'2026-11-05T08:00:00Z',vehicles:[{id:'car-a',vin:vinA,brand:'Volkswagen'},{id:'car-b',vin:vinB,brand:'BMW'}],items:[item('one'),item('two')],source:{originalText:'Eredeti szöveg'}});
test('régi egyautós jegyzet hozzárendelése egyértelmű, többautós tételeket közös listán őriz meg',()=>{
 const multi=note(),single={...note(),vehicles:[note().vehicles[0]],vin:vinA};
 const one=normalize([single],{years:[],days:[]}).notes[0];assert.equal(one.activeVehicleId,'car-a');assert.ok(one.items.every(row=>row.vehicleId==='car-a'));
 const many=normalize([multi],{years:[],days:[]}).notes[0];assert.equal(many.activeVehicleId,'');assert.ok(many.items.every(row=>row.vehicleId===''));assert.equal(many.items.length,2);assert.equal(many.source.originalText,multi.source.originalText);assert.equal(many.items[0].orderedAt,multi.items[0].orderedAt);assert.equal(many.items[0].paid,true);
 assert.deepEqual(normalize([many],{years:[2024,2025,2026],days:[many.day]}).notes[0],many);
 const explicit=Vehicles.normalize({...single,items:[{...item('already'),vehicleId:''}]});assert.equal(explicit.items[0].vehicleId,'','szándékosan közös sor nem sorolható át automatikusan');
});
test('azonos cikkszám két autón külön mennyiséggel, árral, rendelési és fizetési állapottal',()=>{
 const data=Vehicles.normalize(note());data.items[0].vehicleId='car-a';data.items[1].vehicleId='car-b';data.activeVehicleId='car-a';data.items[1]=Items.edit(data.items[1],{quantity:'3',discountedPrice:'7000'});data.items[1].paid=false;data.items[1]=Items.withOrder(data.items[1],false);
 assert.equal(Vehicles.itemsFor(data).length,1);assert.equal(Items.totals(Vehicles.itemsFor(data)).discountedPrice,'8000');data.activeVehicleId='car-b';assert.equal(Items.totals(Vehicles.itemsFor(data)).discountedPrice,'21000');assert.equal(data.items[0].paid,true);assert.equal(data.items[0].ordered,true);assert.equal(data.items[0].discountedPrice,'8000');
 data.vehicles[1].vin='Javított alvázszám';assert.equal(Vehicles.itemsFor(data)[0].id,'two');assert.equal(Vehicles.findSelection(data,'Javított alvázszám'),'car-b');
 const snapshot=Vehicles.selectedNote(data);assert.equal(snapshot.vehicles.length,1);assert.equal(snapshot.vin,'Javított alvázszám');assert.equal(snapshot.vehicle,'BMW');assert.equal(snapshot.items.length,1);assert.equal(snapshot.items[0].id,'two');assert.equal(snapshot.phone,data.phone);
});
test('autó törlésekor a tételek és jelölések megmaradnak a hozzárendelés nélküli listában',()=>{
 const data=Vehicles.normalize(note());data.items[0].vehicleId='car-a';data.items[1].vehicleId='car-b';data.activeVehicleId='car-a';const before={...data.items[0]};assert.equal(Vehicles.remove(data,'car-a'),1);assert.equal(data.activeVehicleId,'');assert.equal(data.vehicles.length,1);assert.deepEqual(Vehicles.itemsFor(data)[0],{...before,vehicleId:''});assert.equal(data.items[1].vehicleId,'car-b');assert.equal(data.vin,vinB);assert.equal(Vehicles.normalize(data).items[0].vehicleId,'');
});
test('hozzárendelés és kiválasztott autó mentése, érvénytelen hivatkozás nem írja felül a fájlt',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'toki-vehicle-items-'));
 try{const file=path.join(dir,'notes.json'),data=Vehicles.normalize(note());data.items[0].vehicleId='car-a';data.items[1].vehicleId='car-b';data.activeVehicleId='car-b';store.write(file,[data]);assert.deepEqual(store.read(file),[data]);const before=fs.readFileSync(file);
 for(const bad of [{...data,activeVehicleId:'missing'},{...data,items:[{...data.items[0],vehicleId:'missing'}]},{...data,items:[{...data.items[0],vehicleId:12}]}]){assert.throws(()=>store.write(file,[bad]));assert.ok(before.equals(fs.readFileSync(file)));}
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
