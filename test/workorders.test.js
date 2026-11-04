const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const M=require('../app/workorders-model'),Items=require('../app/items'),print=require('../app/workorder-print'),store=require('../app/workorders-store');
function sample(){const doc=M.blank('doc','2026-11-04',[],'row');doc.customer='Minta Ügyfél';doc.vin='WVWZZZ1KZ6W123456';doc.vehicle='Volkswagen Golf';doc.plate='ABC-123';doc.items=[{...Items.blank('row'),partNumber:'INTERNAL-SKU-998877',description:'Olajszűrő',fullPrice:'10000',discountPercent:'20',discountedPrice:'8000',quantity:'2',supplier:'BELSŐ BESZÁLLÍTÓ'}];return doc;}
test('munkalapok külön mentése és sorszámozása',()=>{
 const d=sample();assert.equal(d.number,'TA-2026-0001');assert.equal(M.blank('second','2026-11-04',[d],'r').number,'TA-2026-0002');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'workorders-'));try{const file=path.join(dir,'workorders.json');assert.deepEqual(store.read(file),[]);store.write(file,[d]);assert.deepEqual(store.read(file),[d]);const updated={...d,customer:'Módosított név'};store.write(file,[updated]);assert.deepEqual(store.read(file+'.bak'),[d]);assert.throws(()=>store.write(file,[d,{...d,id:'other'}]));assert.equal(store.read(file)[0].customer,'Módosított név');}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('a nyomtatási adatok és HTML nem tartalmazhat cikkszámot vagy belső adatot',()=>{
 const d=sample();d.internalNote='INTERNAL-SKU-998877 PRIVÁT BELSŐ TARTALOM';d.items[0].legacyLine='INTERNAL-SKU-998877 eredeti sor';d.items[0].source={path:'privát forrás'};d.publicNote='Olajszűrő INTERNAL-SKU-998877 egyeztetve';d.items[0].description='Olajszűrő (internal sku 998877)';
 const p=M.printable(d),html=print.html(d);for(const value of [JSON.stringify(p),html])for(const secret of ['INTERNAL-SKU-998877','internal sku 998877','PRIVÁT BELSŐ TARTALOM','BELSŐ BESZÁLLÍTÓ','privát forrás','legacyLine','partNumber','internalNote'])assert.ok(!value.includes(secret),secret);
 assert.equal(p.vin,'WVWZZZ1KZ6W123456');assert.equal(p.items[0].total,'16000');assert.equal(p.totals.discountedPrice,'16000');assert.ok(html.includes('Alvázszám'));assert.ok(html.includes('Minta Ügyfél'));
});
test('speciális karakteres cikkszámot is eltávolít, a tartalmat HTML-ként nem értelmezi',()=>{
 const d=sample();d.items[0].partNumber='SKU[42]/A';d.items[0].description='Szűrő SKU[42]/A';d.publicNote='<script>window.attacked=true</script>';
 const html=print.html(d);assert.ok(!html.includes('SKU[42]/A'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes("default-src 'none'"));
});
test('hiányzó ár vagy ügyfélnév mellett nem készít félrevezető ajánlatot',()=>{
 const d=sample();assert.throws(()=>M.printable({...d,customer:''}),/ügyfél/);assert.throws(()=>M.printable({...d,items:[]}),/tétel/);assert.throws(()=>M.printable({...d,items:[{...d.items[0],fullPrice:'',discountedPrice:''}]}),/árát/);
});
module.exports={sample};
test('Unicode és eltérő elválasztók mellett sem jelenik meg a megadott cikkszám',()=>{
 const d=sample();d.items[0].partNumber='ÁR-123';d.items[0].description='A\u0301R-123 szűrő';d.publicNote='ár 123 egyeztetve';const output=JSON.stringify(M.printable(d));assert.ok(!output.includes('ÁR-123'));assert.ok(!output.includes('A\u0301R-123'));assert.ok(!output.includes('ár 123'));assert.ok(output.includes('WVWZZZ1KZ6W123456'));
});
