const {app}=require('electron');const root=require('node:path').resolve(__dirname,'..');let win;
app.setPath('userData',process.env.TOKI_GUI_DATA);
app.on('browser-window-created',(_,w)=>{win=w;w.webContents.once('did-finish-load',async()=>{try{await w.webContents.executeJavaScript('GarageUI.ready');await w.webContents.executeJavaScript("document.getElementById('stock-operator').value='Teszt raktáros';");process.send({ready:true});}catch(e){process.send({startupError:e.message});}});});
process.on('message',async message=>{try{
 if(message.action==='exit'){app.exit(0);return;}
 if(message.action==='quit-attempt'){app.quit();process.send({id:message.id,result:true});return;}
 if(message.action==='save-dialog-target'){require('electron').dialog.showSaveDialog=async()=>message.path?{canceled:false,filePath:message.path}:{canceled:true};process.send({id:message.id,result:true});return;}
 if(message.action==='runtime'){process.send({id:message.id,result:{backgroundThrottling:win.webContents.getBackgroundThrottling()}});return;}
 if(message.action==='resize'){win.setSize(message.width,message.height);process.send({id:message.id,result:true});return;}
 if(message.action==='escape'){win.focus();win.webContents.focus();win.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});process.send({id:message.id,result:true});return;}
 if(message.action==='screenshot'){const fs=require('node:fs');fs.writeFileSync(message.path,(await win.webContents.capturePage(message.rect)).toPNG());process.send({id:message.id,result:true});return;}
 const result=await win.webContents.executeJavaScript(message.script);process.send({id:message.id,result});
}catch(e){process.send({id:message.id,error:e.message});}});
require(root+'/app/main.js');
