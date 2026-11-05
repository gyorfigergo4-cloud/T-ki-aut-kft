(function(){
 const $=id=>document.getElementById(id),Model=window.WorkOrderModel,Items=window.LineItems;
 let docs=[],selected=null,loaded=false,tab='notes',queue=Promise.resolve(),pending=0,revision=0,saveError=false;
 const invalid=new Set();const current=()=>docs.find(d=>d.id===selected);
 const fold=s=>s.toLocaleLowerCase('hu').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const day=()=>window.NotesArchive.localDay(new Date());
 function canLeave(){for(const el of invalid)if(!el.isConnected)invalid.delete(el);const el=invalid.values().next().value;if(el){el.focus();el.reportValidity();return false;}return true;}
 function persist(){const doc=current();if(doc)doc.paid=Items.paymentState(doc.items,doc.paid).paid;Model.validate(docs);const snapshot=JSON.parse(JSON.stringify(docs)),version=++revision;pending++;$('wo-status').textContent='Mentés…';queue=queue.catch(()=>{}).then(()=>window.notesAPI.saveWorkorders(snapshot)).then(()=>{saveError=false;if(version===revision)$('wo-status').textContent='✓ Munkalap mentve';}).catch(()=>{saveError=true;$('wo-status').textContent='A munkalap mentése nem sikerült. Ellenőrizd a lemez szabad helyét.';}).finally(()=>{pending--;});}
 async function flush(){await ready;await queue;if(saveError)throw new Error('A munkalap mentése nem sikerült.');}
 async function showTab(next){
  if(next===tab)return true;
  if(tab==='notes'&&window.NotesImportContext&&!await window.NotesImportContext().canLeave())return false;
  if(tab==='workorders'&&!canLeave())return false;
  tab=next;document.body.dataset.section=tab;
  for(const name of ['notes','workorders','garage']){const active=name===tab;if(!$('tab-'+name))continue;$('tab-'+name).setAttribute('aria-selected',String(active));$(name+'-view').hidden=!active;$(name+'-navigation').hidden=!active;}
  return true;
 }
 if($('tab-garage'))$('tab-garage').onclick=()=>showTab('garage');
 $('tab-notes').onclick=()=>showTab('notes');$('tab-workorders').onclick=()=>showTab('workorders');
 function list(){
  $('wo-list').replaceChildren();const query=fold($('wo-search').value.trim());
  const visible=docs.filter(d=>fold([d.number,d.customer,d.vin,d.plate,d.vehicle,...d.items.map(i=>[i.partNumber,i.description||'',Items.order(i).ordered?'megrendelve rendelve':'',Items.order(i).orderedAt].join(' '))].join(' ')).includes(query)).sort((a,b)=>b.updated.localeCompare(a.updated));
  for(const doc of visible){const button=document.createElement('button');button.className='wo-card'+(doc.id===selected?' active':'');button.dataset.docId=doc.id;const name=document.createElement('strong');name.textContent=doc.customer||'Új ügyfél';const number=document.createElement('small');number.textContent=doc.number+' · '+doc.day;button.append(name,number);button.onclick=()=>{if(!canLeave())return;selected=doc.id;render();};$('wo-list').append(button);}
  if(!visible.length){const text=document.createElement('p');text.className='sidebar-empty';text.textContent=docs.length?'Nincs találat.':'Még nincs munkalap.';$('wo-list').append(text);}
 }
 function totals(){
  const doc=current();if(!doc)return;const value=Items.totals(doc.items);
  $('wo-total-full').previousElementSibling.textContent=value.missingFull?'Teli részösszeg':'Teli összesen';
  $('wo-total-savings').previousElementSibling.textContent=value.missing&&value.priced?'Kedvezmény részösszeg':'Kedvezmény összesen';
  $('wo-total').previousElementSibling.textContent=value.missingDiscounted?'Kedvezményes részösszeg':'Összesen';
  for(const [id,key,count]of [['wo-total-full','fullPrice',value.fullPriced],['wo-total-savings','savings',value.priced],['wo-total','discountedPrice',value.discountedPriced]])$(id).textContent=count?Items.formatMoney(value[key]):'—';
  $('wo-price-summary').textContent=Items.totalsHint(value)+(value.missing?' Nyomtatás előtt töltsd ki a hiányzó árakat.':'');
  const payment=Items.paymentState(doc.items,doc.paid);$('wo-paid').checked=payment.paid;$('wo-paid').indeterminate=payment.partial;
  const orders=Items.orderCounts(doc.items);$('wo-order-summary').textContent='Megrendelve: '+orders.ordered+' / '+orders.total+' tétel';
 }

 function heading(){const doc=current();if(doc)$('wo-title').textContent=(doc.kind==='quote'?'Árajánlat':'Munkalap')+' · '+doc.number;}
 function renderItems(){
  const doc=current();$('wo-items').replaceChildren();
  const sources=doc.items.filter(i=>i.excelSource?.originalText).map(i=>i.excelSource.path+' · '+i.excelSource.row+'. sor\n'+i.excelSource.originalText);
  $('wo-excel-sources').hidden=!sources.length;$('wo-excel-sources').open=false;$('wo-excel-text').textContent=sources.join('\n\n');
  doc.items.forEach((item,index)=>{
   const row=document.createElement('tr');row.dataset.itemId=item.id;
   const priceInputs={};let priceDriver=item.priceMode==='manual'||(item.priceMode==='legacy'&&item.discountedPrice!=='')?'manual':'auto';
   const orderControl=window.ItemOrderUI.create(item,(index+1)+'. munkalapsor',checked=>{try{Object.assign(item,Items.withOrder(item,checked));doc.updated=new Date().toISOString();persist();totals();list();}catch(error){$('wo-error').textContent=error.message;}},checked=>{try{Object.assign(item,Items.withPaid(item,checked));doc.updated=new Date().toISOString();persist();totals();}catch(error){$('wo-error').textContent=error.message;}});
   for(const [field,label,type]of [['partNumber','Cikkszám','text'],['description','Megnevezés','text'],['fullPrice','Teli ár','number'],['discountPercent','Kedvezmény %','number'],['discountedPrice','Kedvezményes ár','number'],['quantity','Db','number']]){
    const cell=document.createElement('td');
    const input=document.createElement('input');input.type=type;input.value=item[field]||'';input.dataset.field=field;input.setAttribute('aria-label',label+' – '+(index+1)+'. munkalapsor');
    if(field==='fullPrice'||field==='discountedPrice'){input.min='0';input.max='999999999999.99';input.step='0.01';}
    if(field==='discountPercent'){input.min='0';input.max='100';input.step='any';input.placeholder='—';}
    if(field==='quantity'){input.min='1';input.max='999999';input.step='1';input.required=true;}
    if(field==='partNumber'){input.placeholder='Belső cikkszám';input.spellcheck=false;input.maxLength=1000;}
    if(field==='description'){input.placeholder='Pl. olajszűrő';input.maxLength=1000;}
    if(['fullPrice','discountPercent','discountedPrice'].includes(field))priceInputs[field]=input;
    if(field==='discountedPrice'){cell.className='calculated-price';input.className='discounted-price-input';}
    input.oninput=()=>{
     input.setCustomValidity('');
     try{if(!input.validity.valid)throw new Error('Ellenőrizd a mezőt: az ár nem negatív, a kedvezmény 0–100%, a darabszám pozitív egész legyen.');let patch={[field]:input.value};if(['fullPrice','discountPercent','discountedPrice'].includes(field)){if(field==='discountedPrice')priceDriver='manual';else if(field==='discountPercent')priceDriver='auto';for(const control of Object.values(priceInputs)){control.setCustomValidity('');control.removeAttribute('aria-invalid');invalid.delete(control);}const source=priceDriver==='manual'?'discountedPrice':'discountPercent';for(const control of [priceInputs.fullPrice,priceInputs[source]])if(!control.validity.valid)throw new Error('Ellenőrizd az árakat és a kedvezményt.');patch={fullPrice:priceInputs.fullPrice.value,[source]:priceInputs[source].value};}const next=Items.edit(item,patch);Items.validate([next]);Object.assign(item,next);doc.updated=new Date().toISOString();invalid.delete(input);input.removeAttribute('aria-invalid');const derived=['fullPrice','discountPercent','discountedPrice'].includes(field)?(item.priceMode==='auto'?'discountedPrice':'discountPercent'):null;if(derived){const control=priceInputs[derived];control.value=item[derived];control.setCustomValidity('');control.removeAttribute('aria-invalid');invalid.delete(control);}$('wo-error').textContent=invalid.size?'Javítsd a megjelölt mezőt.':'';orderControl.refresh();persist();totals();list();}
     catch(error){input.setCustomValidity(error.message);input.setAttribute('aria-invalid','true');invalid.add(input);$('wo-error').textContent=error.message;}
    };
    cell.append(input);row.append(cell);
   }
   row.append(orderControl.cell);const cell=document.createElement('td'),remove=document.createElement('button');remove.type='button';remove.className='remove-item';remove.textContent='×';remove.setAttribute('aria-label',(index+1)+'. munkalapsor törlése');remove.onclick=()=>{for(const input of row.querySelectorAll('input'))invalid.delete(input);if(!canLeave())return;doc.items=doc.items.filter(i=>i.id!==item.id);doc.updated=new Date().toISOString();persist();renderItems();totals();};cell.append(remove);row.append(cell);$('wo-items').append(row);
  });
 }
 const fields=['kind','number','day','customer','phone','vin','vehicle','plate','validUntil','publicNote','internalNote'];
 function render(){
  list();const doc=current();$('wo-editor').hidden=!doc;$('wo-empty').hidden=!!doc;
  if(!doc)return;invalid.clear();$('wo-error').textContent='';
  for(const field of fields){const input=$('wo-'+field);input.value=doc[field];input.setCustomValidity('');input.removeAttribute('aria-invalid');}heading();renderItems();totals();
 }
 for(const field of fields){const input=$('wo-'+field);input.addEventListener(field==='kind'?'change':'input',()=>{
  const doc=current();if(!doc)return;input.setCustomValidity('');
  try{
   if(!input.validity.valid)throw new Error('Ellenőrizd a munkalap mezőjét.');const next={...doc,[field]:input.value};Model.validate(docs.map(d=>d.id===doc.id?next:d));Object.assign(doc,next);doc.updated=new Date().toISOString();invalid.delete(input);input.removeAttribute('aria-invalid');$('wo-error').textContent=invalid.size?'Javítsd a megjelölt mezőt.':'';persist();heading();list();
  }catch(error){input.setCustomValidity(error.message);input.setAttribute('aria-invalid','true');invalid.add(input);$('wo-error').textContent=error.message;}
 });}
 async function create(note){
  if(!loaded||!canLeave())return;
  const doc=Model.blank(crypto.randomUUID(),day(),docs,crypto.randomUUID());
  if(note){doc.customer=note.title;doc.phone=note.phone||'';Object.assign(doc,window.NoteVehicles.quoteInfo(note));doc.items=note.items.map(i=>({...i,description:i.description||''}));doc.internalNote=note.body;doc.sourceNoteId=note.id;doc.paid=Items.paymentState(doc.items,note.paid).paid;}
  try{Model.validate([...docs,doc]);}catch(error){$('status').textContent=error.message;$('wo-status').textContent=error.message;return;}
  if(!await showTab('workorders'))return;
  docs.push(doc);selected=doc.id;persist();render();$('wo-customer').focus();
 }
 $('wo-new').onclick=()=>create();
 $('note-to-wo').onclick=async()=>{const note=await window.NoteForWorkOrder?.();if(note)await create(note);};
 $('wo-add-item').onclick=()=>{const doc=current();if(!doc||!canLeave())return;doc.items.push({...Items.blank(crypto.randomUUID()),description:''});doc.updated=new Date().toISOString();persist();renderItems();totals();$('wo-items').lastElementChild.querySelector('input').focus();};
 $('wo-paid').onchange=()=>{const doc=current();if(!doc||!canLeave()){totals();return;}doc.items=Items.setAllPaid(doc.items,$('wo-paid').checked);doc.paid=$('wo-paid').checked;doc.updated=new Date().toISOString();persist();renderItems();totals();};
 $('wo-search').oninput=list;
 $('wo-delete').onclick=()=>$('wo-confirm').showModal();$('wo-cancel-delete').onclick=()=>$('wo-confirm').close();
 $('wo-confirm-delete').onclick=()=>{invalid.clear();docs=docs.filter(d=>d.id!==selected);selected=docs[0]?.id||null;persist();$('wo-confirm').close();render();};
 async function output(action){
  const doc=current();if(!doc||!canLeave())return;
  try{Model.printable(doc);}catch(error){$('wo-error').textContent=error.message;return;}
  for(const id of ['wo-preview','wo-print','wo-pdf'])$(id).disabled=true;
  try{await flush();const result=await window.notesAPI.workorderOutput({action,doc});if(!result.canceled)$('wo-error').textContent=result.ok?'':result.error||'A nyomtatás nem sikerült.';if(result.ok&&action==='pdf')$('wo-status').textContent='✓ PDF elmentve';}
  catch{$('wo-error').textContent='A dokumentum készítése nem sikerült.';}
  finally{for(const id of ['wo-preview','wo-print','wo-pdf'])$(id).disabled=false;}
 }
 $('wo-preview').onclick=()=>output('preview');$('wo-print').onclick=()=>output('print');$('wo-pdf').onclick=()=>output('pdf');
 window.notesAPI.onPrintRequested?.(()=>{if(tab==='workorders')output('print');else $('status').textContent='Nyomtatni a Munkalapok fülről tudsz.';});
 async function reload(id){const data=await window.notesAPI.loadWorkorders();Model.validate(data);docs=data;selected=docs.find(d=>d.id===id)?.id||docs[0]?.id||null;render();}
 const ready=(async()=>{try{const data=window.notesAPI.loadWorkorders?await window.notesAPI.loadWorkorders():[];Model.validate(data);docs=data;loaded=true;selected=docs[0]?.id||null;$('wo-status').textContent='✓ Munkalapok betöltve';render();}catch{$('wo-status').textContent='A mentett munkalapok nem olvashatók. Az eredeti fájl megmaradt.';$('wo-new').disabled=true;}})();
 window.WorkOrdersUI={ready,flush,canLeave,getContext:()=>({tab,doc:current()?JSON.parse(JSON.stringify(current())):null}),showGarage:()=>showTab('garage'),showNotes:()=>showTab('notes'),showWorkorders:()=>showTab('workorders')};
 window.addEventListener('excel-imported',async event=>{if(event.detail.target==='workorder'){try{await reload(event.detail.workorderId);await showTab('workorders');$('wo-status').textContent=event.detail.message;}catch{$('wo-error').textContent='A munkalap újratöltése nem sikerült.';}}});
 window.addEventListener('beforeunload',event=>{if(invalid.size||pending||saveError){event.preventDefault();event.returnValue='';}});
})();
