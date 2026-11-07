const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{randomUUID,randomBytes,createHash}=require('node:crypto');
const {atomic,createDatabase,StockError,key}=require('./inventory-db'),Network=require('./inventory-network'),Garage=require('./garage-network'),Items=require('./items');
function createService(dir,{writeNotes,readNotes}={}){
 const enabledFile=path.join(dir,'inventory-enabled.json'),journalFile=path.join(dir,'inventory-note-pending.json'),linkFile=path.join(dir,'inventory-links.json'),commandFile=path.join(dir,'inventory-command-pending.json');
 let server,db,activeSignature,started,queue=Promise.resolve(),lastRecovery=null;
 const catalog=require('./filter-catalog').createCatalog(path.join(dir,'shared-inventory'));
 const job=require('./filter-catalog-job').createJob({dir:path.join(dir,'catalog-download'),catalog,fork:(...args)=>require('electron').utilityProcess.fork(...args)});
 const catalogAPI={search:options=>({...catalog.search(options),job:job.status()})};
 const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
 function config(){const f=path.join(dir,'garage-network.json');const c=fs.existsSync(f)?Garage.settings(read(f)):{mode:'local',port:47831};if(c.port>65533)throw new StockError('A raktárnak két további port kell. Az autónyilvántartó portja legfeljebb 65533 legyen.');return {...c,port:c.port+1};}
 const addresses=()=>Object.values(os.networkInterfaces()).flat().filter(e=>e.family==='IPv4'&&!e.internal&&Garage.privateAddress(e.address)).map(e=>e.address);
 const serialize=fn=>{const next=queue.catch(()=>{}).then(fn);queue=next;return next;};
 async function ensure(){
  const c=config(),signature=JSON.stringify(c);if(started&&activeSignature===signature)return c;
  if(started)await server?.close();server=undefined;started=false;
  if(c.mode!=='client'){
   db=createDatabase(path.join(dir,'shared-inventory','inventory.json'));
   if(c.mode==='host'){
    const tf=path.join(dir,'inventory-phone-code.json');const code=fs.existsSync(tf)?read(tf).code:randomBytes(16).toString('hex');if(!fs.existsSync(tf))atomic(tf,{code});
    const tls=require('./inventory-tls').credentials(dir,addresses());server=await Network.start({database:db,token:c.token,port:c.port,phoneToken:code,tls,catalog:catalogAPI});
   }
  }
  activeSignature=signature;started=true;return c;
 }
 async function raw(command){const c=await ensure();return c.mode==='client'?Network.request(c,command):command?db.command(command):db.read();}
 function links(){if(fs.existsSync(linkFile))return read(linkFile);return {device:randomUUID(),seq:0,allocations:[]};}
 function allocations(notes){const rows=[];for(const n of notes)for(const i of n.items||[]){if(i.fromStock===true){if(!Items.isActive(i)||!i.stockProductId)throw new StockError('A Raktárról jelöléshez válassz raktári terméket.');const quantity=Number(i.quantity);if(!Number.isSafeInteger(quantity)||quantity<1)throw new StockError('Hibás raktári darabszám.');rows.push({id:createHash('sha256').update(JSON.stringify([n.id,i.id])).digest('hex'),productId:i.stockProductId,quantity});}}return rows.sort((a,b)=>a.id.localeCompare(b.id));}
 async function finishJournal(){if(!fs.existsSync(journalFile))return;const j=read(journalFile);require('./store').validate(j.notes);if(j.command?.type!=='claims'||j.command.device!==j.links?.device||j.command.seq!==j.links?.seq||JSON.stringify(j.command.allocations)!==JSON.stringify(j.links.allocations)||JSON.stringify(j.command.allocations)!==JSON.stringify(allocations(j.notes)))throw new StockError('Sérült függő raktárművelet. A helyi naplókat ne töröld.','corrupt');await raw(j.command);writeNotes(j.notes);atomic(linkFile,j.links);fs.unlinkSync(journalFile);}
 async function commitNotes(notes){
  await finishJournal();const before=links(),next=allocations(notes);
  if(JSON.stringify(before.allocations)===JSON.stringify(next)){writeNotes(notes);return;}
  if(!fs.existsSync(linkFile))atomic(linkFile,before);
  const after={device:before.device,seq:before.seq+1,allocations:next},command={type:'claims',device:after.device,seq:after.seq,allocations:next};
  const j={notes,links:after,command};atomic(journalFile,j);
  try{await finishJournal();}catch(e){if(e.code&&e.code!=='unavailable'&&e.code!=='corrupt')fs.rmSync(journalFile,{force:true});throw e;}
 }
 async function recoverCommand(){if(!fs.existsSync(commandFile))return;const command=read(commandFile);await raw(command);fs.unlinkSync(commandFile);lastRecovery='A korábbi függő raktárművelet elkészült.';}
 async function load(){return serialize(async()=>{const c=await ensure();if(!fs.existsSync(enabledFile))atomic(enabledFile,{enabled:true});await finishJournal();await recoverCommand();return {...await raw(),status:status(),notice:lastRecovery};});}
 async function command(c){return serialize(async()=>{await finishJournal();if(fs.existsSync(commandFile)){const old=read(commandFile);if(JSON.stringify(old)!==JSON.stringify(c)){await recoverCommand();throw new StockError('Az előző bizonytalan raktárművelet elkészült. Ellenőrizd a készletet, majd ismételd meg az új műveletet.','recovered');}}atomic(commandFile,c);try{const result=await raw(c);fs.rmSync(commandFile,{force:true});return result;}catch(e){if(e.code&&e.code!=='unavailable')fs.rmSync(commandFile,{force:true});throw e;}});}
 function status(){const c=config();const ips=addresses();return {mode:c.mode,port:c.port,phonePort:c.port+1,addresses:ips,host:c.host||ips[0]||'',enabled:fs.existsSync(enabledFile),pending:fs.existsSync(journalFile)||fs.existsSync(commandFile),...(c.mode==='host'&&fs.existsSync(path.join(dir,'inventory-phone-code.json'))?{phoneCode:read(path.join(dir,'inventory-phone-code.json')).code}:{} )};}
 return {load,command,status,serialize,commitNotes,
  catalogSearch:async(options={})=>{const c=await ensure();return c.mode==='client'?Network.request(c,undefined,'/api/catalog?'+new URLSearchParams({query:options.query||'',category:options.category||'',offset:String(options.offset||0)})):catalogAPI.search(options);},
  catalogStart:async()=>{const c=await ensure();if(c.mode==='client')throw new StockError('A listát a központi gépen töltsd le.');return {job:job.start()};},
  catalogCancel:()=>({job:job.cancel()}),catalogInstall:async(file)=>{const c=await ensure();if(c.mode==='client')throw new StockError('A katalógus betöltése a főgépen végezhető.');if(job.status().running)throw new StockError('Előbb várd meg vagy állítsd le a letöltést.');return catalog.install(file);},catalogExport:async()=>{const c=await ensure();if(c.mode==='client')throw new StockError('A katalógust a főgépen mentsd ki.');return catalog.export();},localLinks:()=>fs.existsSync(linkFile)?read(linkFile):null,hasAnyPending:()=>fs.existsSync(journalFile)||fs.existsSync(commandFile),saveNotes:update=>serialize(async()=>{await finishJournal();const notes=update(readNotes());require('./store').validate(notes);await commitNotes(notes);return notes;}),recover:()=>serialize(async()=>{await finishJournal();await recoverCommand();}),hasPending:()=>fs.existsSync(journalFile),pendingNotes:()=>read(journalFile).notes,
  resolve:async code=>{const d=await raw();let matches=d.products.filter(p=>key(p.sku)===key(code)||p.barcodes.some(b=>key(b)===key(code)));if(!matches.length)matches=d.products.filter(p=>key(p.sku).replace(/\s+/g,'')===key(code).replace(/\s+/g,''));if(matches.length!==1)throw new StockError('Nincs egyértelmű raktári termék ehhez a cikkszámhoz. Előbb rögzítsd a Raktárban a cikkszámot és vonalkódot.');return matches[0];},
  start:async()=>{if(fs.existsSync(enabledFile)){try{await ensure();}catch{/* Expose error on inventory open, private notes still work. */}}},
  close:async()=>{job.cancel();await server?.close();started=false;},
  backup:async()=>{await ensure();const c=config();if(c.mode==='client')throw new StockError('A teljes raktármentést a központi gépen készítsd el.');return fs.readFileSync(path.join(dir,'shared-inventory','inventory.json'));}
 };
}
module.exports={createService};
