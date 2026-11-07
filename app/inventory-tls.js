const forge=require('node-forge'),fs=require('node:fs'),path=require('node:path');
const {atomic}=require('./inventory-db');
function credentials(dir,addresses){
 const file=path.join(dir,'inventory-tls.json');let saved=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
 const pki=forge.pki,now=new Date();
 if(!saved){const pair=pki.rsa.generateKeyPair(2048),ca=pki.createCertificate();ca.publicKey=pair.publicKey;ca.serialNumber='01'+forge.util.bytesToHex(forge.random.getBytesSync(15));ca.validity.notBefore=new Date(now.getTime()-86400000);ca.validity.notAfter=new Date(now.getTime()+10*365*86400000);ca.setSubject([{name:'commonName',value:'Toki Auto helyi raktar CA'}]);ca.setIssuer(ca.subject.attributes);ca.setExtensions([{name:'basicConstraints',cA:true,critical:true},{name:'keyUsage',keyCertSign:true,cRLSign:true,critical:true}]);ca.sign(pair.privateKey,forge.md.sha256.create());saved={ca:pki.certificateToPem(ca),caKey:pki.privateKeyToPem(pair.privateKey)};}
 const ips=[...new Set(['127.0.0.1',...addresses])].sort();
 if(!saved.key||JSON.stringify(saved.ips)!==JSON.stringify(ips)||Date.parse(saved.expires)<now.getTime()+7*86400000){
  const pair=pki.rsa.generateKeyPair(2048),cert=pki.createCertificate(),ca=pki.certificateFromPem(saved.ca);cert.publicKey=pair.publicKey;cert.serialNumber='02'+forge.util.bytesToHex(forge.random.getBytesSync(15));cert.validity.notBefore=new Date(now.getTime()-86400000);cert.validity.notAfter=new Date(now.getTime()+365*86400000);cert.setSubject([{name:'commonName',value:'Toki Auto raktar'}]);cert.setIssuer(ca.subject.attributes);cert.setExtensions([{name:'basicConstraints',cA:false,critical:true},{name:'keyUsage',digitalSignature:true,keyEncipherment:true,critical:true},{name:'extKeyUsage',serverAuth:true},{name:'subjectAltName',altNames:ips.map(ip=>({type:7,ip}))}]);cert.sign(pki.privateKeyFromPem(saved.caKey),forge.md.sha256.create());Object.assign(saved,{key:pki.privateKeyToPem(pair.privateKey),cert:pki.certificateToPem(cert),ips,expires:cert.validity.notAfter.toISOString()});atomic(file,saved);
 }
 return {key:saved.key,cert:saved.cert,ca:saved.ca};
}
module.exports={credentials};
