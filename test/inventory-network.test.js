const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net'),http=require('node:http'),https=require('node:https'),{randomUUID}=require('node:crypto');
const {createDatabase,StockError}=require('../app/inventory-db'),Network=require('../app/inventory-network'),{credentials}=require('../app/inventory-tls'),{createService}=require('../app/inventory-service'),Store=require('../app/store'),Items=require('../app/items');
async function port(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
const req=(p,url,{secure=false,ca,token,body,origin}={})=>new Promise((resolve,reject)=>{const r=(secure?https:http).request({host:'127.0.0.1',port:p,path:url,method:body?'POST':'GET',...(secure?{ca}:{}),headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{}),...(origin?{Origin:origin}:{})}},s=>{const chunks=[];s.on('data',c=>chunks.push(c));s.on('end',()=>resolve({status:s.statusCode,text:Buffer.concat(chunks).toString()}));});r.on('error',reject);if(body)r.write(JSON.stringify(body));r.end();});
test('stocktake prices are shared across desktop clients and read-only on the trusted-CA phone connection',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'toki-price-net-'));let server;
 try{
  const db=createDatabase(path.join(dir,'stock.json')),tls=credentials(dir,['127.0.0.1']),p=await port(),token='a'.repeat(32),phoneToken='b'.repeat(32);
  const cmd=c=>db.command({id:randomUUID(),operator:'Minta',...c});cmd({type:'product',product:{name:'Minta olaj',sku:'PRICE',price:'1000',category:'engine-oil',barcodes:[]}});
  const product=db.read().products[0],sessionId=randomUUID();cmd({type:'receive',productId:product.id,quantity:5});cmd({type:'stocktake',action:'start',sessionId,title:'Árak'});
  server=await Network.start({database:db,token,phoneToken,port:p,tls});const client={host:'127.0.0.1',port:p,token};
  const first=await Network.request(client,undefined,'/api/stocktake');
  await Network.request(client,{id:randomUUID(),operator:'Másik gép',type:'stocktake',action:'pricing',sessionId,productId:product.id,expectedPricing:first.rows[0].pricingVersion,fullPrice:'2000',discountPercent:'25'});
  const phone={secure:true,ca:tls.ca,token:phoneToken};const report=JSON.parse((await req(p+1,'/api/stocktake',phone)).text);
  assert.equal(report.rows[0].discountedPrice,'1500');assert.equal(report.warehouseValuation.discountedValue,'7500');
  for(const body of [{type:'stocktake',action:'pricing',sessionId,productId:product.id,fullPrice:'1',discountPercent:'0'},{type:'pricing-settings',settings:{general:'1',engineOil:'2',transmissionOil:'3'}}])assert.equal((await req(p+1,'/api/stock',{...phone,body:{id:randomUUID(),operator:'Telefon',...body}})).status,403);
  assert.equal((await req(p+1,'/items.js',phone)).status,200);assert.equal((await req(p+1,'/inventory-pricing.js',phone)).status,200);
  assert.equal(db.read().products[0].price,'2000');assert.equal(db.read().products[0].quantity,5);assert.equal(db.read().movements.length,1);
 }finally{await server?.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('közös HTTP készlet, hitelesített HTTPS telefon, helyes CA és böngészős hozzáférésvédelem',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'toki-stock-net-'));let server;try{const db=createDatabase(path.join(dir,'stock.json')),tls=credentials(dir,['127.0.0.1']),p=await port();server=await Network.start({database:db,token:'a'.repeat(32),phoneToken:'b'.repeat(32),port:p,tls});
 assert.equal((await req(p,'/api/stock')).status,401);assert.equal((await req(p,'/api/stock',{token:'a'.repeat(32),origin:'https://evil.invalid'})).status,403);
 const root=await req(p,'/inventory-ca.crt');assert.equal(root.status,200);assert.equal(root.text,tls.ca);assert.doesNotMatch(root.text,/PRIVATE KEY/);
 assert.equal((await req(p+1,'/',{secure:true,ca:tls.ca})).status,200);assert.equal((await req(p+1,'/zxing.js',{secure:true,ca:tls.ca})).status,200);assert.equal((await req(p+1,'/camera.js',{secure:true,ca:tls.ca})).status,200);await assert.rejects(req(p+1,'/',{secure:true}));
 assert.equal((await req(p+1,'/api/stock',{secure:true,ca:tls.ca,token:'a'.repeat(32)})).status,401);
 assert.equal((await req(p+1,'/api/stock',{secure:true,ca:tls.ca,token:'b'.repeat(32),origin:'https://evil.invalid'})).status,403);
 const options={secure:true,ca:tls.ca,token:'b'.repeat(32),origin:'https://127.0.0.1:'+(p+1)};
 const create={type:'product',id:randomUUID(),product:{name:'Szűrő',sku:'OIL-1',barcodes:['0000012345678']}};assert.equal((await req(p+1,'/api/stock',{...options,body:create})).status,200);const product=db.read().products[0];const receive={type:'receive',id:randomUUID(),productId:product.id,quantity:8};assert.equal((await req(p+1,'/api/stock',{...options,body:receive})).status,200);await req(p+1,'/api/stock',{...options,body:receive});assert.equal(db.read().products[0].quantity,8);
 assert.equal((await req(p+1,'/api/stock',{...options,body:{type:'claims',device:randomUUID(),seq:1,allocations:[]}})).status,403);
 const c={host:'127.0.0.1',port:p,token:'a'.repeat(32)};await Promise.all(Array.from({length:4},()=>Network.request(c,{type:'claims',device:randomUUID(),seq:1,allocations:[{id:randomUUID(),productId:product.id,quantity:2}]})));assert.equal(db.read().products[0].quantity,0);
 }finally{await server?.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('válaszvesztés után a függő jegyzet újrapróbálása csak egyszer csökkenti a közös készletet',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'toki-stock-retry-'));let server;const original=Network.request;try{const host=path.join(dir,'host'),client=path.join(dir,'client');fs.mkdirSync(client,{recursive:true});const db=createDatabase(path.join(host,'stock.json'));db.command({type:'product',id:randomUUID(),product:{name:'Olaj',sku:'OIL',barcodes:[]}});const product=db.read().products[0];db.command({type:'receive',id:randomUUID(),productId:product.id,quantity:5});const p=await port();server=await Network.start({database:db,token:'a'.repeat(32),phoneToken:'b'.repeat(32),port:p,tls:credentials(host,['127.0.0.1'])});fs.writeFileSync(path.join(client,'garage-network.json'),JSON.stringify({mode:'client',host:'127.0.0.1',port:p-1,token:'a'.repeat(32)}));const notesFile=path.join(client,'notes.json');Store.write(notesFile,[]);
 let lose=true;Network.request=async(...args)=>{const r=await original(...args);if(lose&&args[1]?.type==='claims'){lose=false;throw new StockError('Válaszvesztés','unavailable');}return r;};
 let s=createService(client,{readNotes:()=>Store.read(notesFile),writeNotes:n=>Store.write(notesFile,n)});const n={id:'n',title:'Magánnév',body:'Magánjegyzet',updated:'2026-11-07T08:00:00Z',items:[{...Items.blank('i'),partNumber:'OIL',quantity:'2',fromStock:true,stockProductId:product.id}]};await assert.rejects(s.saveNotes(()=>[n]),/Válaszvesztés/);assert.equal(db.read().products[0].quantity,3);assert.equal(s.hasPending(),true);
 s=createService(client,{readNotes:()=>Store.read(notesFile),writeNotes:n=>Store.write(notesFile,n)});await s.recover();assert.equal(db.read().products[0].quantity,3);assert.equal(s.hasPending(),false);assert.equal(Store.read(notesFile)[0].body,'Magánjegyzet');
 }finally{Network.request=original;await server?.close();fs.rmSync(dir,{recursive:true,force:true});}
});
