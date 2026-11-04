const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ExcelJS=require('exceljs'),yauzl=require('yauzl');
const Items=require('./items'),{validDay}=require('./archive');
const aliases={day:['datum','nap','kelt','rogzitesdatuma'],name:['nev','ugyfel','ugyfelnev','partner','vevo'],vin:['alvazszam','vin'],partNumber:['cikkszam','cikszam','gyaricikkszam','alkatreszszam'],description:['megnevezes','alkatresz','termek','leiras'],fullPrice:['teliar','listaar','egysegar','ar','teljesar'],discountPercent:['kedvezmeny','kedvezmenyszazalek','kedvezmenyszazalekban','kedv'],discountedPrice:['kedvezmenyesar','kedvar','eladasiar'],quantity:['db','darab','darabszam','mennyiseg'],supplier:['beszallito','honnan','forras'],oil:['olaj'],body:['megjegyzes','jegyzet']};
const fold=v=>String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'').replace(/ftdb$|ft$|(?<=[a-z])db$/,'');
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
function inspectZip(data){return new Promise((resolve,reject)=>{
 yauzl.fromBuffer(data,{lazyEntries:true,validateEntrySizes:true},(error,zip)=>{
  if(error)return reject(new Error('Nem olvasható Excel-fájl. Válassz .xlsx fájlt.'));
  let count=0,declared=0,actual=0,done=false;
  const fail=()=>{if(done)return;done=true;zip.close();reject(new Error('Az Excel-fájl túl nagy, védett vagy sérült.'));};
  zip.on('error',fail);zip.on('end',()=>{if(!done){done=true;resolve();}});
  zip.on('entry',entry=>{
   declared+=entry.uncompressedSize;
   if(++count>5000||declared>100000000||entry.generalPurposeBitFlag&1)return fail();
   if(entry.fileName.endsWith('/')){zip.readEntry();return;}
   zip.openReadStream(entry,(e,stream)=>{
    if(e)return fail();stream.on('error',fail);stream.on('data',chunk=>{actual+=chunk.length;if(actual>100000000){stream.destroy();fail();}});stream.on('end',()=>{if(!done)zip.readEntry();});
   });
  });zip.readEntry();
 });
});}
function scalar(cell){
 const value=cell.value;
 if(value===null||value===undefined)return '';
 if(value instanceof Date)return value;
 if(typeof value!=='object')return value;
 if('formula'in value||'sharedFormula'in value){if(value.result===undefined||value.result===null)throw new Error('Eredmény nélküli Excel-képlet. Nyisd meg és mentsd el a fájlt Excelben.');return value.result;}
 if(value.richText)return value.richText.map(part=>part.text).join('');
 if(value.error)throw new Error('Excel-cellahiba: '+value.error);
 return value.text??'';
}
function display(cell){try{const value=scalar(cell);return value instanceof Date?value.toISOString().slice(0,10):String(value);}catch{return String(cell.value?.formula||cell.value?.error||'Képlet');}}
function roundedNumber(value,places,shift=0){
 const negative=value<0;const [mantissa,exponent='0']=Math.abs(value).toString().toLowerCase().split('e');
 const [whole,fraction='']=mantissa.split('.');let units=BigInt(whole+fraction);
 const power=Number(exponent)+shift+places-fraction.length;
 if(power>=0)units*=10n**BigInt(power);else{const divisor=10n**BigInt(-power);units=(units+divisor/2n)/divisor;}
 const scale=10n**BigInt(places),tail=(units%scale).toString().padStart(places,'0').replace(/0+$/,'');
 return (negative?'-':'')+(units/scale).toString()+(tail?'.'+tail:'');
}
function number(cell,isPercent=false){
 const value=scalar(cell);if(value==='')return '';
 if(typeof value==='number'){
  if(!Number.isFinite(value))throw new Error('Érvénytelen szám.');
  const percentFormat=/%/.test((cell.numFmt||'').replace(/"[^"]*"|\\./g,''));
  return roundedNumber(value,isPercent?6:2,isPercent&&percentFormat?2:0);
 }
 let text=String(value).trim().replace(/Ft|HUF/gi,'').replace(/\s/g,'').replace(/%$/,'');
 if(/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(text))text=text.replaceAll('.','');
 else if(/^\d{1,3}(?:,\d{3})+\.\d+$/.test(text))text=text.replaceAll(',','');
 text=text.replace(',','.');
 if(!/^\d+(?:\.\d+)?$/.test(text))throw new Error('Nem olvasható szám: '+String(value).slice(0,50));
 if(isPercent)Items.percent(text);else Items.cents(text);
 return text;
}
function cellDay(cell,date1904){
 const value=scalar(cell);if(value==='')return '';
 let result;
 if(value instanceof Date)result=value.toISOString().slice(0,10);
 else if(typeof value==='number')result=new Date(Math.round((value-25569+(date1904?1462:0))*86400000)).toISOString().slice(0,10);
 else{
  const text=String(value).trim();let m=/^(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})\.?$/.exec(text);
  if(m)result=m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');
  else if((m=/^(\d{1,2})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{4})\.?$/.exec(text)))result=m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
 }
 if(!validDay(result))throw new Error('Nem olvasható dátum. Használj év-hónap-nap dátumot.');return result;
}
function originalCell(cell){
 const v=cell.value;if(v instanceof Date)return v.toISOString();
 if(v&&typeof v==='object'&&v.hyperlink)return String(v.text||'')+' ('+v.hyperlink+')';
 if(v&&typeof v==='object'&&(v.formula||v.sharedFormula))return display(cell)+' [='+String(v.formula||v.sharedFormula)+']';
 return display(cell);
}
function autoMap(columns){
 const mapping={};for(const [key,names]of Object.entries(aliases)){
  const found=columns.find(c=>names.includes(fold(c.label)));mapping[key]=found?found.index:0;
 }return mapping;
}
function describe(session,sheetName,headerRow){
 const sheet=sheetName?session.workbook.getWorksheet(sheetName):session.workbook.worksheets[0];if(!sheet)throw new Error('Nincs ilyen Excel-munkalap.');
 if(!headerRow){let best=-1;headerRow=1;for(let row=1;row<=Math.min(sheet.rowCount,20);row++){
  const columns=[];sheet.getRow(row).eachCell((cell,index)=>{if(cell.value!==null)columns.push({index,label:display(cell)});});
  const score=Object.values(autoMap(columns)).filter(Boolean).length;if(score>best){best=score;headerRow=row;}
 }}
 if(!Number.isInteger(headerRow)||headerRow<1||headerRow>Math.max(1,sheet.rowCount))throw new Error('Hibás fejlécsor.');
 const columns=[];for(let index=1;index<=Math.min(256,sheet.columnCount);index++)columns.push({index,label:display(sheet.getRow(headerRow).getCell(index))||'Oszlop '+index});
 return {sheets:session.workbook.worksheets.map(s=>({name:s.name,rows:s.rowCount})),sheet:sheet.name,headerRow,columns,mapping:autoMap(columns),preview:Array.from({length:Math.min(5,Math.max(0,sheet.rowCount-headerRow))},(_,i)=>columns.map(c=>display(sheet.getRow(headerRow+i+1).getCell(c.index))))};
}
async function open(file){
 if(path.extname(file).toLowerCase()!=='.xlsx')throw new Error('Válassz .xlsx fájlt. A régi .xls táblázatot előbb mentsd .xlsx-ként.');
 const stat=fs.statSync(file);if(stat.size>20000000)throw new Error('Legfeljebb 20 MB-os Excel-fájl olvasható be.');
 const data=fs.readFileSync(file);await inspectZip(data);
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(data,{ignoreNodes:['drawing','picture','extLst']});
 if(!workbook.worksheets.length)throw new Error('Az Excel-fájlban nincs munkalap.');
 if(workbook.worksheets.some(s=>s.rowCount>50000||s.columnCount>256))throw new Error('Legfeljebb 50 000 soros és 256 oszlopos munkalap olvasható be.');
 const session={workbook,fileName:path.basename(file),fileHash:sha(data)};
 return {session,view:describe(session)};
}
function build(session,config){
 if(!config||!validDay(config.fallbackDay))throw new Error('Adj meg napot a dátum nélküli sorokhoz.');
 const view=describe(session,config.sheet,Number(config.headerRow)),sheet=session.workbook.getWorksheet(view.sheet),mapping=config.mapping||{};
 for(const [key,index]of Object.entries(mapping))if(!Object.hasOwn(aliases,key)||!Number.isInteger(Number(index))||Number(index)<0||Number(index)>256)throw new Error('Hibás oszlopválasztás.');
 if(!Number(mapping.partNumber)&&!Number(mapping.description))throw new Error('Válaszd ki a cikkszám vagy a megnevezés oszlopát.');
 const groups=new Map(),errors=[],warnings=[],rows=[];let previous={};
 const get=(row,key)=>Number(mapping[key])?row.getCell(Number(mapping[key])):null;
 for(let index=view.headerRow+1;index<=sheet.rowCount;index++){
  const row=sheet.getRow(index);if(!row.hasValues)continue;
  try{
   const text=key=>{const cell=get(row,key);return cell?String(scalar(cell)).trim():'';};
   const partNumber=text('partNumber'),description=text('description');
   if([partNumber,description,text('name')].some(v=>['osszesen','vegosszeg','total'].includes(fold(v)))){warnings.push(index+'. sor: összesítő sor kihagyva.');continue;}
   const fullPrice=get(row,'fullPrice')?number(get(row,'fullPrice')):'',reduced=get(row,'discountedPrice')?number(get(row,'discountedPrice')):'',pct=get(row,'discountPercent')?number(get(row,'discountPercent'),true):'';
   if(!partNumber&&!description&&!fullPrice&&!reduced)continue;
   if(!fullPrice&&!reduced)warnings.push(index+'. sor: nincs megadott ár.');
   const item={...Items.blank('excel-'+sha(session.fileHash+'\0'+sheet.name+'\0'+index).slice(0,24)),partNumber,description,fullPrice,discountPercent:pct||'0',supplier:text('supplier')};
   const q=get(row,'quantity')?scalar(get(row,'quantity')):'';item.quantity=q===''?'1':String(q);Items.quantity(item.quantity);
   if(reduced!==''&&pct===''){
    item.priceMode='legacy';item.discountedPrice=reduced;item.discountPercent=fullPrice?Items.discountFromPrices(fullPrice,reduced):'';
   }else{item.discountedPrice=Items.discounted(fullPrice,item.discountPercent);if(reduced!==''&&reduced!==item.discountedPrice&&Items.cents(reduced)!==Items.cents(item.discountedPrice))throw new Error('A kedvezményes ár eltér a teli ár és a százalék alapján számolttól. Ellenőrizd az oszlopokat.');}
   Items.validate([item]);
   let day=get(row,'day')?cellDay(get(row,'day'),session.workbook.properties.date1904):'';
   let name=text('name'),vin=text('vin');let hasCustomerName=!!name;
   if(config.fillDown){day=day||previous.day;name=name||previous.name;hasCustomerName=hasCustomerName||!!previous.hasCustomerName;vin=vin||previous.vin;}
   day=day||config.fallbackDay;name=name||String(config.fallbackName||'Excel bejegyzés');previous={day,name,vin,hasCustomerName};
   const raw=view.columns.map(col=>col.label+': '+originalCell(row.getCell(col.index))).join('\n');
   item.excelSource={path:session.fileName+' / '+sheet.name,fileHash:session.fileHash,row:index,originalText:raw};
   const key=JSON.stringify([day,name,vin]);
   if(!groups.has(key))groups.set(key,{day,name,vin,items:[],original:[],rowNumbers:[],oil:[],body:[]});
   const group=groups.get(key);group.items.push(item);group.original.push(raw);group.rowNumbers.push(index);
   if(text('oil'))group.oil.push(text('oil'));if(text('body'))group.body.push(text('body'));
   rows.push({row:index,day,name,vin,hasCustomerName,...item});
  }catch(error){errors.push(index+'. sor: '+error.message);}
 }
 const bundleId='xlsx-'+sha(session.fileHash+'\0'+JSON.stringify({sheet:sheet.name,headerRow:view.headerRow,mapping,fallbackDay:config.fallbackDay,fallbackName:config.fallbackName,fillDown:!!config.fillDown}));
 const notes=[...groups.values()].map(group=>{
  const now=new Date().toISOString();const n={id:'excel-'+sha(session.fileHash+'\0'+sheet.name+'\0'+group.rowNumbers.join(',')).slice(0,32),title:group.name,vin:group.vin,day:group.day,created:group.day+'T12:00:00Z',updated:now,items:group.items,part:'',fullPrice:'',discountPrice:'',oil:[...new Set(group.oil)].join('; '),body:group.body.join('\n'),source:{kind:'excel',path:session.fileName+' / '+sheet.name,fileHash:session.fileHash,rowNumbers:group.rowNumbers,originalText:group.original.join('\n\n'),bundleId}};
  Items.syncLegacy(n);return n;
 });
 const days=[...new Set(notes.map(n=>n.day))].sort(),years=[...new Set([2024,2025,2026,...days.map(d=>Number(d.slice(0,4)))])].sort();
 const bundle={format:'autobolt-initial-import',version:1,bundleId,archive:{years,days},notes};
 return {bundle,items:rows,errors,warnings,preview:{rows:rows.length,notes:notes.length,days:days.length,errors:errors.slice(0,20),warnings:warnings.slice(0,20),sample:rows.slice(0,5).map(({partNumber,description,fullPrice,discountPercent,discountedPrice,quantity,supplier,name,day})=>({partNumber,description,fullPrice,discountPercent,discountedPrice,quantity,supplier,name,day}))}};
}
async function template(file){
 const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('Tételek');
 sheet.addRow(['Dátum','Név','Alvázszám','Cikkszám','Megnevezés','Teli ár','Kedvezmény %','Db','Beszállító','Megjegyzés']);
 sheet.addRow([new Date('2026-11-04T00:00:00Z'),'Minta ügyfél','','DEMO-001','Olajszűrő',10000,0.2,2,'IC','Minta: szabadon módosítható']);
 sheet.getColumn(1).numFmt='yyyy-mm-dd';sheet.getColumn(7).numFmt='0%';sheet.getRow(1).font={bold:true};sheet.columns.forEach(c=>{c.width=20;});
 await workbook.xlsx.writeFile(file);
}
function appendWorkorder(docs,id,built){
 const model=require('./workorders-model');
 if(built.errors.length)throw new Error(built.errors[0]);
 if(!built.items.length)throw new Error('Nincs beolvasható tétel.');
 const result=JSON.parse(JSON.stringify(docs)),doc=result.find(d=>d.id===id);
 if(!doc)throw new Error('Előbb nyiss meg egy munkalapot.');
 if(new Set(built.items.map(i=>i.name)).size>1||new Set(built.items.map(i=>i.vin).filter(Boolean)).size>1)throw new Error('Egy munkalapra csak egy ügyfél és egy jármű tételei kerülhetnek. Több ügyfélhez válaszd a Napi jegyzetek beolvasást.');
 const known=new Set(doc.items.map(i=>i.id));
 const added=built.items.filter(i=>!known.has(i.id)).map(({row,day,name,vin,hasCustomerName,...item})=>item);
 doc.items=model.activeItems(doc).concat(added);
 const customerRow=built.items.find(i=>i.hasCustomerName),vinRow=built.items.find(i=>i.vin);
 if(!doc.customer&&customerRow)doc.customer=customerRow.name;
 if(!doc.vin&&vinRow)doc.vin=vinRow.vin;
 doc.updated=new Date().toISOString();model.validate(result);
 return {docs:result,added:added.length,workorderId:doc.id};
}
module.exports={open,describe,build,template,appendWorkorder};
