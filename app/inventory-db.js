// Shared inventory contains product data and opaque device/item IDs, never notes.
const fs=require('node:fs'),path=require('node:path'),{randomUUID,createHash}=require('node:crypto');
class StockError extends Error{constructor(message,code='invalid'){super(message);this.code=code;}}
const key=s=>String(s).trim().normalize('NFC').toLocaleLowerCase('hu');
const qty=n=>{if(!Number.isSafeInteger(n)||n<0||n>1000000000)throw new StockError('A darabszám 0 és 1 000 000 000 közötti egész szám legyen.');return n;};
const text=(v,max=200)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw new StockError('Hiányzó vagy túl hosszú termékadat.');return v.trim();};
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const hash=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
function atomic(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';try{const fd=fs.openSync(tmp,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(data));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}if(fs.existsSync(file))fs.copyFileSync(file,file+'.bak');fs.renameSync(tmp,file);}finally{fs.rmSync(tmp,{force:true});}}
function createDatabase(file){
 function read(){const d=JSON.parse(fs.readFileSync(file,'utf8'));if(d.version!==1||!Array.isArray(d.products)||(!d.devices||typeof d.devices!=='object'||Array.isArray(d.devices))||(!d.receipts||typeof d.receipts!=='object'||Array.isArray(d.receipts))||!Array.isArray(d.movements)||typeof d.revision!=='string')throw new StockError('Sérült raktárfájl. Az adatokat nem írjuk felül.','corrupt');const ids=new Set(),skus=new Set(),codes=new Set(),identifiers=new Map();for(const p of d.products){text(p.id);text(p.name);text(p.sku);qty(p.quantity);for(const field of ['brand','catalogId'])if(p[field]!==undefined&&(typeof p[field]!=='string'||p[field].length>200))throw new StockError('Sérült katalógushivatkozás.','corrupt');if(ids.has(p.id)||skus.has(key(p.sku))||!Array.isArray(p.barcodes))throw new StockError('Sérült termékazonosítók.','corrupt');ids.add(p.id);skus.add(key(p.sku));for(const value of [p.sku,...p.barcodes]){if(identifiers.has(key(value))&&identifiers.get(key(value))!==p.id)throw new StockError('Ütköző cikkszám / vonalkód.','corrupt');identifiers.set(key(value),p.id);}for(const c of p.barcodes){text(c);if(codes.has(key(c)))throw new StockError('Ismétlődő vonalkód.','corrupt');codes.add(key(c));}}
 for(const [device,state]of Object.entries(d.devices)){
  if(!/^[a-f0-9-]{36}$/.test(device)||!state||!Number.isSafeInteger(state.seq)||state.seq<1||!Array.isArray(state.allocations)||state.digest!==hash(state.allocations))throw new StockError('Sérült készletkapcsolati napló.','corrupt');
  const allocations=new Set();for(const a of state.allocations){text(a.id,500);text(a.productId);qty(a.quantity);if(!a.quantity||allocations.has(a.id)||!ids.has(a.productId))throw new StockError('Sérült raktári foglalás.','corrupt');allocations.add(a.id);}
 }
 for(const [id,digest]of Object.entries(d.receipts))if(!/^[a-f0-9-]{36}$/.test(id)||! /^[a-f0-9]{64}$/.test(digest))throw new StockError('Sérült bevételezési napló.','corrupt');
 return d;}
 if(!fs.existsSync(file))atomic(file,{version:1,revision:randomUUID(),products:[],devices:{},receipts:{},movements:[]});read();
 const view=d=>({revision:d.revision,products:d.products,movements:d.movements.slice(-100).reverse()});
 function command(c){
  if(!c||typeof c!=='object'||!['product','receive','adjust','delete','claims','link-barcode'].includes(c.type))throw new StockError('Érvénytelen raktárművelet.');
  const d=read(),now=new Date().toISOString(),operator=c.operator===undefined?'Korábbi / név nélkül':text(c.operator,80);
  if(c.type==='claims'){
   if(Object.keys(c).some(k=>!['type','device','seq','allocations','operator'].includes(k)))throw new StockError('Csak készlethivatkozások küldhetők.');
   if(!/^[a-f0-9-]{36}$/.test(c.device)||!Number.isSafeInteger(c.seq)||c.seq<1||!Array.isArray(c.allocations)||c.allocations.length>200000)throw new StockError('Hibás készletkapcsolat.');
   const keys=new Set();for(const a of c.allocations){if(!a||Object.keys(a).some(k=>!['id','productId','quantity'].includes(k)))throw new StockError('Személyes adat nem küldhető a raktárba.');text(a.id,500);text(a.productId);qty(a.quantity);if(!a.quantity||keys.has(a.id))throw new StockError('Hibás tételhivatkozás.');keys.add(a.id);}
   const previous=d.devices[c.device],digest=hash(c.allocations);
   if(previous&&c.seq<previous.seq)throw new StockError('Régi készletmódosítás.','stale');
   if(previous&&c.seq===previous.seq){if(previous.digest!==digest)throw new StockError('Eltérő tartalom ugyanahhoz a készletművelethez.');return view(d);}
   const delta=new Map();for(const a of previous?.allocations||[])delta.set(a.productId,(delta.get(a.productId)||0)+a.quantity);for(const a of c.allocations)delta.set(a.productId,(delta.get(a.productId)||0)-a.quantity);
   for(const [id,n]of delta){const p=d.products.find(p=>p.id===id);if(!p)throw new StockError('A raktári termék nem található.');const next=p.quantity+n;if(next<0)throw new StockError('Nincs elegendő készlet: '+p.name+' ('+p.quantity+' db elérhető).','insufficient');qty(next);p.quantity=next;if(n)d.movements.push({id:randomUUID(),at:now,operator,productId:id,sku:p.sku,name:p.name,delta:n,reason:n>0?'Jegyzet korrekció / visszavétel':'Jegyzet – raktárról'});}
   d.devices[c.device]={seq:c.seq,digest,allocations:c.allocations};
  }else{
   text(c.id,100);if(!/^[a-f0-9-]{36}$/.test(c.id))throw new StockError('Hibás műveletazonosító.');const digest=hash(c);
   if(d.receipts[c.id]){if(d.receipts[c.id]!==digest)throw new StockError('Eltérő tartalom azonos műveletazonosítóval.');return view(d);}
   if(c.type==='product'){
    const p=c.product;if(!p||Object.keys(p).some(k=>!['id','name','sku','barcodes','brand','catalogId'].includes(k)))throw new StockError('Érvénytelen termék.');
    const id=p.id||randomUUID(),name=text(p.name),sku=text(p.sku),extra={};for(const field of ['brand','catalogId'])if(Object.hasOwn(p,field)){if(typeof p[field]!=='string'||p[field].length>200)throw new StockError('Hibás katalógushivatkozás.');extra[field]=p[field];}if(!Array.isArray(p.barcodes)||p.barcodes.length>100)throw new StockError('Legfeljebb 100 vonalkód adható meg.');const barcodes=p.barcodes.map(x=>text(x));
    if(new Set(barcodes.map(key)).size!==barcodes.length)throw new StockError('A vonalkód ismétlődik.');
    if(d.products.some(x=>x.id!==id&&([x.sku,...x.barcodes].some(b=>[sku,...barcodes].some(c=>key(c)===key(b))))))throw new StockError('A cikkszám vagy vonalkód már másik termékhez tartozik.');
    const existing=d.products.find(x=>x.id===id);if(p.id&&!existing)throw new StockError('A terméket közben törölték.','conflict');
    if(existing&&c.revision!==d.revision)throw new StockError('A készlet közben változott. Frissítsd a listát, és nyisd meg újra a terméket.','conflict');
    if(existing)Object.assign(existing,{name,sku,barcodes,...extra});else d.products.push({id,name,sku,barcodes,quantity:0,...extra});
   }else{
    const p=d.products.find(p=>p.id===c.productId);if(!p)throw new StockError('A raktári termék nem található.');
    if(c.type==='link-barcode'){const barcode=text(c.barcode);if(d.products.some(x=>x.id!==p.id&&[x.sku,...x.barcodes].some(v=>key(v)===key(barcode))))throw new StockError('A vonalkód már másik termékhez tartozik.');if(!p.barcodes.some(v=>key(v)===key(barcode))){if(p.barcodes.length>=100)throw new StockError('Legfeljebb 100 vonalkód adható meg.');p.barcodes.push(barcode);}if(c.catalogId){if(typeof c.catalogId!=='string'||c.catalogId.length>200)throw new StockError('Hibás katalógushivatkozás.');if(p.catalogId&&p.catalogId!==c.catalogId)throw new StockError('A termék már másik katalógustételhez kapcsolódik. Ellenőrizd a gyártót és cikkszámot.');p.catalogId=c.catalogId;}}
    else if(c.type==='delete'){if(p.quantity||Object.values(d.devices).some(x=>x.allocations.some(a=>a.productId===p.id)))throw new StockError('Készlettel vagy jegyzetkapcsolattal rendelkező termék nem törölhető.');d.products=d.products.filter(x=>x.id!==p.id);}
    else{const n=c.quantity;if(!Number.isSafeInteger(n)||!n||(c.type==='receive'&&n<0))throw new StockError('Pozitív egész darabszám szükséges; korrekciónál negatív is megadható.');qty(p.quantity+n);const reason=c.type==='receive'?'Bevételezés':text(c.reason,300);p.quantity+=n;d.movements.push({id:c.id,at:now,operator,productId:p.id,sku:p.sku,name:p.name,delta:n,reason});}
   }
   d.receipts[c.id]=digest;
  }
  d.movements=d.movements.slice(-5000);d.revision=randomUUID();atomic(file,d);return view(d);
 }
 return {read:()=>view(read()),command};
}
module.exports={createDatabase,StockError,atomic,key,qty};
