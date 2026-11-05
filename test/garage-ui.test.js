const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {JSDOM}=require('jsdom');
const tick=()=>new Promise(r=>setImmediate(r));
async function open(initial=[]){const dom=new JSDOM(fs.readFileSync('app/index.html','utf8'),{runScripts:'outside-only',url:'https://local.test'});const w=dom.window;let data=JSON.parse(JSON.stringify(initial)),fail=false;
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 w.notesAPI={loadGarage:async()=>({people:JSON.parse(JSON.stringify(data)),revision:'r1'}),saveGarage:async v=>{if(fail)return {ok:false,code:'unavailable',message:'Nem sikerült menteni.'};data=JSON.parse(JSON.stringify(v.people));return {ok:true,revision:'r1'};}};
 w.WorkOrdersUI={showGarage:()=>{}};for(const file of ['garage-model.js','garage-ui.js'])w.eval(fs.readFileSync('app/'+file,'utf8'));await w.GarageUI.ready;
 return {w,$:id=>w.document.getElementById(id),saved:()=>data,setFail:v=>{fail=v;},close:()=>w.close()};}
test('buborékos felület: név, autó, módosítás, keresés, törlés és újranyitás',async()=>{
 const app=await open(),{$,w}=app;try{
 $('garage-new').click();$('garage-field-name').value='Kovács Péter';$('garage-edit-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
 assert.equal(app.saved()[0].name,'Kovács Péter');assert.equal($('garage-people').querySelector('button').getAttribute('aria-expanded'),'true');
 $('garage-add-car').click();$('garage-field-vehicle').value='Škoda Octavia';$('garage-field-vin').value='VIN123';$('garage-field-plate').value='ABC-123';$('garage-edit-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
 assert.equal(app.saved()[0].cars.length,1);assert.match($('garage-cars').textContent,/VIN123/);
 $('garage-cars').querySelector('button').click();$('garage-field-plate').value='XYZ-456';$('garage-edit-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();assert.equal(app.saved()[0].cars[0].plate,'XYZ-456');
 $('garage-search').value='xyz-456';$('garage-search').dispatchEvent(new w.Event('input'));assert.equal($('garage-people').children.length,1);
 const reopened=await open(app.saved());assert.match(reopened.$('garage-people').textContent,/Kovács Péter/);reopened.close();
 $('garage-cars').querySelectorAll('button')[1].click();$('garage-delete-cancel').click();assert.equal(app.saved()[0].cars.length,1);
 $('garage-cars').querySelectorAll('button')[1].click();$('garage-delete-confirm').click();await tick();assert.equal(app.saved()[0].cars.length,0);
 $('garage-delete-person').click();$('garage-delete-confirm').click();await tick();assert.equal(app.saved().length,0);
 }finally{app.close();}
});
test('Excel előnézet és ismétlésvédelem; mentési hiba után a szerkesztő megmarad és újrapróbálható',async()=>{
 const app=await open(),{$,w}=app;try{
 $('garage-import').click();$('garage-paste').value='Név\tAutó\tAlvázszám\tRendszám\nTeszt Név\tGolf\tVIN123\tABC-123';$('garage-paste').dispatchEvent(new w.Event('input'));assert.equal($('garage-import-save').disabled,false);assert.equal($('garage-preview').children.length,1);
 app.setFail(true);$('garage-import-save').click();await tick();assert.equal(app.saved().length,0);assert.equal($('garage-import-dialog').hasAttribute('open'),true);assert.match($('garage-import-error').textContent,/Nem sikerült/);
 app.setFail(false);$('garage-import-save').click();await tick();assert.equal(app.saved()[0].cars.length,1);
 $('garage-import').click();$('garage-paste').value='Név\tAutó\tAlvázszám\tRendszám\nTeszt Név\tGolf\tVIN123\tABC-123';$('garage-paste').dispatchEvent(new w.Event('input'));assert.equal($('garage-import-save').disabled,true);assert.match($('garage-import-summary').textContent,/1 teljesen azonos/);
 }finally{app.close();}
});
