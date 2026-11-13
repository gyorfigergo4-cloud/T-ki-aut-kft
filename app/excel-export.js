// XLSX export contains only the explicitly selected source. Never writes app data.
const Excel = require('exceljs');
const Items = require('./items');
const Pricing = require('./inventory-pricing');
const Categories = require('./inventory-categories');
const Status = require('./note-status');
const { normalize } = require('./archive');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');

function workbook(kind, data) {
 const book = new Excel.Workbook(); book.creator = 'Töki Autó Kft.';
 let overflow;
 function sheet(name, headers) {
  const s = book.addWorksheet(name, {views:[{state:'frozen',ySplit:1}]});
  s.columns = headers.map(header=>({header,width:header.includes('szám')?25:22}));
  s.getRow(1).font={bold:true,color:{argb:'FF354527'}};s.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE8F1D9'}};
  s.autoFilter={from:{row:1,column:1},to:{row:1,column:headers.length}};
  return s;
 }
 function add(s, values) {
  if(s.rowCount>=1048576)throw Error('Túl sok sor egy Excel-munkalaphoz. Válassz kisebb adatkört.');
  const row=s.rowCount+1;
  s.addRow(values.map((v,i)=>{
   if(v===undefined||v===null)return '';
   // Plain strings, including leading =/+/-/@, never become formulas or links.
   if(typeof v==='string'&&v.length>32000){
    overflow ||= sheet('Hosszú szövegek',['Munkalap','Sor','Oszlop','Rész sorszáma','Szöveg']);
    for(let start=0,part=1;start<v.length;part++){
     let end=Math.min(start+32000,v.length);if(end<v.length&&/[\uD800-\uDBFF]/.test(v[end-1]))end--;
     overflow.addRow([s.name,row,i+1,part,v.slice(start,end)]);start=end;
    }
    return 'A teljes szöveg a Hosszú szövegek munkalapon található.';
   }
   return v;
  }));
 }
 const yes = v=>v===true?'Igen':'Nem';
 const number = v=>v===''||v===undefined?'':Number(String(v).replace(',','.'));
 // Excel keeps only 15 significant digits. Larger money values stay exact text.
 const moneyCell = v=>v===undefined||v===null||v===''?'':String(v).replace('.','').replace(/^0+/,'').length>15?String(v):Number(v);
 function valuationSheet(data){
  const summary=sheet('Készletérték összesítés',['Adatkör','Teli érték (Ft)','Kedvezmény (Ft)','Kedvezményes érték (Ft)','Hiányzó árú pozitív készletű tételek','Még nincs számolva','Értékelt / számolt tételek','Árak alapja']);
  for(const [label,value]of [['Teljes nyilvántartott raktár',data.warehouseValuation],['Megszámolt készlet',data.countedValuation]])add(summary,[label,moneyCell(value?.fullValue),moneyCell(value?.savings),moneyCell(value?.discountedValue),value?.missingPrices??'',value?.uncounted??'',value?.counted??'',data.legacyPricing?'Régi ellenőrzés: az árak nem rögzítettek':data.session?.closedAt?'Lezáráskori árak és készlet':'Aktuális árak és készlet']);
 }
 const itemHeaders=['Tételazonosító','Cikkszám','Megnevezés','Teli ár (Ft/db)','Kedvezmény (%)','Kedvezményes ár (Ft/db)','Db','Beszállító','Megrendelve','Rendelés időpontja','Fizetve','Felírva','Megérkezett','Raktárról','Raktári termékazonosító'];
 const itemValues=i=>[i.id,i.partNumber,i.description||'',number(i.fullPrice),number(i.discountPercent),number(i.discountedPrice),number(i.quantity),i.supplier,yes(Items.order(i).ordered),Items.order(i).orderedAt,yes(i.paid),yes(i.recorded),yes(i.arrived),yes(i.fromStock),i.stockProductId||''];
 if(kind==='notes'){
  require('./store').validate(data);
  const notes=normalize(data,{years:[],days:[]}).notes;
  const main=sheet('Jegyzetek',['Bejegyzésazonosító','Dátum','Név','Telefonszám','Állapot','Olaj','Jegyzet','Módosítva']);
  const cars=sheet('Járművek',['Bejegyzésazonosító','Dátum','Név','Járműazonosító','Autómárka','Alvázszám','Olaj']);
  const items=sheet('Cikkszámok',['Bejegyzésazonosító','Dátum','Név','Járműazonosító','Autómárka','Alvázszám',...itemHeaders]);
  const reminders=sheet('Emlékeztetők',['Bejegyzésazonosító','Név','Emlékeztetőazonosító','Szöveg','Kész','Létrehozva','Ébresztő (ISO)','Szundi (ISO)']);
  for(const n of notes){
   add(main,[n.id,n.day,n.title,n.phone||'',Status.get(n).label,n.oil||'',n.body,n.updated]);
   for(const v of n.vehicles)add(cars,[n.id,n.day,n.title,v.id,v.brand,v.vin,v.oil||'']);
   for(const i of n.items){const v=n.vehicles.find(v=>v.id===i.vehicleId);add(items,[n.id,n.day,n.title,i.vehicleId||'',v?.brand||'',v?.vin||'',...itemValues(i)]);}
   for(const r of n.reminders||[])add(reminders,[n.id,n.title,r.id,r.text,yes(r.done),r.createdAt,r.dueAt||'',r.snoozedUntil||'']);
  }
 }else if(kind==='workorders'){
  require('./workorders-model').validate(data);
  const main=sheet('Munkalapok',['Azonosító','Sorszám','Típus','Dátum','Név','Telefon','Autó','Alvázszám','Rendszám','Érvényesség','Ügyfélmegjegyzés','Belső megjegyzés','Fizetve']);
  const items=sheet('Tételek',['Munkalapazonosító','Sorszám','Név',...itemHeaders]);
  for(const d of data){add(main,[d.id,d.number,d.kind==='quote'?'Árajánlat':'Munkalap',d.day,d.customer,d.phone,d.vehicle,d.vin,d.plate,d.validUntil,d.publicNote,d.internalNote,yes(Items.paymentState(d.items,d.paid).paid)]);for(const i of d.items)add(items,[d.id,d.number,d.customer,...itemValues(i)]);}
 }else if(kind==='garage'){
  require('./garage-model').validate(data);
  const main=sheet('Autónyilvántartó',['Névazonosító','Név','Autóazonosító','Autó','Alvázszám','Rendszám']);
  for(const p of data){if(!p.cars.length)add(main,[p.id,p.name,'','','','']);for(const c of p.cars)add(main,[p.id,p.name,c.id,c.vehicle,c.vin,c.plate]);}
 }else if(kind==='stocktake'){
  if(!data?.session||!Array.isArray(data.rows))throw Error('Hibás leltárjelentés.');const info=sheet('Ellenőrzés',['Név','Indítva','Indította','Lezárva','Lezárta']);add(info,[data.session.title,data.session.createdAt,data.session.createdBy,data.session.closedAt||'',data.session.closedBy||'']);const s=sheet('Leltár eltérések',['Cikkszám','Termék','Induló készlet','Számolt db','Eltérés','Aktuális / záró készlet','Közben készletmozgás','Utoljára számolta','Számolás ideje','Beolvasott kódok','Teli ár (Ft/db)','Kedvezmény (%)','Kedvezményes ár (Ft/db)','Számolt kedvezményes érték (Ft)','Tételtípus']);for(const r of data.rows)add(s,[r.sku,r.name,r.expected,r.quantity??'',r.difference??'',r.currentQuantity??'',r.stockChanged?'Igen':'Nem',r.updatedBy||'',r.updatedAt||'',(r.scannedCodes||[]).join(' / '),moneyCell(r.fullPrice),number(r.discountPercent),moneyCell(r.discountedPrice),moneyCell(r.discountedValue),Categories.label(r.category)]);valuationSheet(data);
 }else if(kind==='inventory'){
  if(!data||!Array.isArray(data.products)||!Array.isArray(data.movements))throw Error('Hibás raktáradat.');
  const main=sheet('Raktár',['Termékazonosító','Terméknév','Cikkszám','Vonalkódok','Készlet (db)','Raktári hely','Hely pontosítása','Tételtípus','Ár (Ft/db)','Készletjelzés határa (db)','Utánrendelés állapota','Rendelést vállalta','Vállalás időpontja','Megrendelte','Megrendelés időpontja','Kedvezmény (%)','Kedvezményes ár (Ft/db)','Készlet kedvezményes értéke (Ft)']);
  for(const p of data.products){const q=data.pricingSettings?Pricing.product(p,data.pricingSettings):null;add(main,[p.id,p.name,p.sku,p.barcodes.join(' / '),p.quantity,require('./warehouse-map').names(p),p.locationNote||'',require('./inventory-categories').label(p.category),p.price===undefined||p.price===''?'':Number(p.price),p.minStock??'',p.reorder?(p.reorder.stage==='ordered'?'Megrendelve':'Rendelés vállalva'):'',p.reorder?.claimedBy||'',p.reorder?.claimedAt||'',p.reorder?.orderedBy||'',p.reorder?.orderedAt||'',number(q?.discountPercent),moneyCell(q?.discountedPrice),q?moneyCell(Pricing.line(q.fullPrice,q.discountPercent,p.quantity)?.discountedValue):'']);}
  const moves=sheet('Készletmozgások',['Időpont','Cikkszám','Terméknév','Változás (db)','Indok']);for(const m of data.movements)add(moves,[m.at,m.sku,m.name,m.delta,m.reason]);
 }else throw Error('Érvénytelen Excel-adatkör.');
 return book;
}
async function write(file, kind, data) {
 const book=workbook(kind,data),temporary=file+'.'+crypto.randomUUID()+'.tmp';
 try{await book.xlsx.writeFile(temporary);await fs.rename(temporary,file);}finally{await fs.rm(temporary,{force:true}).catch(()=>{});}
}
function select(data, id) {
 if(id===null||id===undefined)return data;
 if(typeof id!=='string'||!id)throw Error('Érvénytelen kiválasztás.');
 const found=data.find(d=>d.id===id);if(!found)throw Error('A kiválasztott bejegyzés már nem található.');return [found];
}
module.exports={workbook,write,select};
