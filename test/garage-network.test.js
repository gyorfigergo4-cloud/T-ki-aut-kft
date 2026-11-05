const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net'),http=require('node:http');
const {createService}=require('../app/garage-service');
const {createDatabase}=require('../app/garage-database');
const Network=require('../app/garage-network');
const people=[{id:'p1',name:'Kovács Péter',cars:[{id:'c1',vehicle:'Škoda Octavia',vin:'VIN123',plate:'ABC-123'}]}];
async function port(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
const copy=x=>JSON.parse(JSON.stringify(x));
function rawRequest(port,token,route,method='GET',data,origin){return new Promise((resolve,reject)=>{const r=http.request({host:'127.0.0.1',port,path:route,method,headers:{authorization:'Bearer '+token,...(origin?{origin}:{} )}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString()}));});r.on('error',reject);if(data)r.write(JSON.stringify(data));r.end();});}
test('négy gép közös listája, változatvédelem és a privát jegyzetek bájtpontos elkülönítése',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'garage-lan-'));const services=[],sentinels=[];let host;
 try{
  for(let i=0;i<4;i++){const folder=path.join(dir,String(i));fs.mkdirSync(folder);for(const name of ['notes.json','archive.json','workorders.json']){const file=path.join(folder,name),content=Buffer.from(`PRIVATE MACHINE ${i} ${name} — soha ne kerüljön hálózatra`);fs.writeFileSync(file,content);sentinels.push([file,content]);}const s=createService(folder);services.push(s);await s.start();}
  host=services[0];const p=await port();await host.configure({mode:'host',port:p});const code=host.status().pairingCode;
  for(const client of services.slice(1))await client.configure({mode:'client',host:'127.0.0.1',port:p,token:code});
  const first=await services[1].load();await services[1].save({people,revision:first.revision});
  for(const s of services)assert.deepEqual((await s.load()).people,people);
  const a=await services[1].load(),b=await services[2].load();const modified=copy(a.people);modified[0].cars[0].plate='XYZ-456';
  await services[1].save({people:modified,revision:a.revision});
  await assert.rejects(()=>services[2].save({people:[],revision:b.revision}),e=>e.code==='conflict');
  assert.deepEqual((await services[3].load()).people,modified);
  const revision=(await host.load()).revision;
  const results=await Promise.allSettled(services.slice(1).map((s,i)=>s.save({people:[{...people[0],name:'Verseny '+i}],revision})));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.code==='conflict').length,2);
  for(const [file,content]of sentinels)assert.deepEqual(fs.readFileSync(file),content);
  for(let i=1;i<4;i++){assert.equal(fs.existsSync(path.join(dir,String(i),'garage.json')),false);assert.equal(fs.existsSync(path.join(dir,String(i),'shared-garage')),false);}
  const config={host:'127.0.0.1',port:p,token:code};
  for(const route of ['/notes','/archive','/workorders','/../notes.json','/garage?file=notes.json'])assert.equal((await rawRequest(p,code,route)).status,404);
  assert.equal((await rawRequest(p,'bad','/garage')).status,401);
  assert.equal((await rawRequest(p,code,'/garage','GET',null,'https://evil.example')).status,403);
  assert.equal((await rawRequest(p,code,'/garage','PUT',{people,revision,notes:[]})).status,400);
  const malicious=copy(people);malicious[0].notes='privát';assert.equal((await rawRequest(p,code,'/garage','PUT',{people:malicious,revision:(await host.load()).revision})).status,400);
  const response=await Network.request(config);assert.equal(JSON.stringify(response).includes('PRIVATE MACHINE'),false);
  const last=await services[3].load();await host.close();
  await assert.rejects(()=>services[3].save({people:[],revision:last.revision}));
  assert.equal(fs.existsSync(path.join(dir,'3','garage.json')),false);
  for(const [file,content]of sentinels)assert.deepEqual(fs.readFileSync(file),content);
  // Reopen the host using the retained config and the exact persisted revision.
  host=createService(path.join(dir,'0'));await host.start();assert.equal((await host.load()).revision,last.revision);assert.deepEqual((await services[3].load()).people,last.people);
 }finally{for(const s of services)await s.close();if(host)await host.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('hibás csatlakozás nem írja át a korábbi módot; helyi és közös autólista külön marad',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'garage-local-')),s=createService(dir);
 try{await s.start();const local=await s.load();await s.save({people,revision:local.revision});const unavailable=await port();
  await assert.rejects(()=>s.configure({mode:'client',host:'127.0.0.1',port:unavailable,token:'a'.repeat(32)}));assert.equal(s.status().mode,'local');assert.deepEqual((await s.load()).people,people);
  await s.configure({mode:'host',port:await port()});const shared=await s.load();assert.deepEqual(shared.people,people);await s.save({people:[],revision:shared.revision});await s.configure({mode:'local'});assert.deepEqual((await s.load()).people,people);
  await s.configure({mode:'host',port:await port()});assert.deepEqual((await s.load()).people,[]);
 }finally{await s.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('hálózati konfiguráció kizárólag helyi IP-t és hitelesített kapcsolatot enged',()=>{
 assert.throws(()=>Network.settings({mode:'client',host:'8.8.8.8',port:47831,token:'a'.repeat(32)}));
 assert.throws(()=>Network.settings({mode:'client',host:'192.168.1.20',port:80,token:'bad'}));
 assert.equal(Network.privateAddress('::ffff:192.168.1.20'),true);assert.equal(Network.privateAddress('192.169.1.20'),false);
});
test('sérült közös adatfájl megmarad; előző verzió biztonsági mentésben van',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'garage-db-')),file=path.join(dir,'people.json');
 try{const db=createDatabase(file,people),before=db.read();db.write([],before.revision);assert.deepEqual(JSON.parse(fs.readFileSync(file+'.bak','utf8')).people,people);assert.throws(()=>db.write(people,before.revision),e=>e.code==='conflict');fs.writeFileSync(file,'hibás');assert.throws(()=>createDatabase(file));assert.equal(fs.readFileSync(file,'utf8'),'hibás');}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
