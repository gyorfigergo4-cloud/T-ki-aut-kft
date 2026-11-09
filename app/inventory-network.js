const http=require('node:http'),https=require('node:https'),fs=require('node:fs'),path=require('node:path'),{timingSafeEqual}=require('node:crypto');
const {privateAddress}=require('./garage-network'),{StockError}=require('./inventory-db');
const MAX=16*1024*1024;
function handler({database,token,phone=false,ca,catalog}){
 return async(req,res)=>{
  const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; media-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'",'Permissions-Policy':'camera=(self), microphone=()'};
  const send=(status,data,type='application/json; charset=utf-8')=>{res.writeHead(status,{...headers,'Content-Type':type});res.end(type.startsWith('application/json')?JSON.stringify(data):data);};
  if(!privateAddress(req.socket.remoteAddress))return send(403,{error:'Csak a helyi hálózatról használható.'});
  if(req.method==='GET'&&req.url==='/inventory-ca.crt'&&ca)return send(200,ca,'application/x-x509-ca-cert');
  if(phone&&req.method==='GET'){
   const assets={'/':['inventory-phone.html','text/html; charset=utf-8'],'/camera.js':['inventory-camera.js','text/javascript; charset=utf-8'],'/phone.js':['inventory-phone.js','text/javascript; charset=utf-8'],'/phone.css':['inventory-phone.css','text/css; charset=utf-8'],'/warehouse-map.js':['warehouse-map.js','text/javascript; charset=utf-8'],'/warehouse-map-ui.js':['warehouse-map-ui.js','text/javascript; charset=utf-8'],'/warehouse-map.css':['warehouse-map.css','text/css; charset=utf-8']};
   if(assets[req.url]){const [name,type]=assets[req.url];return send(200,fs.readFileSync(path.join(__dirname,name)),type);}
   if(req.url==='/zxing.js')return send(200,fs.readFileSync(require.resolve('@zxing/browser/umd/zxing-browser.min.js')),'text/javascript; charset=utf-8');
  }
  const parsed=new URL(req.url,'http://localhost'),isCatalog=parsed.pathname==='/api/catalog';
  if(req.url!=='/api/stock'&&!(isCatalog&&catalog))return send(404,{error:'Nincs ilyen végpont.'});
  if(req.headers.origin&&(!phone||req.headers.origin!=='https://'+req.headers.host))return send(403,{error:'Idegen weboldal nem férhet hozzá.'});
  const a=Buffer.from(req.headers.authorization||''),b=Buffer.from('Bearer '+token);if(a.length!==b.length||!timingSafeEqual(a,b))return send(401,{error:'Hibás raktárkapcsolati kód.',code:'unauthorized'});
  if(!['GET','POST'].includes(req.method))return send(405,{error:'Nem engedélyezett művelet.'});
  try{
   if(isCatalog){if(req.method!=='GET')return send(405,{error:'A katalógus csak olvasható.'});return send(200,catalog.search({query:parsed.searchParams.get('query')||'',category:parsed.searchParams.get('category')||'',offset:Number(parsed.searchParams.get('offset')||0)}));}
   if(req.method==='GET')return send(200,database.read());
   let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>MAX)return send(413,{error:'Túl nagy kérés.'});chunks.push(c);}
   const body=JSON.parse(Buffer.concat(chunks));
   if(phone&&(!['product','receive','link-barcode'].includes(body.type)||(body.type==='product'&&body.product?.id)))return send(403,{error:'Telefonról csak bevételezés és új termék rögzítése engedélyezett.'});
   send(200,database.command(body));
  }catch(e){send(e.code==='insufficient'?409:400,{error:e.message||'A raktárművelet nem sikerült.',code:e.code||'invalid'});}
 };
}
function listen(server,port){server.requestTimeout=15000;server.headersTimeout=15000;return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'0.0.0.0',()=>{server.removeListener('error',reject);server.on('error',()=>{});resolve(server);});});}
async function start({database,token,port,phoneToken,tls,catalog}){
 let desktop,phone;try{desktop=await listen(http.createServer(handler({database,token,ca:tls.ca,catalog})),port);phone=await listen(https.createServer(tls,handler({database,token:phoneToken,phone:true,ca:tls.ca,catalog})),port+1);return {close:async()=>{await Promise.all([desktop,phone].map(s=>new Promise(r=>{s.closeAllConnections();s.close(r);})));}};}catch(e){desktop?.close();phone?.close();throw new StockError('A raktár portja nem indítható ('+port+' / '+(port+1)+'). Ellenőrizd, nem foglalt-e.','unavailable');}
}
function request(config,command,route='/api/stock'){return new Promise((resolve,reject)=>{
 const body=command?JSON.stringify(command):undefined;
 const req=http.request({host:config.host,port:config.port,path:route,method:body?'POST':'GET',headers:{Authorization:'Bearer '+config.token,...(body?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}:{})}},res=>{
  let size=0,chunks=[];res.on('data',c=>{size+=c.length;if(size>MAX)res.destroy();else chunks.push(c);});res.on('error',()=>reject(new StockError('Megszakadt a raktárkapcsolat. Próbáld újra ugyanazt a műveletet.','unavailable')));res.on('end',()=>{try{const d=JSON.parse(Buffer.concat(chunks));if(res.statusCode!==200)return reject(new StockError(d.error,d.code||'invalid'));if(route.startsWith('/api/catalog')){if(!Array.isArray(d.rows)||!Number.isSafeInteger(d.total))throw Error();}else if(!Array.isArray(d.products)||typeof d.revision!=='string')throw Error();resolve(d);}catch{reject(new StockError('Érvénytelen válasz a raktártól.','unavailable'));}});
 });req.setTimeout(5000,()=>req.destroy());req.on('error',()=>reject(new StockError('A közös raktár nem érhető el. A központi gépen fusson a program és legyen bekapcsolva a Raktár. Ellenőrizd a tűzfalat is.','unavailable')));if(body)req.write(body);req.end();
 });}
module.exports={start,request,handler};
