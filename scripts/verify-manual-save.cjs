const {spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const root=path.resolve(__dirname,'..'),data=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'toki-manual-save-')),Items=require('../app/items');
const item={...Items.edit(Items.blank('i'),{partNumber:'3397007115',fullPrice:'20000',discountPercent:'35',supplier:'AP'}),vehicleId:'v'};
fs.writeFileSync(path.join(data,'notes.json'),JSON.stringify([{id:'n',title:'Kovács Péter',body:'Megmaradó saját jegyzet',day:'2026-11-06',updated:'2026-11-06T08:00:00Z',vehicles:[{id:'v',vin:'WVW12345678901234',brand:'Volkswagen Golf'}],activeVehicleId:'v',items:[item]}]));fs.writeFileSync(path.join(data,'archive.json'),JSON.stringify({years:[2026],days:['2026-11-06']}));let child,seq=0;
function call(content){const id=++seq;return new Promise((r,j)=>{const t=setTimeout(()=>j(Error('RPC timeout')),12000);const f=m=>{if(m.id!==id)return;clearTimeout(t);child.off('message',f);m.error?j(Error(m.error)):r(m.result);};child.on('message',f);child.send({...content,id});});}const js=s=>call({script:`(async()=>{${s}})()`});
async function launch(){child=spawn(require(root+'/node_modules/electron'),[path.join(__dirname,'garage-electron-driver.cjs')],{cwd:root,env:{...process.env,TOKI_GUI_DATA:data},stdio:['ignore','pipe','pipe','ipc']});child.stderr.pipe(fs.createWriteStream(path.join(data,'electron-'+Date.now()+'.log')));await new Promise(r=>child.on('message',m=>m.ready&&r()));}async function stop(){if(!child||child.exitCode!==null)return;const c=child;await new Promise(r=>{c.once('exit',r);c.send({action:'exit'});});}
(async()=>{
 await launch(); await call({action:'resize',width:1760,height:950});
 const original=fs.readFileSync(path.join(data,'notes.json'),'utf8');
 await js(`const input=document.getElementById('body');for(let i=0;i<20;i++){input.value='Mentés próba '+i;input.dispatchEvent(new Event('input'));await new Promise(r=>setTimeout(r,80));}await WorkOrdersUI.showWorkorders();await WorkOrdersUI.showNotes();return true;`);
 assert.equal(fs.readFileSync(path.join(data,'notes.json'),'utf8'),original,'Typing or tab switch wrote notes');
 await call({action:'screenshot',path:path.join(data,'kezi-mentes.png'),rect:{x:278,y:0,width:1482,height:140}});
 await js(`document.getElementById('save-notes').click();await NotesFlush();return true;`);
 assert.equal(JSON.parse(fs.readFileSync(path.join(data,'notes.json')))[0].body,'Mentés próba 19');
 await js(`const input=document.getElementById('body');input.value='Ctrl+S utolsó karakter';input.dispatchEvent(new Event('input'));window.dispatchEvent(new KeyboardEvent('keydown',{key:'s',ctrlKey:true,cancelable:true}));await NotesFlush();return true;`);
 assert.equal(JSON.parse(fs.readFileSync(path.join(data,'notes.json')))[0].body,'Ctrl+S utolsó karakter');
 await js(`await WorkOrdersUI.showWorkorders();await document.getElementById('wo-new').onclick();const input=document.getElementById('wo-customer');input.value='Saját munkalap';input.dispatchEvent(new Event('input'));if(document.getElementById('wo-error').textContent)throw Error(document.getElementById('wo-error').textContent);return true;`);
 const beforeManual=fs.existsSync(path.join(data,'workorders.json'))?JSON.parse(fs.readFileSync(path.join(data,'workorders.json'))):[];
 assert.equal(beforeManual.length,0,'Workorder typing wrote disk');
 await js(`await SaveLocalWork();return true;`);
 assert.equal(JSON.parse(fs.readFileSync(path.join(data,'workorders.json')))[0].customer,'Saját munkalap');
 await stop();await launch();
 assert.equal(await js(`return document.getElementById('body').value;`),'Ctrl+S utolsó karakter');
 console.log('MANUAL_SAVE_OK: 20 paced inputs and tab switches leave disk unchanged; Save and Ctrl+S persist last character after restart.');console.log('Evidence:',data);
})().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(stop);
