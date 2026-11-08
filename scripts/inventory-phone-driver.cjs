const {app,BrowserWindow,session}=require('electron'),fs=require('node:fs'),{X509Certificate}=require('node:crypto');
app.commandLine.appendSwitch('use-fake-device-for-media-stream');app.commandLine.appendSwitch('use-fake-ui-for-media-stream');app.commandLine.appendSwitch('use-file-for-fake-video-capture',process.env.TOKI_PHONE_VIDEO);
app.setPath('userData',process.env.TOKI_PHONE_DATA);let win;
app.whenReady().then(async()=>{
 const ca=new X509Certificate(fs.readFileSync(process.env.TOKI_PHONE_CA));
 // Test trust store: accept only a certificate signed by this test's local CA,
 // valid for the exact host. No global TLS bypass is used.
 session.defaultSession.setCertificateVerifyProc((r,done)=>{try{const cert=new X509Certificate(r.certificate.data);const now=Date.now();done(cert.verify(ca.publicKey)&&cert.checkIssued(ca)&&cert.checkIP(r.hostname)&&Date.parse(cert.validFrom)<=now&&Date.parse(cert.validTo)>now?0:-2);}catch{done(-2);}});
 session.defaultSession.setPermissionRequestHandler((wc,permission,callback)=>callback(permission==='media'&&wc.getURL().startsWith(process.env.TOKI_PHONE_URL)));
 win=new BrowserWindow({width:430,height:900,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
 await win.loadURL(process.env.TOKI_PHONE_URL);await win.webContents.executeJavaScript("document.getElementById('operator').value='Teszt telefonos';");process.send({ready:true});
}).catch(e=>{process.send({startupError:e.message});app.exit(1);});
process.on('message',async m=>{try{if(m.action==='exit'){app.exit(0);return;}if(m.action==='screenshot'){fs.writeFileSync(m.path,(await win.webContents.capturePage()).toPNG());process.send({id:m.id,result:true});return;}const result=await win.webContents.executeJavaScript(m.script);process.send({id:m.id,result});}catch(e){process.send({id:m.id,error:e.message});}});
