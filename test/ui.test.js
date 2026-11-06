const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const tick = () => new Promise(resolve => setImmediate(resolve));
const copy = value => JSON.parse(JSON.stringify(value));
async function openUI(saved, options = {}) {
  const dom = new JSDOM(fs.readFileSync('app/index.html', 'utf8'), { runScripts: 'outside-only', url: 'https://notes.local' });
  const { window } = dom;
  let closeRequest; const closeResults = [];
  window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new window.Event('close')); };
  window.notesAPI = {
    load: async () => copy(saved.notes), loadArchive: async () => copy(saved.archive),
    save: async notes => { saved.notes = copy(notes); }, saveArchive: async archive => { saved.archive = copy(archive); },
    ...(options.patches?{saveNoteChanges:async patch=>{saved.notes=require('../app/note-patches').apply(copy(saved.notes),copy(patch));}}:{}),
    export: async () => true, onAppCloseRequested: callback => { closeRequest = callback; }, completeAppClose: response => closeResults.push(copy(response)), appCloseReady: () => {}
  };
  for (const script of ['items.js', 'note-status.js', 'car-brands.js', 'vehicles.js', 'reminders.js', 'archive.js', 'order-status-ui.js', 'note-review-ui.js', 'renderer.js', 'reminders-ui.js', 'folder-import-ui.js', 'app-close-ui.js']) window.eval(fs.readFileSync('app/' + script, 'utf8'));
  if (!options.realReview) window.NoteReviewUI.confirm = () => true;
  await tick();
  const $ = id => window.document.getElementById(id);
  const input = (id, value) => { $(id).value = value; $(id).dispatchEvent(new window.Event('input')); };
  const submit = id => $(id).dispatchEvent(new window.Event('submit', { cancelable: true }));
  const newDay = day => { $('add-day').click(); $('day-value').value = day; submit('day-form'); };
  const cards = () => [...$('list').querySelectorAll('.note')];
  return { dom, $, input, submit, newDay, cards, closeResults, requestClose: token => closeRequest(token) };
}
test('év/hónap/nap mappák, napi több név, visszakeresés és újranyitás', async () => {
  const saved = { notes: [{ id: 'old', title: 'Régi ügyfél', body: 'Korábbi egyeztetés', updated: '2024-01-15T12:00:00Z' }], archive: { years: [2024, 2025, 2026], days: [] } };
  let ui = await openUI(saved);
  const { $, input, submit, newDay, cards } = ui;
  assert.deepEqual([...$('folders').querySelectorAll('[data-year]')].map(el => el.dataset.year), ['2024', '2025', '2026']);
  assert.equal($('title').value, 'Régi ügyfél');
  assert.equal($('folders').querySelector('[data-day="2024-01-15"]').getAttribute('aria-current'), 'true');
  newDay('2026-11-04'); await tick();
  assert.equal(cards().length, 0); assert.equal($('editor').hidden, true);
  $('new').click();
  for (const [id, value] of Object.entries({ title: 'Kovács Péter', vin: 'WVWZZZ1KZ6W123456', oil: 'Castrol EDGE 5W-30, 4,5 liter', body: 'Olajcsere' })) input(id, value);
  const editItem=(index,field,value)=>{const el=$('items-body').children[index].querySelector('[data-field="'+field+'"]');el.value=value;el.dispatchEvent(new ui.dom.window.Event('input'));};
  editItem(0,'partNumber','0986479123');editItem(0,'fullPrice','25000');editItem(0,'discountPercent','20');editItem(0,'supplier','IC');
  $('add-item').click();editItem(1,'partNumber','MANN HU 719/7 x');
  await tick();
  const firstId = saved.notes.find(note => note.title === 'Kovács Péter').id;
  assert.equal(saved.notes.find(note => note.id === firstId).day, '2026-11-04');
  assert.equal(saved.notes.find(n=>n.id===firstId).items[0].discountedPrice,'20000');
  $('new').click(); input('title', 'Nagy László'); editItem(0,'partNumber','BOSCH ABC-456'); await tick();
  assert.equal(cards().length, 2); assert.equal(saved.notes.length, 3);
  $('list').querySelector('[data-note="' + firstId + '"]').click();
  assert.equal($('title').value, 'Kovács Péter'); assert.equal($('items-body').children[0].querySelector('[data-field=partNumber]').value, '0986479123');assert.equal($('items-body').children.length,2);
  assert.equal($('oil').value, 'Castrol EDGE 5W-30, 4,5 liter');
  newDay('2026-11-05'); $('new').click(); input('title', 'Másnapi ügyfél'); await tick();
  assert.equal(cards().length, 1); assert.equal(saved.notes.length, 4);
  $('folders').querySelector('[data-day="2026-11-04"]').click(); assert.equal(cards().length, 2);
  newDay('2026-11-04'); await tick(); assert.equal(saved.notes.length, 4); assert.equal(cards().length, 2);
  for (const term of ['kovacs', '123456', 'MANN', 'Castrol', '5W-30', '25000', '20000']) {
    input('search', term); assert.equal(cards().length, 1, term); assert.equal($('title').value, 'Kovács Péter');
  }
  input('search', 'regi'); assert.equal(cards().length, 1); assert.equal($('title').value, 'Régi ügyfél');
  input('search', 'nincsilyen'); assert.equal(cards().length, 0); assert.equal($('editor').hidden, true);
  $('clear').click(); assert.equal(cards().length, 1);
  $('add-year').click(); $('year-value').value = '2027'; submit('year-form'); await tick();
  assert.ok(saved.archive.years.includes(2027));
  assert.equal($('folders').querySelector('[data-year="2027"]').nextElementSibling.querySelectorAll('[data-month]').length, 12);
  $('add-year').click(); $('year-value').value = '2027'; submit('year-form'); assert.match($('year-error').textContent, /már szerepel/); $('year-cancel').click();
  newDay('2027-01-05'); await tick(); assert.ok(saved.archive.days.includes('2027-01-05'));
  assert.equal($('editor').hidden, true); assert.equal(saved.notes.length, 4);
  await tick(); ui.dom.window.close();
  ui = await openUI(saved);
  assert.ok(ui.$('folders').querySelector('[data-year="2027"]'));
  const year2027=ui.$('folders').querySelector('[data-year="2027"]');if(year2027.getAttribute('aria-expanded')!=='true')year2027.click();
  const january2027=ui.$('folders').querySelector('[data-month="2027-01"]');if(january2027.getAttribute('aria-expanded')!=='true')january2027.click();
  assert.ok(ui.$('folders').querySelector('[data-day="2027-01-05"]'));
  ui.$('folders').querySelector('[data-day="2027-01-05"]').click();
  assert.equal(ui.cards().length, 0);
  ui.newDay('2026-11-04'); assert.equal(ui.cards().length, 2);ui.$('list').querySelector('[data-note="'+firstId+'"]').click();
  ui.input('title', 'Kovács Péter frissítve'); await tick();
  assert.equal(saved.notes.find(note => note.id === firstId).day, '2026-11-04');
  assert.equal(saved.notes.find(note => note.id === 'old').body, 'Korábbi egyeztetés');
  ui.dom.window.close();
});
test('egy név törlése megőrzi a napot és a többi adatlapot', async () => {
  const saved = { notes: [{ id: 'a', title: 'Anna', body: '', day: '2026-01-01', updated: '2026-01-01T12:00:00Z' }, { id: 'b', title: 'Béla', body: '', day: '2026-01-01', updated: '2026-01-01T12:00:00Z' }], archive: { years: [2024, 2025, 2026], days: [] } };
  let ui = await openUI(saved);
  ui.$('delete').click(); ui.$('remove').click(); await tick();
  assert.equal(saved.notes.length, 1); assert.equal(saved.notes[0].title, 'Béla');
  ui.$('delete').click(); ui.$('remove').click(); await tick();
  assert.equal(saved.notes.length, 0); assert.ok(saved.archive.days.includes('2026-01-01'));
  ui.dom.window.close();
  ui = await openUI(saved); assert.ok(ui.$('folders').querySelector('[data-day="2026-01-01"]')); ui.dom.window.close();
});
test('importált eredeti szöveg biztonságos megjelenítése és megőrzése szerkesztéskor', async () => {
  const original = 'Ügyfél\r\nA123 10.000Ft-6000Ft\r\n<script>window.injected=true</script>';
  const saved = { notes: [{ id: 'source', title: 'Importált ügyfél', body: original, vin: Array(5).fill('WVWZZZ1KZ6W123456').join(' / '), day: '2024-06-27', updated: '2024-06-27T12:00:00Z', source: { path: '2024/Június/jegyzet.txt', originalText: original } }], archive: { years: [2024, 2025, 2026], days: ['2024-06-27'] } };
  const ui = await openUI(saved);
  assert.equal(ui.$('import-source').hidden, false);
  assert.equal(ui.$('import-original').textContent, original);
  assert.equal(ui.$('import-original').querySelector('script'), null);
  assert.equal(ui.dom.window.injected, undefined);
  assert.ok(ui.$('vin').maxLength >= saved.notes[0].vin.length);
  assert.equal(ui.$('items-body').children.length,0);
  ui.input('body', 'Később módosított megjegyzés'); await tick();
  assert.equal(saved.notes[0].source.originalText, original);
  ui.dom.window.close();
});
test('hat oszlopos cikkszámtáblázat: számolás, db, beszállító, mentés és újranyitás', async () => {
 const saved={notes:[],archive:{years:[2024,2025,2026],days:[]}};
 let ui=await openUI(saved);
 ui.newDay('2026-11-04');ui.$('new').click();ui.input('title','Teszt ügyfél');
 const edit=(index,field,value)=>{const input=ui.$('items-body').children[index].querySelector('[data-field="'+field+'"]');input.value=value;input.dispatchEvent(new ui.dom.window.Event('input'));};
 edit(0,'partNumber','A123');edit(0,'fullPrice','10000');edit(0,'discountPercent','20');edit(0,'quantity','3');edit(0,'supplier','IC');
 ui.$('add-item').click();edit(1,'partNumber','B456');edit(1,'fullPrice','5000');edit(1,'discountPercent','10');edit(1,'quantity','2');edit(1,'supplier','Saját beszállító');
 await tick();
 assert.equal(saved.notes[0].items[0].discountedPrice,'8000');assert.equal(saved.notes[0].items[1].discountedPrice,'4500');
 assert.match(ui.$('total-discounted').textContent.replace(/\s/g,''),/33000Ft/);
 assert.equal(saved.notes[0].fullPrice,'40000');assert.equal(saved.notes[0].discountPrice,'33000');
 edit(0,'discountPercent','101');assert.equal(saved.notes[0].items[0].discountPercent,'20');assert.match(ui.$('item-error').textContent,/0 és 100/);
 ui.$('new').click();assert.equal(saved.notes.length,1,'Hibás mezővel ne vesszen el a szerkesztett sor');
 edit(0,'discountPercent','100');await tick();assert.equal(saved.notes[0].items[0].discountedPrice,'0');
 edit(0,'quantity','0');assert.equal(saved.notes[0].items[0].quantity,'3');assert.match(ui.$('item-error').textContent,/legalább 1/);
 edit(0,'quantity','3');edit(0,'discountPercent','20');await tick();
 ui.dom.window.close();ui=await openUI(saved);
 assert.equal(ui.$('items-body').children.length,2);
 assert.equal(ui.$('items-body').children[1].querySelector('[data-field=supplier]').value,'Saját beszállító');
 assert.equal(ui.$('items-body').children[0].querySelector('[data-field=discountedPrice]').value,'8000');
 ui.input('search','Saját beszállító');assert.equal(ui.cards().length,1);
 ui.$('items-body').children[1].querySelector('.remove-item').click();await tick();assert.equal(saved.notes[0].items.length,1);
 assert.equal(saved.notes[0].discountPrice,'24000');
 ui.$('items-body').children[0].querySelector('.remove-item').click();await tick();assert.equal(saved.notes[0].items.length,0);
 ui.dom.window.close();ui=await openUI(saved);assert.equal(ui.$('items-body').children.length,0);ui.dom.window.close();
});
test('az Excel-import előtti mentésvárás bevárja a függő írást és jelzi a lemezhibát', async () => {
 const saved={notes:[{id:'flush',title:'Régi név',body:'',day:'2026-11-04',updated:'2026-11-04T12:00:00Z'}],archive:{years:[2024,2025,2026],days:['2026-11-04']}};
 const ui=await openUI(saved);let release;
 ui.dom.window.notesAPI.save=notes=>new Promise(resolve=>{release=()=>{saved.notes=copy(notes);resolve();};});
 ui.input('title','Frissen módosított név');await tick();
 let completed=false;const pending=ui.dom.window.NotesFlush().then(()=>{completed=true;});
 await tick();assert.equal(completed,false);assert.equal(saved.notes[0].title,'Régi név');
 release();await pending;assert.equal(saved.notes[0].title,'Frissen módosított név');
 ui.dom.window.notesAPI.save=async()=>{throw new Error('disk full');};
 ui.input('title','Még nem menthető');await assert.rejects(ui.dom.window.NotesFlush(),/mentése nem sikerült/);
 assert.equal(saved.notes[0].title,'Frissen módosított név');ui.dom.window.close();
});
test('TXT-mappa: látható dátumválasztás, hiba és siker; a keresés nem rejti el a betöltött jegyzetet', async()=>{
 const saved={notes:[],archive:{years:[2024,2025,2026],days:['2026-11-04']}};
 const ui=await openUI(saved),w=ui.dom.window;let commits=0,closed=0;
 const file='Jegyzetek/2026/Február/Minta jármű.txt';
 w.notesAPI.importFolder=async()=>({ok:true,token:'fixture',files:1,issues:[{path:file,min:'2026-02-01',max:'2026-02-28',month:'2026. február'}]});
 w.notesAPI.closeFolderImport=async()=>{closed++;};
 w.notesAPI.commitFolderImport=async request=>{
  commits++;assert.equal(request.dates[file],'2026-02-14');
  saved.notes.push({id:'txt-test',title:'Áthozott ügyfél',body:'Teljes eredeti tartalom',day:'2026-02-14',updated:'2026-11-04T12:00:00Z'});
  return {ok:true,files:1,imported:1,days:1,noteId:'txt-test'};
 };
 ui.input('search','Nemlétező keresés');ui.$('import-folder').click();await tick();await tick();
 assert.equal(ui.$('folder-dialog').hasAttribute('open'),true);assert.equal(ui.$('folder-dates').hidden,false);
 const input=ui.$('folder-date-fields').querySelector('input');assert.equal(input.min,'2026-02-01');assert.equal(input.max,'2026-02-28');
 ui.$('folder-commit').click();await tick();assert.equal(commits,0,'Hiányzó nap mellett ne induljon részleges import');
 input.value='2026-03-01';ui.$('folder-commit').click();await tick();assert.equal(commits,0);
 input.value='2026-02-14';ui.$('folder-commit').click();await tick();await tick();
 assert.equal(commits,1);assert.match(ui.$('folder-message').textContent,/1 új bejegyzés/);assert.equal(ui.$('folder-view').hidden,false);
 assert.equal(ui.$('search').value,'');assert.equal(ui.$('title').value,'Áthozott ügyfél');assert.match(ui.$('breadcrumb').textContent,/2026.*Február.*14/);
 ui.$('folder-view').click();assert.equal(ui.$('folder-dialog').hasAttribute('open'),false);
 w.notesAPI.importFolder=async()=>({ok:false,error:'Nem olvasható a kiválasztott mappa.'});
 ui.$('import-folder').click();await tick();await tick();assert.equal(ui.$('folder-error').hidden,false);assert.match(ui.$('folder-error').textContent,/Nem olvasható/);assert.equal(ui.$('folder-choose').disabled,false);
 w.notesAPI.importFolder=async()=>({canceled:true});ui.$('folder-choose').click();await tick();await tick();assert.match(ui.$('folder-message').textContent,/Nem választottál/);
 assert.equal(saved.notes.length,1);assert.equal(closed,0,'Sikeres commit után már nincs megtartott munkamenet');w.close();
});
test('a nap szerint egyértelmű TXT-mappa külön megerősítés nélkül betöltődik és a bezárás eldobja a dátumválasztást',async()=>{
 const ui=await openUI({notes:[],archive:{years:[2024,2025,2026],days:[]}}),w=ui.dom.window;let imported=0,released=0;
 w.notesAPI.importFolder=async()=>({ok:true,token:'fixture',files:1,issues:[]});
 w.notesAPI.closeFolderImport=async()=>{released++;};
 w.notesAPI.commitFolderImport=async()=>{imported++;return {ok:true,files:1,imported:0,days:1,alreadyImported:true};};
 ui.$('import-folder').click();await tick();await tick();assert.equal(imported,1);assert.match(ui.$('folder-message').textContent,/már be van töltve/);ui.$('folder-close').click();
 w.notesAPI.importFolder=async()=>({ok:true,token:'new',files:1,issues:[{path:'Jegyzetek/2026/Február/Teszt.txt',min:'2026-02-01',max:'2026-02-28',month:'2026. február'}]});
 ui.$('import-folder').click();await tick();await tick();ui.$('folder-close').click();assert.equal(released,1);assert.equal(imported,1);w.close();
});
test('a rendelésjelölés látható, időponttal mentődik, újranyitáskor megmarad és visszavonható',async()=>{
 const saved={notes:[{id:'order-ui',title:'Minta ügyfél',body:'',day:'2026-11-04',updated:'2026-11-04T12:00:00Z',items:[{id:'a',partNumber:'A123',fullPrice:'10000',discountPercent:'20',discountedPrice:'8000',quantity:'2',supplier:'IC',priceMode:'auto'}]}],archive:{years:[2024,2025,2026],days:['2026-11-04']}};
 let ui=await openUI(saved);const checkbox=ui.$('items-body').querySelector('[data-field=ordered]');
 assert.equal(checkbox.checked,false);checkbox.click();await tick();
 assert.equal(saved.notes[0].items[0].ordered,true);assert.ok(Number.isFinite(Date.parse(saved.notes[0].items[0].orderedAt)));const stamp=saved.notes[0].items[0].orderedAt;
 assert.equal(ui.$('items-body').querySelector('time').getAttribute('datetime'),stamp);assert.match(ui.$('order-summary').textContent,/1 \/ 1/);assert.equal(saved.notes[0].discountPrice,'16000');
 ui.dom.window.close();ui=await openUI(saved);assert.equal(ui.$('items-body').querySelector('[data-field=ordered]').checked,true);assert.equal(ui.$('items-body').querySelector('time').getAttribute('datetime'),stamp);
 const quantity=ui.$('items-body').querySelector('[data-field=quantity]');quantity.value='3';quantity.dispatchEvent(new ui.dom.window.Event('input'));await tick();assert.equal(saved.notes[0].items[0].orderedAt,stamp);assert.equal(saved.notes[0].discountPrice,'24000');
 ui.$('items-body').querySelector('[data-field=ordered]').click();await tick();assert.equal(saved.notes[0].items[0].ordered,false);assert.equal(saved.notes[0].items[0].orderedAt,'');assert.equal(ui.$('items-body').querySelector('time').hidden,true);
 ui.$('items-body').querySelector('[data-field=ordered]').click();await tick();const part=ui.$('items-body').querySelector('[data-field=partNumber]');part.value='B456';part.dispatchEvent(new ui.dom.window.Event('input'));await tick();assert.equal(ui.$('items-body').querySelector('[data-field=ordered]').checked,false);assert.equal(saved.notes[0].items[0].orderedAt,'');
 ui.dom.window.close();
});
test('névkártya állapotának mentése és kétirányú ármezők újranyitás után is',async()=>{
 const saved={notes:[{id:'state-one',title:'Minta ügyfél',body:'',day:'2026-11-04',updated:'2026-11-04T12:00:00Z',items:[{id:'a',partNumber:'A123',fullPrice:'10000',discountPercent:'20',discountedPrice:'8000',quantity:'2',supplier:'Unitrack',priceMode:'auto'}]},{id:'state-two',title:'Másik ügyfél',body:'',day:'2026-11-04',updated:'2026-11-04T13:00:00Z',workflowStatus:'unfinished',items:[]}],archive:{years:[2024,2025,2026],days:['2026-11-04']}};
 let ui=await openUI(saved);
 const control=id=>ui.$('note-status-options').querySelector('[value="'+id+'"]'),card=id=>ui.$('list').querySelector('[data-note="'+id+'"]');
 assert.equal(control('written').checked,true);assert.equal(card('state-one').dataset.workflowStatus,'written');assert.equal(card('state-two').dataset.workflowStatus,'unfinished');
 for(const status of ['ordered','quote','unfinished','written','quote']){control(status).click();await tick();assert.equal(card('state-one').dataset.workflowStatus,status);assert.equal(saved.notes[0].workflowStatus,status);assert.equal(card('state-two').dataset.workflowStatus,'unfinished');}
 const field=name=>ui.$('items-body').querySelector('[data-field="'+name+'"]'),edit=(name,value)=>{const input=field(name);input.value=value;input.dispatchEvent(new ui.dom.window.Event('input'));};
 assert.equal(field('supplier').value,'Unitrak');assert.equal(field('discountedPrice').readOnly,false);
 edit('discountedPrice','7500');await tick();assert.equal(field('discountPercent').value,'25');assert.equal(saved.notes[0].items[0].discountedPrice,'7500');assert.equal(saved.notes[0].discountPrice,'15000');
 edit('fullPrice','12000');await tick();assert.equal(field('discountedPrice').value,'7500');assert.equal(field('discountPercent').value,'37.5');
 edit('discountPercent','10');await tick();assert.equal(field('discountedPrice').value,'10800');
 edit('discountedPrice','9000');await tick();assert.equal(field('discountPercent').value,'25');
 ui.dom.window.close();ui=await openUI(saved);assert.equal(control('quote').checked,true);assert.equal(card('state-one').dataset.workflowStatus,'quote');assert.equal(field('discountedPrice').value,'9000');assert.equal(field('discountPercent').value,'25');
 edit('discountedPrice','13000');await tick();assert.match(ui.$('item-error').textContent,/magasabb/);assert.equal(saved.notes[0].items[0].discountedPrice,'9000');
 edit('discountedPrice','9000');await tick();
 edit('fullPrice','8000');await tick();assert.equal(saved.notes[0].items[0].fullPrice,'12000');
 edit('discountedPrice','6000');await tick();assert.equal(saved.notes[0].items[0].fullPrice,'8000');assert.equal(field('discountPercent').value,'25');assert.equal(field('fullPrice').validity.valid,true);
 edit('discountedPrice','9000');await tick();assert.equal(saved.notes[0].items[0].discountedPrice,'6000');
 edit('fullPrice','10000');await tick();assert.equal(saved.notes[0].items[0].discountedPrice,'9000');assert.equal(field('discountPercent').value,'10');assert.equal(field('discountedPrice').validity.valid,true);
 ui.input('search','ajanlat');assert.equal(ui.cards().length,1);assert.equal(ui.$('title').value,'Minta ügyfél');ui.dom.window.close();
});
test('a csak kedvezményes árral rögzített tétel végösszege látszik teli ár nélkül is',async()=>{
 const saved={notes:[{id:'only-final',title:'Minta ügyfél',body:'',day:'2026-11-05',updated:'2026-11-05T08:00:00Z',fullPrice:'',discountPrice:'',items:[{id:'item',partNumber:'DEMO-FINAL',fullPrice:'',discountedPrice:'13500',discountPercent:'',priceMode:'manual',quantity:'1',supplier:'Láng'}]}],archive:{years:[2024,2025,2026],days:['2026-11-05']}};
 let ui=await openUI(saved);const amount=id=>ui.$(id).textContent.replace(/\s/g,'');
 assert.equal(amount('total-discounted'),'13500Ft');assert.equal(ui.$('total-discounted').previousElementSibling.textContent,'Kedvezményes összesen');assert.equal(amount('total-full'),'—');assert.equal(amount('total-savings'),'—');
 const field=name=>ui.$('items-body').querySelector('[data-field="'+name+'"]');assert.equal(field('discountPercent').value,'');assert.equal(field('discountPercent').placeholder,'—');
 field('quantity').value='2';field('quantity').dispatchEvent(new ui.dom.window.Event('input'));await tick();assert.equal(amount('total-discounted'),'27000Ft');assert.equal(saved.notes[0].discountPrice,'27000');assert.equal(saved.notes[0].fullPrice,'');
 ui.dom.window.close();ui=await openUI(saved);assert.equal(amount('total-discounted'),'27000Ft');assert.equal(field('discountPercent').value,'');
 field('fullPrice').value='20000';field('fullPrice').dispatchEvent(new ui.dom.window.Event('input'));await tick();assert.equal(field('discountPercent').value,'32.5');assert.equal(amount('total-full'),'40000Ft');assert.equal(amount('total-savings'),'13000Ft');assert.equal(amount('total-discounted'),'27000Ft');
 ui.dom.window.close();
});
test('Fizetve pipák soronként, egyben és részlegesen, a kártyaszín módosítása nélkül',async()=>{
 const item=id=>({id,partNumber:'DEMO-'+id,fullPrice:'10000',discountPercent:'20',discountedPrice:'8000',quantity:'1',supplier:'IC',priceMode:'auto'});
 const saved={notes:[{id:'paid-note',title:'Minta ügyfél',body:'',day:'2026-11-05',updated:'2026-11-05T08:00:00Z',workflowStatus:'quote',items:[item('one'),item('two')]},{id:'empty-note',title:'Másik ügyfél',body:'Jegyzet',day:'2026-11-05',updated:'2026-11-05T09:00:00Z',items:[]}],archive:{years:[2026],days:['2026-11-05']}};
 let ui=await openUI(saved);const paid=index=>ui.$('items-body').children[index].querySelector('[data-field=paid]');
 paid(0).click();await tick();assert.equal(saved.notes[0].items[0].paid,true);assert.equal(saved.notes[0].items[1].paid,false);assert.equal(ui.$('note-paid').indeterminate,true);assert.equal(ui.$('note-paid').checked,false);
 ui.$('note-paid').click();await tick();assert.equal(paid(0).checked,true);assert.equal(paid(1).checked,true);assert.equal(saved.notes[0].paid,true);assert.equal(saved.notes[0].workflowStatus,'quote');assert.equal(ui.cards().find(card=>card.classList.contains('active')).dataset.workflowStatus,'quote');assert.equal(saved.notes[0].discountPrice,'16000');
 ui.dom.window.close();ui=await openUI(saved);assert.equal(ui.$('note-paid').checked,true);assert.equal(paid(1).checked,true);paid(1).click();await tick();assert.equal(ui.$('note-paid').indeterminate,true);
 ui.$('list').querySelector('[data-note=empty-note]').click();ui.$('note-paid').click();await tick();assert.equal(saved.notes[1].paid,true);assert.equal(saved.notes[0].items[0].paid,true);assert.equal(saved.notes[0].items[1].paid,false);ui.dom.window.close();
});
test('több alvázszám és saját márka, keresés, törlés és újranyitás adatvesztés nélkül',async()=>{
 const vin1='WVWZZZ1KZ6W123456',vin2='WBAHT71010G123456';
 const saved={notes:[{id:'cars',title:'Minta ügyfél',body:'',vin:vin1,day:'2026-11-05',updated:'2026-11-05T08:00:00Z',source:{originalText:'Eredeti forrás'}}],archive:{years:[2026],days:['2026-11-05']}};
 let ui=await openUI(saved);const rows=()=>ui.$('vehicles-list').children,edit=(index,field,value)=>{const input=rows()[index].querySelector('[data-vehicle-field='+field+']');input.value=value;input.dispatchEvent(new ui.dom.window.Event('input'));if(field==='brand')input.dispatchEvent(new ui.dom.window.Event('change'));};
 assert.equal(ui.$('vin').value,vin1);assert.ok(ui.$('car-brands').children.length>=400);edit(0,'brand','vw');ui.$('add-vehicle').click();edit(1,'vin',vin2);edit(1,'brand','Ford');await tick();assert.equal(saved.notes[0].vehicles.length,2);assert.equal(saved.notes[0].vehicles[0].brand,'Volkswagen');assert.equal(saved.notes[0].vin,vin1+' / '+vin2);
 ui.input('search','Ford');assert.equal(ui.cards().length,1);ui.$('clear').click();edit(1,'brand','Saját márka');await tick();assert.ok([...ui.$('car-brands').children].some(option=>option.value==='Saját márka'));
 ui.dom.window.close();ui=await openUI(saved);assert.equal(rows().length,2);assert.equal(rows()[1].querySelector('[data-vehicle-field=brand]').value,'Saját márka');rows()[0].querySelector('button').click();await tick();assert.equal(saved.notes[0].vin,vin2);rows()[0].querySelector('button').click();await tick();assert.equal(saved.notes[0].vin,'');assert.deepEqual(saved.notes[0].vehicles,[]);assert.equal(saved.notes[0].source.originalText,'Eredeti forrás');
 ui.dom.window.close();ui=await openUI(saved);assert.equal(rows().length,0);ui.$('add-vehicle').click();assert.equal(rows().length,1);ui.dom.window.close();
});

test('emlékeztető létrehozása, gyors szöveg, teendőlista, kész jelölés, szerkesztés és újranyitás',async()=>{
 const saved={notes:[{id:'note',title:'Minta ügyfél',body:'Eredeti tartalom',day:'2026-11-05',updated:'2026-11-05T08:00:00Z'}],archive:{years:[2026],days:['2026-11-05']}};
 let ui=await openUI(saved);ui.$('reminder-add').click();assert.equal(ui.$('reminder-edit').open,true);ui.$('reminder-preset').value='Felhívni az ügyfelet';ui.$('reminder-preset').dispatchEvent(new ui.dom.window.Event('change'));assert.equal(ui.$('reminder-text').value,'Felhívni az ügyfelet');ui.submit('reminder-form');await tick();assert.equal(saved.notes[0].reminders.length,1);assert.equal(ui.$('reminders-count').textContent,'1');assert.equal(ui.$('reminder-edit').open,false);
 ui.$('reminders-open').click();assert.equal(ui.$('reminders-list').querySelectorAll('.reminder-row').length,1);ui.$('reminders-list').querySelector('.reminder-text').click();ui.input('reminder-text','Biztosan minden tételt felírtam?');ui.submit('reminder-form');await tick();assert.equal(saved.notes[0].reminders[0].text,'Biztosan minden tételt felírtam?');assert.equal(ui.$('reminders-dialog').open,true);
 const check=ui.$('reminders-list').querySelector('input[type=checkbox]');check.click();await tick();assert.equal(saved.notes[0].reminders[0].done,true);assert.equal(ui.$('reminders-count').textContent,'0');ui.$('reminders-filter').value='done';ui.$('reminders-filter').dispatchEvent(new ui.dom.window.Event('change'));assert.equal(ui.$('reminders-list').querySelectorAll('.reminder-row').length,1);ui.dom.window.close();
 ui=await openUI(saved);assert.equal(ui.$('note-reminders').querySelector('input').checked,true);assert.equal(saved.notes[0].body,'Eredeti tartalom');ui.$('note-reminders').querySelector('.reminder-remove').click();await tick();assert.equal(saved.notes[0].reminders.length,0);ui.dom.window.close();
});

test('névváltás és keresés kérdés nélkül, csak az appbezárás kérdez rá',async()=>{
 const saved={notes:[{id:'a',title:'Első minta',body:'',day:'2026-11-05',updated:'2026-11-05T08:00:00Z'},{id:'b',title:'Második minta',body:'',day:'2026-11-05',updated:'2026-11-05T09:00:00Z'}],archive:{years:[2026],days:['2026-11-05']}};
 const ui=await openUI(saved),calls=[];let accept=false;ui.dom.window.NoteReviewUI.confirm=request=>{calls.push(copy(request));return accept;};
 ui.input('body','Ezt már felírtam');ui.$('add-item').click();ui.$('add-vehicle').click();ui.$('list').querySelector('[data-note=b]').click();assert.equal(ui.$('title').value,'Második minta');ui.input('search','Első');assert.equal(ui.$('title').value,'Első minta');assert.equal(calls.length,0);
 assert.equal(await ui.dom.window.NotesPrepareClose(),false);assert.equal(calls.length,1);assert.equal(calls[0].title,'Kilépés előtti ellenőrzés');await tick();assert.equal(saved.notes[0].body,'Ezt már felírtam');accept=true;assert.equal(await ui.dom.window.NotesPrepareClose(),true);assert.equal(calls.length,2);ui.dom.window.close();
});
test('a közös kilépési kérdés a másik jegyzet nyitott teendőjét is mutatja',async()=>{
 const saved={notes:[{id:'a',title:'Első minta',body:'',day:'2026-11-05',updated:'2026-11-05T08:00:00Z',reminders:[{id:'call',text:'Felhívni az ügyfelet',done:false,createdAt:'2026-11-05T08:00:00.000Z'}]},{id:'b',title:'Másik minta',body:'',day:'2026-11-05',updated:'2026-11-05T09:00:00Z'}],archive:{years:[2026],days:[]}};
 const ui=await openUI(saved),requests=[];ui.dom.window.NoteReviewUI.confirm=request=>{requests.push(copy(request));return true;};ui.$('list').querySelector('[data-note=b]').click();assert.equal(requests.length,0);await ui.dom.window.NotesPrepareClose();assert.deepEqual(requests[0].pending,['Első minta: Felhívni az ügyfelet']);ui.$('list').querySelector('[data-note=a]').click();ui.$('note-reminders').querySelector('input').click();await tick();assert.equal(saved.notes[0].reminders[0].done,true);ui.$('list').querySelector('[data-note=b]').click();await ui.dom.window.NotesPrepareClose();assert.deepEqual(requests[1].pending,[]);assert.equal(requests.length,2);ui.dom.window.close();
});

test('az arculatos kilépési ablak Vissza és Escape után is nyitva tartja az appot, csak igen után engedi a bezárást',async()=>{
 const saved={notes:[{id:'a',title:'Minta ügyfél',body:'',day:'2026-11-05',updated:'2026-11-05T08:00:00Z',reminders:[{id:'call',text:'Felhívni az ügyfelet',done:false,createdAt:'2026-11-05T08:00:00.000Z'}]}],archive:{years:[2026],days:[]}};
 const ui=await openUI(saved,{realReview:true});ui.input('body','Ellenőrizendő tétel');let request=ui.requestClose('first');await tick();assert.equal(ui.$('note-review-dialog').open,true);assert.equal(ui.dom.window.document.activeElement.id,'note-review-back');assert.match(ui.$('note-review-tasks').textContent,/Felhívni/);ui.$('note-review-back').click();await request;assert.deepEqual(ui.closeResults,[{token:'first',approved:false}]);assert.equal(ui.$('body').value,'Ellenőrizendő tétel');assert.equal(ui.dom.window.document.body.inert,false);
 request=ui.requestClose('second');await tick();const escape=new ui.dom.window.Event('cancel',{cancelable:true});ui.$('note-review-dialog').dispatchEvent(escape);await request;assert.equal(escape.defaultPrevented,true);assert.deepEqual(ui.closeResults.at(-1),{token:'second',approved:false});
 request=ui.requestClose('third');await tick();ui.$('note-review-confirm').click();await request;assert.deepEqual(ui.closeResults.at(-1),{token:'third',approved:true});assert.equal(saved.notes[0].body,'Ellenőrizendő tétel');assert.equal(ui.dom.window.document.body.inert,true);ui.dom.window.close();
});
test('bezárás csak a jegyzet és a munkalap mentése után, mentési hiba esetén marad az ablak',async()=>{
 const saved={notes:[{id:'a',title:'Minta ügyfél',body:'',day:'2026-11-05',updated:'2026-11-05T08:00:00Z'}],archive:{years:[2026],days:[]}};
 const ui=await openUI(saved,{realReview:true});let release;ui.dom.window.notesAPI.save=async notes=>{await new Promise(resolve=>release=resolve);saved.notes=copy(notes);};ui.input('body','Várakozó mentés');await tick();const request=ui.requestClose('wait');await tick();ui.$('note-review-confirm').click();await tick();assert.equal(ui.closeResults.length,0);assert.equal(ui.dom.window.document.body.inert,true);release();await request;assert.deepEqual(ui.closeResults,[{token:'wait',approved:true}]);assert.equal(saved.notes[0].body,'Várakozó mentés');ui.dom.window.close();
 const fail=await openUI(saved,{realReview:true});fail.dom.window.notesAPI.save=async()=>{throw new Error('disk full');};fail.input('body','Új szöveg');await tick();const blocked=fail.requestClose('error');await tick();fail.$('note-review-confirm').click();await blocked;assert.deepEqual(fail.closeResults,[{token:'error',approved:false}]);assert.equal(fail.$('app-close-error').open,true);assert.equal(fail.dom.window.document.body.inert,false);assert.match(fail.$('app-close-error-text').textContent,/nyitva maradt/);fail.dom.window.close();
});
test('több szerkesztett név és nap után is egyetlen közös kérdés jelenik meg a bezáráskor',async()=>{
 const saved={notes:[{id:'a',title:'Első minta',body:'',day:'2026-11-05',updated:'2026-11-05T08:00:00Z'},{id:'b',title:'Másik minta',body:'',day:'2026-11-05',updated:'2026-11-05T09:00:00Z'}],archive:{years:[2026],days:[]}};
 const ui=await openUI(saved,{realReview:true});let questions=0;const original=ui.dom.window.NoteReviewUI.confirm;ui.dom.window.NoteReviewUI.confirm=request=>{questions++;return original(request);};ui.input('body','Első szerkesztés');ui.$('list').querySelector('[data-note=b]').click();ui.input('body','Második szerkesztés');ui.newDay('2026-11-06');ui.$('new').click();ui.input('title','Harmadik minta');assert.equal(questions,0);assert.equal(ui.$('note-review-dialog').open,false);const close=ui.requestClose('only');await tick();assert.equal(questions,1);ui.$('note-review-confirm').click();await close;assert.equal(questions,1);assert.deepEqual(ui.closeResults,[{token:'only',approved:true}]);assert.equal(saved.notes.length,3);ui.dom.window.close();
});

test('az előző kérdésablak késve érkező close eseménye nem zárja be az új kérdést',async()=>{
 const saved={notes:[],archive:{years:[2026],days:[]}},ui=await openUI(saved,{realReview:true});const review=ui.dom.window.NoteReviewUI;let first=review.confirm({title:'Minta',pending:[]});ui.$('note-review-back').click();assert.equal(await first,false);let settled=false;const second=review.confirm({title:'Második',pending:[]}).then(value=>{settled=true;return value;});ui.$('note-review-dialog').dispatchEvent(new ui.dom.window.Event('close'));await tick();assert.equal(ui.$('note-review-dialog').open,true);assert.equal(settled,false);ui.$('note-review-back').click();assert.equal(await second,false);ui.dom.window.close();
});

test('telefonszám mező: régi jegyzetnél üres, névenként mentődik, kereshető és újranyitáskor megmarad',async()=>{
 const saved={notes:[{id:'a',title:'Első minta',body:'Eredeti szöveg',day:'2026-11-05',updated:'2026-11-05T08:00:00Z'},{id:'b',title:'Másik minta',body:'',day:'2026-11-05',updated:'2026-11-05T09:00:00Z'}],archive:{years:[2026],days:[]}};
 let ui=await openUI(saved);assert.equal(ui.$('phone').value,'');assert.equal(ui.$('phone').type,'tel');ui.input('phone','+36 30 123 4567');await tick();assert.equal(saved.notes[0].phone,'+36 30 123 4567');ui.$('list').querySelector('[data-note=b]').click();assert.equal(ui.$('phone').value,'');ui.input('phone','06-1-234-5678 / 12');await tick();ui.input('search','123 4567');assert.equal(ui.cards().length,1);assert.equal(ui.$('title').value,'Első minta');assert.equal(ui.$('phone').value,'+36 30 123 4567');ui.dom.window.close();
 ui=await openUI(saved);assert.equal(ui.$('phone').value,'+36 30 123 4567');assert.equal(saved.notes[0].body,'Eredeti szöveg');ui.$('list').querySelector('[data-note=b]').click();assert.equal(ui.$('phone').value,'06-1-234-5678 / 12');ui.dom.window.close();
});

test('egy név alatt külön cikkszámok autónként, régi közös sorok hozzárendelése, mentés és kiválasztott munkalap',async()=>{
 const make=(id,code,price)=>({id,partNumber:code,fullPrice:price,discountPercent:'0',discountedPrice:price,quantity:'1',supplier:'IC',priceMode:'auto'});
 const saved={notes:[{id:'customer',title:'Egy ügyfél két autóval',phone:'+36 30 123 4567',body:'Közös megjegyzés',day:'2026-11-05',updated:'2026-11-05T08:00:00Z',vehicles:[{id:'a',vin:'WVWZZZ1KZ6W123456',brand:'Volkswagen'},{id:'b',vin:'WBAHT71010G123456',brand:'BMW'}],items:[make('old-a','PART-A','10000'),make('old-b','PART-B','5000')]}],archive:{years:[2026],days:[]}};
 let ui=await openUI(saved);const select=id=>ui.$('vehicle-tabs').querySelector('[data-vehicle-id="'+id+'"]').click(),field=(index,key)=>ui.$('items-body').children[index].querySelector('[data-field='+key+']'),edit=(index,key,value)=>{const input=field(index,key);input.value=value;input.dispatchEvent(new ui.dom.window.Event(input.tagName==='SELECT'?'change':'input'));};
 assert.equal(ui.$('vehicle-tabs').querySelector('[aria-selected=true]').dataset.vehicleId,'');assert.equal(ui.$('items-body').children.length,2);edit(0,'vehicleId','a');assert.equal(ui.$('items-body').children.length,1);edit(0,'vehicleId','b');assert.equal(ui.$('items-body').children.length,0);
 select('a');assert.equal(field(0,'partNumber').value,'PART-A');edit(0,'quantity','2');assert.equal(ui.$('total-discounted').textContent.replace(/\s/g,''),'20000Ft');select('b');assert.equal(field(0,'partNumber').value,'PART-B');assert.equal(field(0,'quantity').value,'1');edit(0,'quantity','3');ui.$('add-item').click();edit(1,'partNumber','PART-B-EXTRA');edit(1,'fullPrice','2000');await tick();assert.equal(saved.notes.length,1);assert.equal(saved.notes[0].items.length,3);assert.equal(saved.notes[0].items[2].vehicleId,'b');assert.equal(saved.notes[0].activeVehicleId,'b');ui.dom.window.close();
 ui=await openUI(saved);assert.equal(saved.notes[0].activeVehicleId,'b');assert.equal(ui.$('items-body').children.length,2);assert.equal(field(0,'quantity').value,'3');select('a');assert.equal(field(0,'quantity').value,'2');const snapshot=await ui.dom.window.NoteForWorkOrder();assert.equal(snapshot.vin,'WVWZZZ1KZ6W123456');assert.equal(snapshot.vehicle,'Volkswagen');assert.equal(snapshot.items.length,1);assert.equal(snapshot.items[0].partNumber,'PART-A');assert.equal(snapshot.phone,'+36 30 123 4567');
 select('b');edit(0,'discountPercent','10.2');select('a');ui.input('search','10.2');assert.equal(ui.$('vehicle-tabs').querySelector('[aria-selected=true]').dataset.vehicleId,'b');ui.$('clear').click();ui.input('search','PART-B-EXTRA');assert.equal(ui.cards().length,1);assert.equal(ui.$('vehicle-tabs').querySelector('[aria-selected=true]').dataset.vehicleId,'b');assert.equal(ui.$('items-body').children.length,2);assert.equal(saved.notes[0].body,'Közös megjegyzés');await tick();ui.dom.window.close();
});
test('új autó új üres cikkszámlistával indul, hibás tételnél nem vált, törléskor a sorok megmaradnak',async()=>{
 const saved={notes:[{id:'a',title:'Minta',body:'',vin:'WVWZZZ1KZ6W123456',day:'2026-11-05',updated:'2026-11-05T08:00:00Z',items:[{id:'part',partNumber:'FIRST-CAR',fullPrice:'10000',discountPercent:'0',discountedPrice:'10000',quantity:'1',supplier:'IC',priceMode:'auto',ordered:true,paid:true}]}],archive:{years:[2026],days:[]}};
 let ui=await openUI(saved);const first=ui.$('vehicle-tabs').querySelector('[aria-selected=true]').dataset.vehicleId;ui.$('add-vehicle').click();ui.input('vin-'+ui.$('vehicles-list').lastElementChild.dataset.vehicleId,'WBAHT71010G123456');const second=ui.$('vehicles-list').lastElementChild.dataset.vehicleId;assert.notEqual(first,second);assert.equal(ui.$('items-body').children.length,1);assert.equal(ui.$('items-body').querySelector('[data-field=partNumber]').value,'');let input=ui.$('items-body').querySelector('[data-field=partNumber]');input.value='SECOND-CAR';input.dispatchEvent(new ui.dom.window.Event('input'));
 const count=ui.$('items-body').querySelector('[data-field=quantity]');count.value='0';count.dispatchEvent(new ui.dom.window.Event('input'));ui.$('vehicle-tabs').querySelector('[data-vehicle-id="'+first+'"]').click();assert.equal(ui.$('vehicle-tabs').querySelector('[aria-selected=true]').dataset.vehicleId,second);count.value='2';count.dispatchEvent(new ui.dom.window.Event('input'));ui.$('vehicle-tabs').querySelector('[data-vehicle-id="'+first+'"]').click();assert.equal(ui.$('items-body').querySelector('[data-field=partNumber]').value,'FIRST-CAR');assert.equal(ui.$('items-body').querySelector('[data-field=paid]').checked,true);
 ui.$('vehicles-list').querySelector('[data-vehicle-id="'+second+'"] .remove-vehicle').click();await tick();assert.equal(saved.notes[0].vehicles.length,1);assert.equal(saved.notes[0].items.length,2);assert.equal(saved.notes[0].items.find(i=>i.partNumber==='SECOND-CAR').vehicleId,'');assert.equal(saved.notes[0].items[0].paid,true);ui.dom.window.close();ui=await openUI(saved);ui.$('vehicle-tabs').querySelector('[data-vehicle-id=""]').click();assert.equal(ui.$('items-body').querySelector('[data-field=partNumber]').value,'SECOND-CAR');assert.equal(ui.$('items-body').querySelector('[data-field=quantity]').value,'2');ui.dom.window.close();
});

test('új név a nap névsorának elejére kerül és újranyitás után ott marad; szerkesztés nem rendezi át',async()=>{
 const saved={notes:[{id:'old-a',title:'Korábbi A',body:'',day:'2026-11-05',created:'2026-11-05T08:00:00Z',updated:'2026-11-05T08:00:00Z'},{id:'old-b',title:'Korábbi B',body:'',day:'2026-11-05',created:'2099-11-05T09:00:00Z',updated:'2026-11-05T09:00:00Z'}],archive:{years:[2026],days:['2026-11-05']}};
 let ui=await openUI(saved);try{ui.$('new').click();ui.input('title','Legújabb név');await tick();const id=ui.cards()[0].dataset.note;assert.equal(ui.cards()[0].querySelector('strong').textContent,'Legújabb név');
 ui.cards().find(b=>b.dataset.note==='old-a').click();ui.input('body','Módosított régi jegyzet');await tick();assert.equal(ui.cards()[0].dataset.note,id);ui.dom.window.close();ui=await openUI(saved);assert.equal(ui.cards()[0].dataset.note,id);assert.equal(saved.notes.find(n=>n.id==='old-a').body,'Módosított régi jegyzet');}finally{ui.dom.window.close();}
});
test('a rendelésjelölő kikapcsolva Nincs megrendelve, bekapcsolva Megrendelve feliratú',async()=>{
 const saved={notes:[],archive:{years:[2026],days:['2026-11-05']}};const ui=await openUI(saved);try{ui.$('new').click();const part=ui.$('items-body').querySelector('[data-field=partNumber]');part.value='TEST-123';part.dispatchEvent(new ui.dom.window.Event('input'));let cell=ui.$('items-body').querySelector('.item-order-cell');assert.equal(cell.querySelector('.item-order-toggle span').textContent,'Nincs megrendelve');cell.querySelector('[data-field=ordered]').click();await tick();assert.equal(cell.querySelector('.item-order-toggle span').textContent,'Megrendelve');cell.querySelector('[data-field=ordered]').click();await tick();assert.equal(cell.querySelector('.item-order-toggle span').textContent,'Nincs megrendelve');assert.equal(saved.notes[0].items[0].ordered,false);}finally{ui.dom.window.close();}
});

test('ébresztő beállítása, felső jelzés, 5 perc szundi, újranyitás és kész jelölés',async()=>{
 const saved={notes:[{id:'n',title:'Ébresztős ügyfél',body:'Megmaradó jegyzet',day:'2026-11-06',updated:'2026-11-06T08:00:00Z'}],archive:{years:[2026],days:['2026-11-06']}};
 let ui=await openUI(saved);try{
 let now=Date.parse('2026-11-06T12:00:00.000Z');ui.dom.window.Date.now=()=>now;
 ui.$('reminder-add').click();ui.input('reminder-text','Felhívni az ügyfelet');ui.$('reminder-alarm-enabled').checked=true;ui.$('reminder-alarm-enabled').dispatchEvent(new ui.dom.window.Event('change'));
 ui.$('reminder-alarm-time').value=ui.dom.window.NoteReminders.localInput(new Date(now+60000).toISOString());ui.submit('reminder-form');await tick();
 assert.equal(saved.notes[0].reminders[0].dueAt,new Date(now+60000).toISOString());ui.dom.window.RemindersUI.renderAlarm();assert.equal(ui.$('reminder-alarm-banner').hidden,true);
 now+=60000;ui.dom.window.RemindersUI.renderAlarm();assert.equal(ui.$('reminder-alarm-banner').hidden,false);assert.match(ui.$('reminder-alarm-owner').textContent,/Ébresztős ügyfél/);assert.equal(ui.$('reminder-alarm-text').textContent,'Felhívni az ügyfelet');
 ui.$('reminder-alarm-snooze').click();await tick();assert.equal(Date.parse(saved.notes[0].reminders[0].snoozedUntil),now+300000);assert.equal(ui.$('reminder-alarm-banner').hidden,true);
 const before=now;ui.dom.window.close();ui=await openUI(saved);ui.dom.window.Date.now=()=>before+300000;ui.dom.window.RemindersUI.renderAlarm();assert.equal(ui.$('reminder-alarm-banner').hidden,false);
 ui.$('reminder-alarm-done').click();await tick();assert.equal(saved.notes[0].reminders[0].done,true);assert.equal(ui.$('reminder-alarm-banner').hidden,true);assert.equal(saved.notes[0].body,'Megmaradó jegyzet');
 }finally{ui.dom.window.close();}
});
test('több lejárt ébresztő lapozható, csak a kiválasztott lesz kész; szövegjavítás nem törli a szundit',async()=>{
 const make=(id,title)=>({id,title,body:'Saját '+id,day:'2026-11-06',updated:'2026-11-06T08:00:00Z',reminders:[{id:'r'+id,text:'Hívás '+title,done:false,createdAt:'2026-11-06T08:00:00.000Z',dueAt:'2026-11-06T09:00:00.000Z',snoozedUntil:'2026-11-06T09:05:00.000Z'}]});
 const saved={notes:[make('a','Anna'),make('b','Béla')],archive:{years:[2026],days:['2026-11-06']}};const ui=await openUI(saved);try{
 ui.dom.window.Date.now=()=>Date.parse('2026-11-06T10:00:00Z');ui.dom.window.RemindersUI.renderAlarm();assert.equal(ui.$('reminder-alarm-count').textContent,'1/2');ui.$('reminder-alarm-next').click();assert.match(ui.$('reminder-alarm-owner').textContent,/Béla/);ui.$('reminder-alarm-done').click();await tick();assert.equal(saved.notes.find(n=>n.id==='b').reminders[0].done,true);assert.equal(saved.notes.find(n=>n.id==='a').reminders[0].done,false);
 ui.$('note-reminders').querySelector('.reminder-text').click();ui.input('reminder-text','Javított szöveg');ui.submit('reminder-form');await tick();assert.equal(saved.notes.find(n=>n.id==='a').reminders[0].snoozedUntil,'2026-11-06T09:05:00.000Z');
 ui.$('note-reminders').querySelector('.reminder-text').click();ui.$('reminder-alarm-enabled').checked=false;ui.$('reminder-alarm-enabled').dispatchEvent(new ui.dom.window.Event('change'));ui.submit('reminder-form');await tick();assert.equal('dueAt' in saved.notes.find(n=>n.id==='a').reminders[0],false);assert.equal('snoozedUntil' in saved.notes.find(n=>n.id==='a').reminders[0],false);assert.equal(ui.$('reminder-alarm-banner').hidden,true);
 }finally{ui.dom.window.close();}
});
test('gyors gépelés mentése összevonható, de a folyamatban lévő és a legutolsó állapot is sértetlen',async()=>{
 const saved={notes:[{id:'n',title:'Ügyfél',body:'Eredeti',day:'2026-11-06',updated:'2026-11-06T08:00:00Z'}],archive:{years:[2026],days:['2026-11-06']}};const ui=await openUI(saved);try{
 let writes=0,release;const received=[];ui.dom.window.notesAPI.save=async rows=>{writes++;received.push(copy(rows));if(writes===1)await new Promise(r=>{release=r;});saved.notes=copy(rows);};
 for(let i=0;i<20;i++)ui.input('body','Gépelés '+i);await tick();assert.equal(writes,1);assert.equal(received[0][0].body,'Gépelés 19');
 for(let i=20;i<40;i++)ui.input('body','Gépelés '+i);await tick();assert.equal(writes,1);assert.equal(received[0][0].body,'Gépelés 19');let flushed=false;const waiting=ui.dom.window.NotesFlushForClose().then(()=>{flushed=true;});await tick();assert.equal(flushed,false);release();await waiting;assert.equal(writes,2);assert.equal(saved.notes[0].body,'Gépelés 39');assert.equal(received[1][0].body,'Gépelés 39');
 }finally{ui.dom.window.close();}
});
test('nagy keresési lista lapozható, minden találat elérhető, szerkesztés után a kereső nem ad régi eredményt',async()=>{
 const saved={notes:Array.from({length:185},(_,i)=>({id:'n'+i,title:'Minta ügyfél '+i,body:'Közös keresőszó',day:'2026-11-06',updated:'2026-11-06T08:00:00Z'})),archive:{years:[2026],days:['2026-11-06']}};const ui=await openUI(saved);try{
 ui.input('search','Közös keresőszó');assert.equal(ui.cards().length,80);assert.match(ui.$('day-description').textContent,/185 találat/);assert.equal(ui.$('notes-search-pages').hidden,false);const seen=new Set(ui.cards().map(c=>c.dataset.note));ui.$('notes-search-next').click();ui.cards().forEach(c=>seen.add(c.dataset.note));ui.$('notes-search-next').click();ui.cards().forEach(c=>seen.add(c.dataset.note));assert.equal(seen.size,185);assert.equal(ui.cards().length,25);assert.equal(ui.$('notes-search-next').disabled,true);
 ui.input('search','Minta ügyfél 184');assert.equal(ui.cards().length,1);ui.input('title','Új egyedi név');await tick();assert.equal(ui.cards().length,0);ui.input('search','Új egyedi név');assert.equal(ui.cards().length,1);assert.equal(ui.cards()[0].dataset.note,'n184');ui.$('clear').click();assert.equal(ui.$('notes-search-pages').hidden,true);
 }finally{ui.dom.window.close();}
});
test('kis jegyzetmódosítások mentése: új név, kiválasztott autó, pipák és törlés újranyitás után',async()=>{
 const saved={notes:[{id:'keep',title:'Megmarad',body:'Érintetlen',updated:'2026-11-06T08:00:00Z',day:'2026-11-06'}],archive:{years:[2026],days:['2026-11-06']}};let ui=await openUI(saved,{patches:true});try{
 ui.$('new').click();ui.input('title','Új ügyfél');const part=ui.$('items-body').querySelector('[data-field=partNumber]');part.value='TEST-1';part.dispatchEvent(new ui.dom.window.Event('input'));ui.$('items-body').querySelector('[data-field=arrived]').click();await ui.dom.window.NotesFlush();
 const id=saved.notes[0].id;assert.equal(saved.notes[0].items[0].arrived,true);assert.equal(saved.notes[0].items[0].paid,false);assert.equal(saved.notes[0].items[0].ordered,false);assert.equal(saved.notes.find(n=>n.id==='keep').body,'Érintetlen');
 ui.dom.window.close();ui=await openUI(saved,{patches:true});assert.equal(ui.$('items-body').querySelector('[data-field=arrived]').checked,true);const p=ui.$('items-body').querySelector('[data-field=partNumber]');p.value='TEST-2';p.dispatchEvent(new ui.dom.window.Event('input'));assert.equal(ui.$('items-body').querySelector('[data-field=arrived]').checked,false);await ui.dom.window.NotesFlush();assert.equal(saved.notes[0].items[0].arrived,false);
 ui.$('delete').click();ui.$('remove').click();await ui.dom.window.NotesFlush();assert.equal(saved.notes.some(n=>n.id===id),false);assert.equal(saved.notes.length,1);assert.equal(saved.notes[0].body,'Érintetlen');
 }finally{ui.dom.window.close();}
});
test('részleges mentési hiba után minden függő módosítás újrapróbálható, más jegyzet nem vész el',async()=>{
 const saved={notes:[{id:'a',title:'A',body:'Régi A',day:'2026-11-06',updated:'2026-11-06T08:00:00Z'},{id:'b',title:'B',body:'Régi B',day:'2026-11-06',updated:'2026-11-06T08:00:00Z'}],archive:{years:[2026],days:['2026-11-06']}};const ui=await openUI(saved,{patches:true});try{
 ui.dom.window.notesAPI.saveNoteChanges=async()=>{throw Error('disk');};ui.input('body','Új A');await assert.rejects(ui.dom.window.NotesFlush(),/mentése nem sikerült/);assert.equal(saved.notes[0].body,'Régi A');
 let payload;ui.dom.window.notesAPI.saveNoteChanges=async p=>{payload=copy(p);saved.notes=require('../app/note-patches').apply(saved.notes,copy(p));};ui.$('list').querySelector('[data-note=b]').click();ui.input('body','Új B');await ui.dom.window.NotesFlush();assert.equal(payload.upserts.length,2);assert.equal(saved.notes.find(n=>n.id==='a').body,'Új A');assert.equal(saved.notes.find(n=>n.id==='b').body,'Új B');
 }finally{ui.dom.window.close();}
});
