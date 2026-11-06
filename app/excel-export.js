// XLSX export contains only the explicitly selected source. Never writes app data.
const Excel = require('exceljs');
const Items = require('./items');
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
 const itemHeaders=['Tételazonosító','Cikkszám','Megnevezés','Teli ár (Ft/db)','Kedvezmény (%)','Kedvezményes ár (Ft/db)','Db','Beszállító','Megrendelve','Rendelés időpontja','Fizetve','Felírva','Megérkezett'];
 const itemValues=i=>[i.id,i.partNumber,i.description||'',number(i.fullPrice),number(i.discountPercent),number(i.discountedPrice),number(i.quantity),i.supplier,yes(Items.order(i).ordered),Items.order(i).orderedAt,yes(i.paid),yes(i.recorded),yes(i.arrived)];
 if(kind==='notes'){
  require('./store').validate(data);
  const notes=normalize(data,{years:[],days:[]}).notes;
  const main=sheet('Jegyzetek',['Bejegyzésazonosító','Dátum','Név','Telefonszám','Állapot','Olaj','Jegyzet','Módosítva']);
  const cars=sheet('Járművek',['Bejegyzésazonosító','Dátum','Név','Járműazonosító','Autómárka','Alvázszám']);
  const items=sheet('Cikkszámok',['Bejegyzésazonosító','Dátum','Név','Járműazonosító','Autómárka','Alvázszám',...itemHeaders]);
  const reminders=sheet('Emlékeztetők',['Bejegyzésazonosító','Név','Emlékeztetőazonosító','Szöveg','Kész','Létrehozva','Ébresztő (ISO)','Szundi (ISO)']);
  for(const n of notes){
   add(main,[n.id,n.day,n.title,n.phone||'',Status.get(n).label,n.oil||'',n.body,n.updated]);
   for(const v of n.vehicles)add(cars,[n.id,n.day,n.title,v.id,v.brand,v.vin]);
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
