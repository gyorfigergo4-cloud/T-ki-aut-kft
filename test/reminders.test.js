const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const Reminders=require('../app/reminders'),store=require('../app/store'),{normalize}=require('../app/archive');
const reminder=id=>({id,text:'Felhívni a minta ügyfelet',done:false,createdAt:'2026-11-05T08:00:00.000Z'});
const note=rows=>({id:'n',title:'Minta ügyfél',body:'Megmaradó szöveg',day:'2026-11-05',updated:'2026-11-05T08:00:00Z',reminders:rows});
test('több teendő, kész jelölés és adatérvényesség',()=>{
 const data=[note([reminder('one'),{...reminder('done'),done:true},reminder('two')])];Reminders.validate(data[0].reminders);assert.deepEqual(Reminders.entries(data).map(e=>e.reminder.id),['one','two','done']);
 for(const bad of [{text:' '},{done:'igen'},{createdAt:''}])assert.throws(()=>Reminders.validate([{...reminder('bad'),...bad}]));assert.throws(()=>Reminders.validate([reminder('a'),reminder('a')]));
});
test('a régi jegyzet és eredeti forrás megmarad, emlékeztetők mentődnek, hibás adat nem írja felül őket',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'toki-reminders-'));
 try{const old={id:'old',title:'Régi minta',body:'Eredeti tartalom',updated:'2024-06-27T12:00:00Z',vin:'Régi alvázszám',source:{originalText:'Eredeti forrás'}};const normalized=normalize([old],{years:[],days:[]}).notes[0];assert.deepEqual(normalized.reminders,[]);assert.equal(normalized.vin,old.vin);assert.equal(normalized.source.originalText,old.source.originalText);
 const file=path.join(dir,'notes.json');store.write(file,[note([reminder('call')]),normalized]);const before=fs.readFileSync(file);assert.equal(store.read(file)[0].reminders[0].text,'Felhívni a minta ügyfelet');assert.throws(()=>store.write(file,[note([{...reminder('bad'),done:1}])]));assert.ok(before.equals(fs.readFileSync(file)));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('időzített ébresztő: pontos határidő, 5 perces szundi és kész jelölés',()=>{
 const now=Date.parse('2026-11-06T10:30:00.000Z');
 const r={...reminder('alarm'),dueAt:new Date(now).toISOString()};
 assert.equal(Reminders.due([note([r])],now-1).length,0);assert.equal(Reminders.due([note([r])],now).length,1);
 const delayed=Reminders.snooze(r,now);assert.equal(Date.parse(delayed.snoozedUntil)-now,300000);
 assert.equal(Reminders.due([note([delayed])],now+299999).length,0);assert.equal(Reminders.due([note([delayed])],now+300000).length,1);
 assert.equal(Reminders.due([note([{...delayed,done:true}])],now+999999).length,0);
 assert.equal(Reminders.due([note([reminder('untimed')])],now).length,0);
 for(const patch of [{dueAt:'hibás'},{snoozedUntil:new Date(now).toISOString()},{dueAt:new Date(now).toISOString(),snoozedUntil:''}])assert.throws(()=>Reminders.validate([{...reminder('bad'),...patch}]));
});
test('ébresztő és szundi a helyi jegyzetben megmarad újranyitáskor; hibás idő nem írja felül',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'toki-alarm-'));try{
 const file=path.join(dir,'notes.json'),r={...reminder('alarm'),dueAt:'2026-11-06T10:30:00.000Z'};store.write(file,[note([Reminders.snooze(r,Date.parse(r.dueAt))])]);
 const loaded=store.read(file);assert.equal(loaded[0].reminders[0].snoozedUntil,'2026-11-06T10:35:00.000Z');const bytes=fs.readFileSync(file);assert.throws(()=>store.write(file,[note([{...r,dueAt:'nem időpont'}])]));assert.deepEqual(fs.readFileSync(file),bytes);
 const local='2026-11-06T12:34';assert.equal(Reminders.localInput(Reminders.parseLocal(local)),local);assert.throws(()=>Reminders.parseLocal('2026-02-30T12:00'));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
