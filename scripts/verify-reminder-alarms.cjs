const {spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),binary=require(root+'/node_modules/electron'),data=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'toki-alarms-'));
const dueAt=new Date(Date.now()+3500).toISOString();
fs.writeFileSync(path.join(data,'notes.json'),JSON.stringify([{id:'n',title:'Kovács Péter',body:'Saját helyi jegyzet',day:'2026-11-06',updated:'2026-11-06T08:00:00Z',reminders:[{id:'r',text:'Felhívni az ügyfelet az alkatrész miatt',done:false,createdAt:'2026-11-06T08:00:00.000Z',dueAt}]}]));
const privateFiles=[['archive.json',{years:[2026],days:['2026-11-06']}],['workorders.json',[]],['garage.json',[]]];for(const [name,value]of privateFiles)fs.writeFileSync(path.join(data,name),JSON.stringify(value));const before=new Map(privateFiles.map(([name])=>[name,fs.readFileSync(path.join(data,name))]));
let child,seq=0;
function call(content){const id=++seq;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('RPC timeout '+id)),12000);const handle=m=>{if(m.id!==id)return;clearTimeout(timer);child.off('message',handle);m.error?reject(Error(m.error)):resolve(m.result);};child.on('message',handle);child.send({id,...content});});}
const js=script=>call({script:`(async()=>{${script}})()`});
async function launch(){child=spawn(binary,[path.join(__dirname,'garage-electron-driver.cjs')],{cwd:root,env:{...process.env,TOKI_GUI_DATA:data},stdio:['ignore','pipe','pipe','ipc']});child.stderr.pipe(fs.createWriteStream(path.join(data,'electron-'+Date.now()+'.log')));await new Promise((r,j)=>{child.on('message',m=>m.ready?r():m.startupError?j(Error(m.startupError)):null);child.once('exit',code=>j(Error('Early exit '+code)));});}
async function stop(){if(!child||child.exitCode!==null)return;const old=child;await new Promise(r=>{old.once('exit',r);old.send({action:'exit'});});}
(async()=>{
 await launch();assert.equal((await call({action:'runtime'})).backgroundThrottling,false);
 await js(`if(document.getElementById('notes-view').hidden||!document.getElementById('garage-view').hidden||document.getElementById('tab-notes').getAttribute('aria-selected')!=='true')throw Error('Notes is not default');for(let i=0;i<80;i++){if(!document.getElementById('reminder-alarm-banner').hidden)return true;await new Promise(r=>setTimeout(r,100));}throw Error('Real-time alarm did not fire');`);
 await call({action:'resize',width:1760,height:950});
 const header=await js(`const b=document.getElementById('reminder-alarm-banner'),r=b.getBoundingClientRect();if(r.top<0||r.bottom>100||getComputedStyle(b).animationName!=='reminder-alarm-pulse')throw Error('Alarm is not blinking in header');return {x:278,y:0,width:innerWidth-278,height:140};`);
 await call({action:'screenshot',path:path.join(data,'ebreszto-felso-sav.png'),rect:header});
 await js(`await WorkOrdersUI.showWorkorders();if(document.getElementById('reminder-alarm-banner').closest('main').id!=='workorders-view')throw Error('Alarm missing on workorders');await WorkOrdersUI.showGarage();if(document.getElementById('reminder-alarm-banner').closest('main').id!=='garage-view')throw Error('Alarm missing on garage');await WorkOrdersUI.showNotes();return true;`);
 const start=Date.now();await js(`document.getElementById('reminder-alarm-snooze').click();await NotesFlush();return true;`);const end=Date.now();
 const stored=JSON.parse(fs.readFileSync(path.join(data,'notes.json')))[0].reminders[0];assert.equal(stored.dueAt,dueAt);const snooze=Date.parse(stored.snoozedUntil);assert.ok(snooze>=start+300000&&snooze<=end+300000);assert.equal(await js(`return document.getElementById('reminder-alarm-banner').hidden;`),true);
 await stop();await launch();assert.equal(await js(`return document.getElementById('reminder-alarm-banner').hidden;`),true);
 await js(`Date.now=()=>${snooze};RemindersUI.renderAlarm();if(document.getElementById('reminder-alarm-banner').hidden)throw Error('Snooze lost after restart');document.getElementById('reminder-alarm-done').click();await NotesFlush();return true;`);
 assert.equal(JSON.parse(fs.readFileSync(path.join(data,'notes.json')))[0].reminders[0].done,true);
 await stop();await launch();assert.equal(await js(`return document.getElementById('reminder-alarm-banner').hidden;`),true);
 await js(`document.getElementById('reminder-add').click();document.getElementById('reminder-text').value='Egyeztetés az ügyféllel';document.getElementById('reminder-alarm-enabled').checked=true;document.getElementById('reminder-alarm-enabled').dispatchEvent(new Event('change'));document.getElementById('reminder-alarm-time').value='2026-11-06T16:30';return true;`);
 const rect=await js(`const r=document.getElementById('reminder-edit').getBoundingClientRect();return {x:Math.floor(r.x)-8,y:Math.floor(r.y)-8,width:Math.ceil(r.width)+16,height:Math.ceil(r.height)+16};`);
 await call({action:'screenshot',path:path.join(data,'ebreszto-beallitasa.png'),rect});
 for(const [name,bytes]of before)assert.deepEqual(fs.readFileSync(path.join(data,name)),bytes,'Unexpected change in '+name);
 console.log('REMINDER_ALARM_OK: notes opens first; live deadline; header on every tab; 5-minute persisted snooze; restart catch-up; done stays done; private files isolated.');console.log('Evidence:',data);
})().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(async()=>{await stop();});
