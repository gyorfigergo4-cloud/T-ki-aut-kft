const {spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),net=require('node:net'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),binary=require(root+'/node_modules/electron'),folder=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'toki-lan-gui-'));
const children=[],sentinels=[];let seq=0;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function call(child,content){const id=++seq;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.off('message',handle);reject(Error('RPC timeout id '+id+' PC '+children.indexOf(child)))},15000);function handle(m){if(m.id!==id)return;clearTimeout(timer);child.off('message',handle);m.error?reject(Error(m.error)):resolve(m.result);}child.on('message',handle);child.send({id,...content});});}
const js=(child,script)=>call(child,{script:`(async()=>{${script}})()`});
async function freePort(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
async function main(){
 const port=await freePort();
 for(let i=0;i<4;i++){
  const data=path.join(folder,'pc'+i);fs.mkdirSync(data);
  const note={id:'note-'+i,title:'Saját ügyfél '+i,body:'CSAK EZEN A GÉPEN '+i,updated:'2026-11-05T10:00:00Z',created:'2026-11-05T10:00:00Z',day:'2026-11-05'};
  const doc=require(root+'/app/workorders-model').blank('wo-'+i,'2026-11-05',[],'item-'+i);doc.customer='Saját munkalap '+i;
  for(const [name,value]of [['notes.json',[note]],['archive.json',{years:[2026],days:['2026-11-05']}],['workorders.json',[doc]]]){const file=path.join(data,name);fs.writeFileSync(file,JSON.stringify(value,null,2));sentinels.push([file,fs.readFileSync(file)]);}
  const child=spawn(binary,[path.join(__dirname,'garage-electron-driver.cjs')],{cwd:root,env:{...process.env,TOKI_GUI_DATA:data},stdio:['ignore','pipe','pipe','ipc']});children.push(child);
  const logs=fs.createWriteStream(path.join(folder,'pc'+i+'.log'));child.stdout.pipe(logs);child.stderr.pipe(logs);
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout PC '+i)),15000);child.on('message',m=>{if(m.ready){clearTimeout(timer);resolve();}if(m.startupError){clearTimeout(timer);reject(Error(m.startupError));}});child.once('exit',code=>reject(Error('Early exit PC '+i+': '+code)));});
 }
 const form=async(child,mode,code)=>js(child,`
  await WorkOrdersUI.showGarage();document.getElementById('garage-network-open').click();await new Promise(r=>setTimeout(r,120));
  const $=id=>document.getElementById(id);$('garage-network-mode').value=${JSON.stringify(mode)};$('garage-network-mode').dispatchEvent(new Event('change'));$('garage-network-port').value=${port};$('garage-network-host').value='127.0.0.1';$('garage-network-token').value=${JSON.stringify(code||'')};$('garage-network-form').requestSubmit();
  for(let i=0;i<60;i++){await new Promise(r=>setTimeout(r,100));if($('garage-network-result').textContent.startsWith('✓'))break;if($('garage-network-error').textContent)throw Error($('garage-network-error').textContent);}
  if(!$('garage-network-result').textContent.startsWith('✓'))throw Error('Configuration timeout');$('garage-network-cancel').click();await new Promise(r=>setTimeout(r,150));return notesAPI.garageNetworkStatus();`);
 console.log('Phase: configure four PCs');const status=await form(children[0],'host');assert.ok(status.pairingCode);
 for(const child of children.slice(1))await form(child,'client',status.pairingCode);
 console.log('Phase: shared Excel import');await js(children[1],`
  const $=id=>document.getElementById(id);$('garage-import').click();$('garage-paste').value='Név\\tAutó\\tAlvázszám\\tRendszám\\nKovács Péter\\tŠkoda Octavia\\tTMB12345678901234\\tABC-123\\nKovács Péter\\tVolkswagen Golf\\tWVW12345678901234\\tXYZ-456';$('garage-paste').dispatchEvent(new Event('input'));if($('garage-import-save').disabled)throw Error($('garage-import-error').textContent);$('garage-import-save').click();await new Promise(r=>setTimeout(r,250));if($('garage-import-dialog').open)throw Error($('garage-import-error').textContent);return true;`);
 // No manual refresh: the remaining renderers must observe the change through polling.
 console.log('Phase: automatic renderer refresh');for(const child of children){const result=await js(child,`for(let i=0;i<65;i++){if(document.querySelectorAll('#garage-people button').length===1)return true;await new Promise(r=>setTimeout(r,100));}throw Error('Polling did not update');`);assert.equal(result,true);}
 // Two editors open the same revision; the second save must not overwrite the first.
 console.log('Phase: overlapping edits');for(const child of children.slice(1,3))await js(child,`document.querySelector('#garage-people button').click();document.querySelector('#garage-cars button').click();document.getElementById('garage-car-edit').click();return true;`);
 await js(children[1],`document.getElementById('garage-field-plate').value='NEW-001';document.getElementById('garage-field-plate').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('garage-edit-form').requestSubmit();await new Promise(r=>setTimeout(r,200));if(document.getElementById('garage-edit-dialog').open)throw Error(document.getElementById('garage-edit-error').textContent);return true;`);
 await js(children[2],`document.getElementById('garage-field-plate').value='OLD-002';document.getElementById('garage-field-plate').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('garage-edit-form').requestSubmit();await new Promise(r=>setTimeout(r,200));if(!document.getElementById('garage-edit-dialog').open||!document.getElementById('garage-edit-error').textContent.includes('Valaki közben'))throw Error('Missing conflict guard');document.getElementById('garage-edit-cancel').click();return true;`);
 const shared=await js(children[3],`return notesAPI.loadGarage();`);assert.equal(shared.people[0].cars[0].plate,'NEW-001');
 for(const [file,before]of sentinels)assert.deepEqual(fs.readFileSync(file),before,'Private data changed by garage: '+file);
 await js(children[3],`document.querySelector('#garage-people button').click();document.querySelector('#garage-cars button').click();return true;`);
 await call(children[3],{action:'screenshot',path:path.join(folder,'autonyilvantarto.png')});
 // A cancelled app quit must leave the central server running.
 console.log('Phase: cancelled native quit');await call(children[0],{action:'quit-attempt'});await delay(150);
 await js(children[0],`if(!document.getElementById('note-review-dialog').open)throw Error('Close guard missing');document.getElementById('note-review-back').click();return true;`);
 assert.equal((await js(children[3],`return notesAPI.loadGarage();`)).people.length,1);
 // Notes are still editable independently, and do not appear on the other PCs.
 console.log('Phase: private notes');await js(children[3],`document.getElementById('garage-car-dialog').close();document.getElementById('garage-person-dialog').close();await WorkOrdersUI.showNotes();const body=document.getElementById('body');body.value='Csak a negyedik gép új jegyzete';body.dispatchEvent(new Event('input',{bubbles:true}));await NotesFlushForClose();return true;`);
 for(let i=0;i<3;i++)assert.equal(JSON.parse(fs.readFileSync(path.join(folder,'pc'+i,'notes.json')))[0].body,'CSAK EZEN A GÉPEN '+i);
 assert.equal(JSON.parse(fs.readFileSync(path.join(folder,'pc3','notes.json')))[0].body,'Csak a negyedik gép új jegyzete');
 // Stop the central PC: private notes must continue to save on a client.
 children[0].send({action:'exit'});await delay(100);
 await js(children[3],`const body=document.getElementById('body');body.value='A központ nélkül is saját jegyzet';body.dispatchEvent(new Event('input',{bubbles:true}));await NotesFlushForClose();return true;`);
 assert.equal(JSON.parse(fs.readFileSync(path.join(folder,'pc3','notes.json')))[0].body,'A központ nélkül is saját jegyzet');
 for(const [file,before]of sentinels.filter(([file])=>!file.endsWith('pc3/notes.json')))assert.deepEqual(fs.readFileSync(file),before);
 console.log('FOUR_ELECTRON_PC_OK: shared import, automatic refresh, conflict protection, cancelled quit, private note isolation, offline private note editing.');
 console.log('Evidence directory:',folder);
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(()=>{for(const child of children)if(!child.killed)child.kill('SIGKILL');});
