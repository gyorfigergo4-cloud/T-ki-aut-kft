// Only public reference metadata is downloaded. The result stays in userData;
// no third-party catalog dataset is embedded in or published with the app.
const fs=require('node:fs'),path=require('node:path'),{StringDecoder}=require('node:string_decoder'),{createHash}=require('node:crypto');
const SOURCE_COMMIT='7b9828809040b647d46998b65870b3831e858aa1';
const BASE='https://raw.githubusercontent.com/tecdocSQL/tecdocdatabase1Q2019/'+SOURCE_COMMIT+'/';
const CATEGORY_IDS=new Map([['7','oil'],['8','air'],['424','cabin']]);
function supplierMap(text){const m=new Map();for(const row of text.split(/\r?\n/)){const c=row.split('\t');if(c.length>=4&&/^\d+$/.test(c[1])&&c[3])m.set(c[1],c[3].trim());}if(!m.size)throw Error('A gyártólista nem olvasható.');return m;}
function parser(suppliers){const records=new Map();let examined=0;return {line:line=>{examined++;const c=line.replace(/\r$/,'').split('\t');if(c.length<20||!CATEGORY_IDS.has(c[3])||c[19]!=='1'||c[18]==='1')return;const sku=c[1].trim(),brand=suppliers.get(c[2]),category=CATEGORY_IDS.get(c[3]);if(!sku||sku==='\\N'||sku.length>200||!brand||brand.length>100)return;const identity=c[2]+'|'+sku.replace(/\s+/g,'').toUpperCase(),id='td19-'+createHash('sha256').update(identity).digest('hex');if(!records.has(id))records.set(id,{id,brand,sku,category});if(records.size>500000)throw Error('Túl sok szűrőbejegyzés.');},result:()=>[...records.values()],stats:()=>({examined,records:records.size})};}
async function run({output,progress=()=>{},base=BASE,parts=15,fetcher=fetch}){
 let bytes=0,last=0;const get=async name=>{const r=await fetcher(base+name,{signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error('A katalógusforrás nem érhető el ('+r.status+', '+name+').');return r;};
 progress({phase:'Gyártólista letöltése',part:0,parts,bytes});const response=await get('suppliers.csv');const brands=supplierMap(await response.text()),p=parser(brands),decoder=new StringDecoder('utf8');let carry='';const checksum=createHash('sha256');
 const feed=text=>{const lines=(carry+text).split('\n');carry=lines.pop();for(const line of lines)p.line(line);if(carry.length>1024*1024)throw Error('Hibás, túl hosszú adatsor.');};
 for(let n=0;n<parts;n++){
  const name='articles.csv.'+String(n).padStart(3,'0'),r=await get(name);progress({phase:'Szűrőlista feldolgozása',part:n+1,parts,bytes,...p.stats()});
  for await(const chunk of r.body){bytes+=chunk.length;if(bytes>2*1024*1024*1024)throw Error('A forrás nagyobb a várt méretnél.');checksum.update(chunk);feed(decoder.write(Buffer.from(chunk)));if(Date.now()-last>1000){last=Date.now();progress({phase:'Szűrőlista feldolgozása',part:n+1,parts,bytes,...p.stats()});}}
 }
 feed(decoder.end());if(carry)p.line(carry);const records=p.result();if(!records.length)throw Error('Nem található feldolgozható szűrő a forrásban.');
 const data={version:1,meta:{source:'TecDoc 1Q2019 – nem hivatalos referencia',url:'https://github.com/tecdocSQL/tecdocdatabase1Q2019',commit:SOURCE_COMMIT,year:2019,importedAt:new Date().toISOString(),sha256:checksum.digest('hex'),categories:{oil:records.filter(r=>r.category==='oil').length,air:records.filter(r=>r.category==='air').length,cabin:records.filter(r=>r.category==='cabin').length}},records};
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(data),{mode:0o600});progress({phase:'Kész',part:parts,parts,bytes,...p.stats()});return {file:output,count:records.length,meta:data.meta};
}
module.exports={run,parser,supplierMap,SOURCE_COMMIT,BASE};
if(process.parentPort){process.parentPort.on('message',e=>{run({...e.data,progress:data=>process.parentPort.postMessage({type:'progress',data})}).then(data=>process.parentPort.postMessage({type:'complete',data})).catch(e=>process.parentPort.postMessage({type:'error',error:e.message}));});}
else if(require.main===module){run({output:process.argv[2],progress:p=>console.log(JSON.stringify(p))}).then(r=>console.log(JSON.stringify({complete:true,...r}))).catch(e=>{console.error(e.message);process.exitCode=1;});}
