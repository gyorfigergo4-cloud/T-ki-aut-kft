const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Model=require('../app/garage-model'),Store=require('../app/garage-store');
const map={name:0,vehicle:1,vin:2,plate:3};let seq=0;const id=()=>String(++seq);
test('Excel TSV: idézőjelek, tabok, sortörések és magyar nevek megmaradnak',()=>{
 assert.deepEqual(Model.table('Név\tAutó\r\n"Kovács ""Péter"""\t"Škoda\nOctavia"\r\n'),[['Név','Autó'],['Kovács "Péter"','Škoda\nOctavia']]);
 assert.throws(()=>Model.table('"befejezetlen'));
});
test('azonos név több autóval, ismételt import és üres név kitöltése',()=>{
 const rows=Model.table('Név\tAutó\tAlvázszám\tRendszám\nKovács Péter\tGolf\tVIN1\tABC-123\n\tOctavia\tVIN2\tXYZ-456');
 const result=Model.importRows([],rows,map,true,true,id);assert.equal(result.added,2);assert.equal(result.people.length,1);assert.equal(result.people[0].cars.length,2);
 const again=Model.importRows(result.people,rows,map,true,true,id);assert.equal(again.added,0);assert.equal(again.skipped,2);assert.deepEqual(again.people,result.people);
 assert.throws(()=>Model.importRows([],rows,map,true,false,id),/hiányzik a név/);
});
test('hibás sor és párosítás esetén nincs részleges beolvasás, eredeti adatok megmaradnak',()=>{
 const original=[{id:'p',name:'Péter',cars:[]}];
 assert.throws(()=>Model.importRows(original,[['Másik','Golf'],['','Octavia']],map,false,false,id));assert.equal(original.length,1);
 assert.throws(()=>Model.importRows(original,[['Péter','Golf']],{...map,vin:1},false,false,id),/külön oszlopot/);
 assert.throws(()=>Model.validate([{id:'p',name:'',cars:[]}]),/név/);
});
test('helyi tároló: újranyitás, módosítás, törlés, biztonsági másolat és sérült fájl védelme',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'garage-')),file=path.join(dir,'garage.json');
 try{assert.deepEqual(Store.read(file),[]);const people=Model.importRows([],[['Péter','Golf','VIN1','ABC-123']],map,false,false,id).people;
 Store.write(file,people);assert.deepEqual(Store.read(file),people);people[0].cars[0].plate='XYZ-456';Store.write(file,people);assert.equal(Store.read(file)[0].cars[0].plate,'XYZ-456');
 assert.equal(Store.read(file+'.bak')[0].cars[0].plate,'ABC-123');assert.throws(()=>Store.write(file,[{}]));assert.deepEqual(Store.read(file),people);
 Store.write(file,[]);assert.deepEqual(Store.read(file),[]);fs.writeFileSync(file,'hibás');assert.throws(()=>Store.read(file));assert.equal(fs.readFileSync(file,'utf8'),'hibás');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
