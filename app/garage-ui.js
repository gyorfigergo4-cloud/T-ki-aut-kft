(function(){
 const $=id=>document.getElementById(id),Model=window.GarageModel;
 let people=[],selected=null,loaded=false,busy=false,queue=Promise.resolve(),editAction=null,deleteAction=null,rows=[],preview=null,dirty=false,revision=null,connected=false,networkInfo={mode:'local'},polling=false,conflict=false,selectedCar=null,carPage=0;
 const uid=()=>crypto.randomUUID();
 const fold=s=>s.toLocaleLowerCase('hu').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const current=()=>people.find(p=>p.id===selected);
 function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
 function button(text,action,cls){const b=node('button',text,cls);b.type='button';b.onclick=action;return b;}
 function setBusy(value){busy=value;for(const id of ['garage-backup','garage-new','garage-import','garage-edit-save','garage-edit-cancel','garage-delete-confirm','garage-delete-cancel','garage-import-cancel'])$(id).disabled=value||!loaded||(['garage-backup','garage-new','garage-import'].includes(id)&&!connected);for(const id of ['garage-rename','garage-delete-person','garage-add-car','garage-car-edit','garage-car-delete'])$(id).disabled=value||!connected;for(const d of ['garage-edit-dialog','garage-import-dialog']){for(const input of $(d).querySelectorAll('input,textarea,select'))input.disabled=value;}}
 async function commit(next){
  if(busy||!loaded)throw Error('Várd meg a folyamatban lévő mentést.');if(conflict)throw Error('Előbb zárd be az ablakot a Mégse gombbal, várd meg a lista frissítését, majd nyisd meg újra.');Model.validate(next);setBusy(true);$('garage-status').textContent='Mentés…';
  const save=window.notesAPI.saveGarage({people:next,revision});queue=Promise.resolve(save).catch(()=>{});
  try{const result=await save;if(result?.ok===false){conflict=result.code==='conflict';const e=Error(result.message);e.code=result.code;throw e;}people=next;revision=result?.revision||revision;connected=true;dirty=false;$('garage-status').textContent='✓ Minden adat mentve';render();}
  catch(error){if(error.code!=='conflict')connected=false;$('garage-status').textContent='A mentés nem sikerült';throw Error('Nem sikerült menteni. '+(error.message||'Az ablak nyitva marad; próbáld újra.'));}
  finally{setBusy(false);}
 }
 function render(){
  const query=fold($('garage-search').value.trim());const visible=people.filter(p=>fold([p.name,...p.cars.flatMap(c=>[c.vehicle,c.vin,c.plate])].join(' ')).includes(query)).sort((a,b)=>a.name.localeCompare(b.name,'hu'));
  $('garage-count').textContent=`${people.length} név · ${people.reduce((n,p)=>n+p.cars.length,0)} autó`;
  $('garage-people').replaceChildren();
  for(const p of visible){
   const b=button('',()=>openPerson(p.id),'garage-bubble');b.dataset.personId=p.id;b.setAttribute('aria-expanded',String(selected===p.id&&$('garage-person-dialog').open));b.setAttribute('aria-controls','garage-person-dialog');b.setAttribute('aria-haspopup','dialog');
   const avatar=node('span',p.name.trim().split(/\s+/).slice(0,2).map(s=>s[0]).join('').toLocaleUpperCase('hu'),'garage-avatar');avatar.setAttribute('aria-hidden','true');const label=node('span');label.append(node('strong',p.name),node('small',`${p.cars.length} autó`));b.append(avatar,label);$('garage-people').append(b);
  }
  $('garage-empty').hidden=visible.length>0;if(people.length){$('garage-empty').querySelector('h3').textContent='Nincs találat.';$('garage-empty').querySelector('p').textContent='Próbálj másik nevet, rendszámot vagy alvázszámot.';}
  else{$('garage-empty').querySelector('h3').textContent='Az első névvel kezdődik.';$('garage-empty').querySelector('p').textContent='Adj hozzá egy nevet, vagy másold be a meglévő listádat Excelből.';}
  renderCars();
 }
 function openPerson(id){
  if(busy)return;selected=id;selectedCar=null;carPage=0;
  const query=$('garage-search').value.trim();$('garage-car-search').value=fold(current()?.name||'').includes(fold(query))?'':query;
  if(!$('garage-person-dialog').open)$('garage-person-dialog').showModal();render();$('garage-person-close').focus({preventScroll:true});
 }
 function renderCars(){
  const person=current();$('garage-detail').hidden=!person;$('garage-cars').replaceChildren();
  if(!person){$('garage-car-dialog').close();$('garage-person-dialog').close();return;}
  $('garage-person-name').textContent=person.name;
  const query=fold($('garage-car-search').value.trim());const cars=person.cars.filter(c=>fold([c.vehicle,c.vin,c.plate].join(' ')).includes(query));
  const pages=Math.max(1,Math.ceil(cars.length/6));carPage=Math.min(carPage,pages-1);
  for(const car of cars.slice(carPage*6,carPage*6+6)){
   const bubble=button('',()=>openCar(car.id),'garage-bubble garage-car-bubble');bubble.dataset.carId=car.id;bubble.setAttribute('aria-haspopup','dialog');bubble.setAttribute('aria-controls','garage-car-dialog');
   const mark=node('span','▰','garage-avatar');mark.setAttribute('aria-hidden','true');const label=node('span',undefined,'garage-car-label');label.append(node('strong',car.vehicle||'Jármű'),node('small',car.plate||'Rendszám nincs megadva'));bubble.append(mark,label);$('garage-cars').append(bubble);
  }
  if(!cars.length)$('garage-cars').append(node('p',person.cars.length?'Nincs ilyen autó. Próbálj másik keresést.':'Még nincs autó ennél a névnél. Az Autó hozzáadása gombbal veheted fel.'));
  $('garage-car-page').textContent=`${cars.length} autó · ${carPage+1} / ${pages}. oldal`;$('garage-car-prev').disabled=carPage===0;$('garage-car-next').disabled=carPage>=pages-1;
  renderCarData();
 }
 function openCar(id){selectedCar=id;renderCarData();if(!$('garage-car-dialog').open)$('garage-car-dialog').showModal();$('garage-car-close').focus({preventScroll:true});}
 function renderCarData(){
  const person=current(),car=person?.cars.find(c=>c.id===selectedCar);
  if(!car){$('garage-car-dialog').close();selectedCar=null;return;}
  $('garage-car-owner').textContent=person.name;$('garage-car-title').textContent=car.vehicle||'Jármű';$('garage-car-vin').textContent=car.vin||'Nincs megadva';$('garage-car-plate').textContent=car.plate||'Nincs megadva';
  $('garage-car-edit').disabled=busy||!connected;$('garage-car-delete').disabled=busy||!connected;
 }
 for(const id of ['garage-person-dialog','garage-car-dialog']){
  const dialog=$(id);
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dialog.close();}});
  dialog.addEventListener('keyup',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();}});
  dialog.addEventListener('cancel',event=>{event.preventDefault();event.stopPropagation();dialog.close();});
 }
 $('garage-person-close').onclick=()=>$('garage-person-dialog').close();
 $('garage-person-dialog').addEventListener('close',()=>{for(const b of $('garage-people').querySelectorAll('button')){b.setAttribute('aria-expanded','false');if(b.dataset.personId===selected)b.focus({preventScroll:true});}});
 $('garage-car-dialog').addEventListener('close',()=>{const b=[...$('garage-cars').querySelectorAll('button')].find(b=>b.dataset.carId===selectedCar);if(b)b.focus({preventScroll:true});});
 $('garage-car-close').onclick=()=>$('garage-car-dialog').close();
 $('garage-car-edit').onclick=()=>{const car=current()?.cars.find(c=>c.id===selectedCar);if(car)edit('car',car);};
 $('garage-car-delete').onclick=()=>{const car=current()?.cars.find(c=>c.id===selectedCar);if(car)confirmDelete('car',car);};
 $('garage-car-search').oninput=()=>{carPage=0;renderCars();};
 $('garage-car-prev').onclick=()=>{carPage=Math.max(0,carPage-1);renderCars();};$('garage-car-next').onclick=()=>{carPage++;renderCars();};
 function edit(kind,car){
  if(busy||!loaded||!connected)return;const person=current();$('garage-edit-fields').replaceChildren();$('garage-edit-error').textContent='';
  $('garage-edit-heading').textContent=kind==='new'?'Új név':kind==='name'?'Név módosítása':car?'Autó módosítása':'Autó hozzáadása';
  const fields=kind==='car'?[['vehicle','Autó · márka és típus',car?.vehicle||'','Pl. Volkswagen Golf'],['vin','Alvázszám',car?.vin||'','Pl. WVW…'],['plate','Rendszám',car?.plate||'','Pl. ABC-123']]:[['name','Név',kind==='name'?person.name:'','Pl. Kovács Péter']];
  for(const [key,label,value,placeholder]of fields){const l=node('label',label);const input=node('input');input.id='garage-field-'+key;input.value=value;input.placeholder=placeholder;input.maxLength=key==='name'?200:300;input.required=key==='name';input.spellcheck=false;l.append(input);$('garage-edit-fields').append(l);}
  editAction=async()=>{
   const next=JSON.parse(JSON.stringify(people));
   if(kind==='new'){const name=$('garage-field-name').value.trim();if(next.some(p=>Model.key(p.name)===Model.key(name)))throw Error('Ez a név már létezik. Nyisd meg a buborékját, és adj hozzá autót.');const p={id:uid(),name,cars:[]};next.push(p);await commit(next);selected=p.id;render();}
   else{const p=next.find(p=>p.id===person.id);
    if(kind==='name'){const name=$('garage-field-name').value.trim();if(next.some(other=>other.id!==p.id&&Model.key(other.name)===Model.key(name)))throw Error('Ez a név már létezik. Válassz megkülönböztető nevet.');p.name=name;}
    else{const value={id:car?.id||uid(),vehicle:$('garage-field-vehicle').value.trim(),vin:$('garage-field-vin').value.trim(),plate:$('garage-field-plate').value.trim()};if(car)p.cars[p.cars.findIndex(c=>c.id===car.id)]=value;else p.cars.push(value);}
    await commit(next);
   }
  };
  dirty=false;$('garage-edit-dialog').showModal();$('garage-edit-fields').querySelector('input').focus();
 }
 $('garage-edit-form').oninput=()=>{dirty=true;};
 $('garage-edit-form').onsubmit=async e=>{e.preventDefault();if(busy)return;try{await editAction();$('garage-edit-dialog').close();if(current()&&!$('garage-person-dialog').open)openPerson(selected);}catch(error){$('garage-edit-error').textContent=error.message;}};
 $('garage-edit-cancel').onclick=()=>{dirty=false;conflict=false;$('garage-edit-dialog').close();void refresh();};
 function confirmDelete(kind,car){
  if(busy||!connected)return;const person=current();$('garage-delete-error').textContent='';$('garage-delete-heading').textContent=kind==='car'?'Törlöd ezt az autót?':`Törlöd ezt a nevet: ${person.name}?`;
  $('garage-delete-text').textContent=kind==='car'?`${car.vehicle||'Jármű'} · ${car.vin||car.plate}. A többi autó megmarad.`:`A név és a hozzá tartozó ${person.cars.length} autó is törlődik. Ez nem vonható vissza.`;
  deleteAction=()=>kind==='car'?people.map(p=>p.id===person.id?{...p,cars:p.cars.filter(c=>c.id!==car.id)}:p):people.filter(p=>p.id!==person.id);$('garage-delete-dialog').showModal();
 }
 $('garage-delete-cancel').onclick=()=>{conflict=false;$('garage-delete-dialog').close();void refresh();};
 $('garage-delete-confirm').onclick=async()=>{if(busy)return;try{await commit(deleteAction());$('garage-delete-dialog').close();}catch(e){$('garage-delete-error').textContent=e.message;}};
 $('garage-new').onclick=()=>edit('new');$('garage-rename').onclick=()=>edit('name');$('garage-add-car').onclick=()=>edit('car');$('garage-delete-person').onclick=()=>confirmDelete('person');$('garage-search').oninput=render;
 const mapping=()=>Object.fromEntries(['name','vehicle','vin','plate'].map(f=>[f,Number($('garage-map-'+f).value)]));
 function previewImport(){
  preview=null;$('garage-preview').replaceChildren();$('garage-import-error').textContent='';$('garage-import-summary').textContent='';$('garage-import-save').disabled=true;
  if(!rows.length)return;
  try{
   const map=mapping();preview=Model.importRows(people,rows,map,$('garage-header').checked,$('garage-fill').checked,uid);
   $('garage-import-summary').textContent=`${preview.added} új autó · ${preview.skipped} teljesen azonos sor kihagyva. Előnézet: legfeljebb 20 sor.`;
   for(const r of rows.slice($('garage-header').checked?1:0).slice(0,20)){const tr=node('tr');for(const f of ['name','vehicle','vin','plate'])tr.append(node('td',map[f]>=0?r[map[f]]||'—':'—'));$('garage-preview').append(tr);}
   $('garage-import-save').disabled=!preview.added||busy;
  }catch(e){$('garage-import-error').textContent=e.message;}
 }
 function parsePaste(){
  rows=[];$('garage-mapping').replaceChildren();$('garage-import-error').textContent='';
  try{rows=Model.table($('garage-paste').value);const width=Math.max(0,...rows.map(r=>r.length));if(width>100)throw Error('Legfeljebb 100 oszlop másolható be.');
   const aliases={name:['nev','ugyfel','ugyfel neve','tulajdonos'],vehicle:['auto','jarmu','marka','tipus','marka es tipus'],vin:['alvazszam','vin'],plate:['rendszam','rendszamtabla']};
   for(const [index,[f,label]]of [['name','Név'],['vehicle','Autó'],['vin','Alvázszám'],['plate','Rendszám']].entries()){
    const l=node('label',label),select=node('select');select.id='garage-map-'+f;select.append(new Option('Nem használom','-1'));
    for(let i=0;i<width;i++)select.append(new Option(`${i+1}. oszlop${$('garage-header').checked?' · '+(rows[0]?.[i]||'üres'):''}`,String(i)));
    const found=$('garage-header').checked?rows[0]?.findIndex(v=>aliases[f].includes(fold(v).trim())):-1;select.value=String(found>=0?found:index<width?index:-1);select.onchange=()=>{dirty=true;previewImport();};l.append(select);$('garage-mapping').append(l);
   }
   previewImport();
  }catch(e){rows=[];preview=null;$('garage-import-error').textContent=e.message;$('garage-import-save').disabled=true;$('garage-preview').replaceChildren();$('garage-import-summary').textContent='';}
 }
 $('garage-import').onclick=()=>{if(busy||!loaded||!connected)return;dirty=false;$('garage-paste').value='';rows=[];preview=null;$('garage-mapping').replaceChildren();$('garage-preview').replaceChildren();$('garage-import-summary').textContent='';$('garage-import-error').textContent='';$('garage-import-save').disabled=true;$('garage-import-dialog').showModal();$('garage-paste').focus();};
 $('garage-paste').oninput=()=>{dirty=true;parsePaste();};$('garage-header').onchange=parsePaste;$('garage-fill').onchange=previewImport;
 $('garage-import-cancel').onclick=()=>{dirty=false;conflict=false;$('garage-import-dialog').close();void refresh();};
 $('garage-import-save').onclick=async()=>{if(busy||!preview)return;const result=preview;try{await commit(result.people);$('garage-import-dialog').close();$('garage-status').textContent=`✓ ${result.added} autó elmentve · ${result.skipped} ismétlődés kihagyva`;}catch(e){$('garage-import-error').textContent=e.message;$('garage-import-save').disabled=false;}};
 for(const id of ['garage-edit-dialog','garage-delete-dialog','garage-import-dialog'])$(id).addEventListener('cancel',e=>{if(busy)e.preventDefault();else{dirty=false;conflict=false;setTimeout(()=>void refresh(),0);}});
 $('garage-backup').onclick=async()=>{if(busy||!loaded)return;try{const result=await window.notesAPI.backupGarage();if(result.canceled)return;$('garage-status').textContent=result.ok?'✓ Autólista biztonsági mentése elkészült':result.message;}catch{$('garage-status').textContent='Az autólista mentése nem sikerült.';}};
 function dialogOpen(){return ['garage-edit-dialog','garage-delete-dialog','garage-import-dialog','garage-network-dialog'].some(id=>$(id)?.open);}
 function networkSummary(){
  $('garage-network-summary').textContent=networkInfo.mode==='host'?'Központi gép · közös autónyilvántartó':networkInfo.mode==='client'?`Közös autónyilvántartó · ${networkInfo.host}`:'Helyi autónyilvántartó · még nincs megosztva';
 }
 async function refresh(force=false){
  if(polling||busy||(!force&&dialogOpen()))return;polling=true;
  try{
   const snapshot=await window.notesAPI.loadGarage();const data=Array.isArray(snapshot)?snapshot:snapshot.people;Model.validate(data);
   if(!force&&(busy||dialogOpen()))return;
   const changed=!loaded||revision!==snapshot.revision||!connected;
   people=data;revision=snapshot.revision||null;loaded=true;connected=true;conflict=false;setBusy(false);
   $('garage-error').textContent='';if(changed){render();$('garage-status').textContent=networkInfo.mode==='local'?'✓ Adatok betöltve':'✓ Közös lista naprakész';}
  }catch(e){connected=false;setBusy(false);$('garage-status').textContent='Az autónyilvántartó nem elérhető';$('garage-error').textContent='Nem sikerült frissíteni az autólistát. A közös adatok nem lesznek helyi adatokkal felülírva. A jegyzetek és munkalapok továbbra is külön használhatók. '+e.message;}
  finally{polling=false;}
 }
 const ready=(async()=>{if(window.notesAPI.garageNetworkStatus){try{networkInfo=await window.notesAPI.garageNetworkStatus();}catch{}}networkSummary();await refresh(true);})();
 const timer=setInterval(()=>{if(!document.hidden)void refresh();},3000);
 window.addEventListener('beforeunload',()=>clearInterval(timer));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
 window.GarageUI={ready,refresh,flush:async()=>{await queue;},canClose:()=>{if(dirty){window.NoteReviewUI.showError('Az autónyilvántartóban még nem mentett adatok vannak. Mentsd el őket, vagy válaszd a Mégse gombot.');return false;}return true;}};
 function showNetworkFields(){
  const mode=$('garage-network-mode').value;
  $('garage-network-client').hidden=mode!=='client';$('garage-network-port-label').hidden=mode==='local';
  $('garage-network-host').required=mode==='client';$('garage-network-token').required=mode==='client';
  $('garage-network-host-info').hidden=mode!=='host'||networkInfo.mode!=='host'||!networkInfo.pairingCode;
  $('garage-network-addresses').textContent=networkInfo.addresses?.join(' vagy ')||'Nem található helyi IPv4-cím. Ellenőrizd a hálózati kábelt.';
  $('garage-network-code').value=networkInfo.pairingCode||'';
  $('garage-network-help').textContent=mode==='host'?'Ezen a gépen futjon a program használat közben. A Windows tűzfalán a magánhálózati hozzáférést engedélyezni kell. Az első bekapcsolás a meglévő helyi autólistát másolja át; a jegyzetekhez nem nyúl. A port módosítását a másik három gépen is át kell állítani.':mode==='client'?'A központi gépnek bekapcsolva kell lennie, és futnia kell rajta ennek a programnak. Sikertelen kapcsolódáskor a jelenlegi beállítás megmarad.':'Az autólista csak ezen a gépen látható. A korábbi közös lista megmarad a központi gépen; nem másoljuk automatikusan a helyi lista helyére.';
 }
 $('garage-network-open').onclick=async()=>{
  if(busy||dialogOpen())return;await ready;
  try{if(window.notesAPI.garageNetworkStatus)networkInfo=await window.notesAPI.garageNetworkStatus();}catch{}
  $('garage-network-mode').value=networkInfo.mode;$('garage-network-host').value=networkInfo.host||'';$('garage-network-port').value=networkInfo.port||47831;$('garage-network-token').value='';$('garage-network-error').textContent=networkInfo.error||'';$('garage-network-result').textContent='';dirty=false;showNetworkFields();$('garage-network-dialog').showModal();
 };
 $('garage-network-form').oninput=()=>{dirty=true;};$('garage-network-mode').onchange=showNetworkFields;
 $('garage-network-cancel').onclick=()=>{if(busy)return;dirty=false;$('garage-network-dialog').close();void refresh();};
 $('garage-network-dialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();else dirty=false;});
 $('garage-network-form').onsubmit=async e=>{
  e.preventDefault();if(busy)return;$('garage-network-error').textContent='';$('garage-network-result').textContent='Kapcsolat ellenőrzése…';setBusy(true);
  for(const control of $('garage-network-form').querySelectorAll('input,select,button'))control.disabled=true;
  try{
   const result=await window.notesAPI.configureGarageNetwork({mode:$('garage-network-mode').value,host:$('garage-network-host').value.trim(),port:Number($('garage-network-port').value),token:$('garage-network-token').value});
   if(!result.ok)throw Error(result.message);networkInfo=result;dirty=false;loaded=false;connected=false;revision=null;selected=null;people=[];render();networkSummary();showNetworkFields();$('garage-network-result').textContent='✓ Kapcsolat elmentve. A jegyzetek és munkalapok változatlanul külön maradtak.';
  }catch(error){$('garage-network-error').textContent=error.message;$('garage-network-result').textContent='';}
  finally{for(const control of $('garage-network-form').querySelectorAll('input,select,button'))control.disabled=false;setBusy(false);await refresh(true);}
 };
})();
