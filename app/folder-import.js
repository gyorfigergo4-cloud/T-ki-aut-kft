const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {TextDecoder} = require('node:util');
const importer = require('./initial-import');
const {months,validDay} = require('./archive');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const dateName = /^(\d{1,2})[.,](\d{1,2})\.*(?: \(\d+\))?\.txt$/i;
const oilRE = /\b\d{1,2}\s*w\s*[- ]?\s*\d{2}\b|\bsae\s*\d+|\b(?:dexos|eneos|castrol|motul)\b|\bmobil\s*(?:1|super|[0-9])/i;
const amountPattern = '(?:\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:,\\d{1,2})?';
const pairRE = new RegExp('(?<![\\w.,])('+amountPattern+')\\s*(?:Ft)?\\s*[-–]\\s*('+amountPattern+')\\s*Ft(?!\\w)','gi');
const priceRE = new RegExp('(?<![\\w.,])('+amountPattern+')\\s*Ft(?!\\w)','gi');
const dataRE = /^(?:olaj\b|olajsz[űü]r|leveg[őö]sz[űü]r|légsz[űü]r|pollensz[űü]r|sz[űü]r[őö]|gyári\b|rendel|összesen|telibe|teli ár|kedvezmény|saját\b|hajtókar|dugat|csapágy|vezér|tömítés|henger|főtengely|szívósor|vákuum|kipuf|szimering|fagyálló|nincsen\b|nincs\b)/i;
const supplierRE = /\b(?:Ft|AP|IC|UNIX|LÁNG|SZAKÁL|BÁRDI|AUTONET|UNITRA(?:C)?K|IVANICS)\b/i;
function vins(text){return [...new Set([...text.matchAll(/(?<![A-Z0-9])[A-HJ-NPR-Z0-9]{17}(?![A-Z0-9])/gi)].map(m=>m[0].toUpperCase()).filter(v=>/[A-Z]/.test(v)&&/\d/.test(v)))];}
const cleanLine = line => line.trim().replace(/^\uFEFF/,'');
function lineType(line){
 const v=cleanLine(line);if(!v)return 'blank';
 if([...v.matchAll(priceRE)].length||dataRE.test(v)||oilRE.test(v))return 'continuation';
 if(/\bkész\b/i.test(v)&&v.length<=90&&/^\p{L}/u.test(v))return 'name';
 if(vins(v).length||/^[\d\W]/u.test(v[0])&&!/^\p{L}/u.test(v)||/[A-Za-z]\d|\d[A-Za-z]/.test(v)||supplierRE.test(v))return 'continuation';
 if(v.length<=65&&/^\p{L}[\p{L}\p{N}_\s.\-/()]*$/u.test(v)&&!/\d/.test(v))return 'name';
 return 'uncertain';
}
function splitNotes(text,named=false){
 const lines=text.match(/[^\n]*\n|[^\n]+$/g)||[];
 if(named||!lines.length)return [{start:0,end:lines.length,text,kind:'named-file'}];
 const starts=[0],kinds=[lineType(lines.find(l=>cleanLine(l))||'')==='name'?'name':'uncertain'];
 for(let i=0;i<lines.length;i++){
  if(!cleanLine(lines[i]))continue;
  const kind=lineType(lines[i]),blank=i>0&&!cleanLine(lines[i-1]),strong=kind==='name'&&/\bkész\b/i.test(lines[i]);
  if(i>0&&((blank&&['name','uncertain'].includes(kind))||strong)){
   if(!cleanLine(lines.slice(starts.at(-1),i).join(''))){kinds[kinds.length-1]=kind;continue;}
   starts.push(i);kinds.push(kind);
  }
 }
 return starts.map((start,i)=>({start,end:starts[i+1]??lines.length,text:lines.slice(start,starts[i+1]??lines.length).join(''),kind:kinds[i]}));
}
function decode(raw){
 if(raw[0]===0xff&&raw[1]===0xfe)return new TextDecoder('utf-16le',{fatal:true,ignoreBOM:true}).decode(raw);
 if(raw[0]===0xfe&&raw[1]===0xff)return new TextDecoder('utf-16be',{fatal:true,ignoreBOM:true}).decode(raw);
 try{return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(raw);}catch{return new TextDecoder('windows-1250',{fatal:true}).decode(raw);}
}
function fileDay(relative,modified,override){
 const pieces=relative.split('/'),year=pieces.find(p=>/^20\d{2}$/.test(p)),month=months.findIndex(m=>pieces.some(p=>p.toLocaleLowerCase('hu')===m.toLocaleLowerCase('hu')))+1;
 if(!year||!month)throw new Error('Év- vagy hónapmappa hiányzik: '+relative);
 const m=dateName.exec(pieces.at(-1));let day;
 if(m){if(Number(m[1])!==month)throw new Error('Eltérő hónap a fájlnévben: '+relative);day=`${year}-${String(month).padStart(2,'0')}-${m[2].padStart(2,'0')}`;}
 else if(override!==undefined){
  if(!validDay(override)||!override.startsWith(`${year}-${String(month).padStart(2,'0')}-`))throw new Error('A kiválasztott napnak a fájl év- és hónapmappájába kell esnie: '+relative);
  day=override;
 }
 else{
  const fields=Object.fromEntries(new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(modified).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  if(fields.year!==year||Number(fields.month)!==month){
   const error=new Error('A nap nem állapítható meg a fájl mentési dátumából: '+relative);
   error.code='DATE_REQUIRED';
   const prefix=`${year}-${String(month).padStart(2,'0')}`;
   error.issue={path:relative,min:prefix+'-01',max:prefix+'-'+new Date(Date.UTC(Number(year),month,0)).getUTCDate(),month:year+'. '+months[month-1].toLocaleLowerCase('hu')};
   throw error;
  }
  day=`${fields.year}-${fields.month}-${fields.day}`;
 }
 if(!validDay(day))throw new Error('Érvénytelen nap: '+relative);
 return {day,dateBasis:m?'filename':override!==undefined?'user-selected':'file-modified'};
}
function fields(text){
 const body=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').replace(/^\uFEFF/,'').trim(), lines=body.split('\n').map(l=>l.trim()).filter(Boolean);
 const oil=lines.slice(1).filter(l=>oilRE.test(l));
 const part=lines.slice(1).filter(l=>!oil.includes(l)&&!(vins(l).length&&/^[A-HJ-NPR-Z0-9]{17}$/i.test(l))&&/\d/.test(l)&&!/^(?:telibe|teli ár|kedvezmény|összesen)\b/i.test(l));
 const prices=lines.slice(1).filter(l=>[...l.matchAll(priceRE)].length);let fullPrice='',discountPrice='';
 if(prices.length===1&&part.length+oil.length===1&&!/\/\s*db\b|\bx\s*\d|\b\d+\s*db\b/i.test(prices[0])){
  const pairs=[...prices[0].matchAll(pairRE)];
  if(pairs.length===1&&[...prices[0].matchAll(priceRE)].length<=2){const full=pairs[0][1].replaceAll('.','').replace(',','.'),discount=pairs[0][2].replaceAll('.','').replace(',','.');if(Number(discount)<=Number(full)){fullPrice=full;discountPrice=discount;}}
 }
 return {body,vin:vins(body).join(' / '),part:part.join('\n'),oil:oil.join('; '),fullPrice,discountPrice};
}
function scan(directory){
 const base=fs.realpathSync(directory);if(!fs.statSync(base).isDirectory())throw new Error('Válaszd a Napi jegyzetek mappát.');
 const rootName=path.basename(base).normalize('NFC'),records=[];let byteCount=0,scanned=0;
 function walk(folder){
  for(const entry of fs.readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en'))){
   if(++scanned>20000)throw new Error('Túl sok fájl van a kiválasztott mappában.');
   const file=path.join(folder,entry.name);
   if(entry.isSymbolicLink())continue;
   if(entry.isDirectory()){walk(file);continue;}
   if(!entry.isFile()||!entry.name.toLowerCase().endsWith('.txt'))continue;
   const stat=fs.statSync(file);byteCount+=stat.size;if(byteCount>100000000)throw new Error('A jegyzetmappa meghaladja a 100 MB-ot.');
   const raw=fs.readFileSync(file),text=decode(raw),relative=(rootName+'/'+path.relative(base,file).split(path.sep).join('/')).normalize('NFC');
   records.push({relative,name:entry.name,text,fileHash:hash(raw),modified:stat.mtime.toISOString()});
  }
 }
 walk(base);if(!records.length)throw new Error('Nem található TXT-jegyzet ebben a mappában.');
 return records;
}
function dateIssues(records){
 const issues=[];
 for(const record of records){
  try{fileDay(record.relative,new Date(record.modified));}
  catch(error){if(error.code!=='DATE_REQUIRED')throw error;issues.push(error.issue);}
 }
 return issues;
}
function prepare(directory){const records=scan(directory);return {records,files:records.length,issues:dateIssues(records)};}
function buildFromScan(records,dates={}){
 if(!dates||typeof dates!=='object'||Array.isArray(dates))throw new Error('Válaszd ki a hiányzó napokat.');
 const sources=[],notes=[];
 for(const record of records){
   const {relative,text,fileHash,name}=record,modified=new Date(record.modified);
   const {day,dateBasis}=fileDay(relative,modified,Object.hasOwn(dates,relative)?dates[relative]:undefined),blocks=splitNotes(text,!dateName.test(name));
   sources.push({path:relative,sha256:fileHash});
   if(blocks.map(b=>b.text).join('')!==text)throw new Error('Hibás szövegfeldolgozás: '+relative);
   blocks.forEach((block,index)=>{
    const first=block.text.split(/\r?\n/).map(cleanLine).find(Boolean)||'';
    const title=!dateName.test(name)?path.parse(name).name:(block.kind==='name'||first.length<=80)?first:'Egyéb jegyzet · '+(index+1);
    notes.push({id:'txt-'+hash(relative+'\0'+fileHash+'\0'+block.start).slice(0,32),title,day,created:new Date(Date.parse(day+'T12:00:00Z')+index*1000).toISOString(),updated:modified.toISOString(),...fields(block.text),source:{path:relative,fileHash,startLine:block.start+1,endLine:block.end,originalText:block.text,dateBasis,classification:block.kind}});
   });
 }
 const bundleId='txt-zip-'+hash(JSON.stringify(sources.sort((a,b)=>a.path.localeCompare(b.path,'en'))));
 for(const note of notes)note.source.bundleId=bundleId;
 const days=[...new Set(notes.map(n=>n.day))].sort(),years=[...new Set([2024,2025,2026,...days.map(d=>Number(d.slice(0,4)))])].sort();
 return {format:'autobolt-initial-import',version:1,bundleId,notes,archive:{years,days},fileCount:records.length};
}
function build(directory,dates){return buildFromScan(scan(directory),dates);}
function importFolder(directory,dataDirectory,dates){const bundle=build(directory,dates);const result=importer.applyBundle(dataDirectory,bundle);return {...result,files:bundle.fileCount,notes:bundle.notes.length,days:bundle.archive.days.length};}
module.exports={build,prepare,buildFromScan,importFolder,splitNotes,fileDay,fields};
