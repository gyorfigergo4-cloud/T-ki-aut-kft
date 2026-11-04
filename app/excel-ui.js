(function(){
 const $=id=>document.getElementById(id);
 const labels={day:'Dátum',name:'Név / ügyfél',vin:'Alvázszám',partNumber:'Cikkszám',description:'Megnevezés',fullPrice:'Teli ár',discountPercent:'Kedvezmény %',discountedPrice:'Kedvezményes ár (ha van)',quantity:'Db',supplier:'Beszállító',oil:'Olaj',body:'Megjegyzés'};
 let session=null,view=null,sequence=0,previewOkay=false;
 function config(){const mapping={};for(const key of Object.keys(labels))mapping[key]=Number($('excel-map-'+key).value);return {sheet:$('excel-sheet').value,headerRow:Number($('excel-header').value),mapping,fallbackDay:$('excel-day').value,fallbackName:$('excel-name').value,fillDown:$('excel-fill').checked};}
 function messages(id,values){$(id).replaceChildren();for(const value of values){const p=document.createElement('p');p.textContent=value;$(id).append(p);}}
 async function preview(){
  if(!session||!view)return;const turn=++sequence;previewOkay=false;$('excel-commit').disabled=true;$('excel-summary').textContent='Előnézet készítése…';
  try{
   const result=await window.notesAPI.previewExcel({token:session.token,config:config()});if(turn!==sequence||!session)return;
   if(!result.ok){messages('excel-errors',[result.error]);$('excel-summary').textContent='Ellenőrizd az oszlopokat.';return;}
   messages('excel-errors',result.errors);messages('excel-warnings',result.warnings);
   $('excel-summary').textContent=result.rows+' tétel · '+result.notes+' név / bejegyzés · '+result.days+' nap';$('excel-preview').replaceChildren();
   for(const row of result.sample){const tr=document.createElement('tr');for(const value of [row.name+' · '+row.day,row.partNumber,row.description,row.fullPrice,row.discountPercent,row.discountedPrice,row.quantity,row.supplier]){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('excel-preview').append(tr);}
   previewOkay=result.rows>0&&!result.errors.length;$('excel-commit').disabled=!previewOkay;
  }catch{if(turn===sequence){messages('excel-errors',['Nem sikerült az Excel-előnézet.']);$('excel-summary').textContent='';}}
 }
 function renderMappings(next){view=next;$('excel-mapping').replaceChildren();
  for(const [key,label]of Object.entries(labels)){const wrap=document.createElement('label');wrap.textContent=label;const select=document.createElement('select');select.id='excel-map-'+key;const empty=document.createElement('option');empty.value='0';empty.textContent='Nincs külön oszlop';select.append(empty);
   for(const col of view.columns){const option=document.createElement('option');option.value=String(col.index);option.textContent=col.index+'. '+col.label;select.append(option);}select.value=String(view.mapping[key]||0);select.onchange=preview;wrap.append(select);$('excel-mapping').append(wrap);
  }
 }
 async function describe(){if(!session)return;const turn=++sequence;$('excel-commit').disabled=true;try{const result=await window.notesAPI.describeExcel({token:session.token,sheet:$('excel-sheet').value,headerRow:Number($('excel-header').value)||undefined});if(turn!==sequence||!session)return;if(!result.ok){messages('excel-errors',[result.error]);return;}$('excel-header').value=result.headerRow;renderMappings(result);await preview();}catch{messages('excel-errors',['Nem olvasható az Excel-munkalap.']);}}
 $('import-excel').onclick=async()=>{
  if(window.NotesImportContext&&!window.NotesImportContext().canLeave())return;
  if(window.WorkOrdersUI&&!window.WorkOrdersUI.canLeave())return;
  $('import-excel').disabled=true;
  try{
   if(window.NotesFlush)await window.NotesFlush();
   if(window.WorkOrdersUI)await window.WorkOrdersUI.flush();
   const result=await window.notesAPI.openExcel();if(result.canceled)return;if(!result.ok){$('status').textContent=result.error;$('wo-status').textContent=result.error;return;}
   session=result;view=result;sequence++;$('excel-file').textContent=result.fileName;$('excel-sheet').replaceChildren();
   for(const sheet of result.sheets){const option=document.createElement('option');option.value=sheet.name;option.textContent=sheet.name+' ('+sheet.rows+' sor)';$('excel-sheet').append(option);}$('excel-sheet').value=result.sheet;$('excel-header').value=result.headerRow;
   const context=window.WorkOrdersUI?.getContext();$('excel-target').querySelector('option[value=workorder]').disabled=!context?.doc;$('excel-target').value=context?.tab==='workorders'&&context.doc?'workorder':'notes';
   $('excel-day').value=window.NotesImportContext?.().day||new Date().toISOString().slice(0,10);$('excel-name').value=context?.tab==='workorders'&&context.doc?.customer?context.doc.customer:result.fileName.replace(/\.xlsx$/i,'');$('excel-fill').checked=false;messages('excel-errors',[]);messages('excel-warnings',[]);renderMappings(result);$('excel-dialog').showModal();await preview();
  }catch(error){const message=error.message||'Az Excel-fájl megnyitása nem sikerült.';$('status').textContent=message;$('wo-status').textContent=message;}
  finally{$('import-excel').disabled=false;}
 };
 $('excel-sheet').onchange=()=>{$('excel-header').value='';describe();};$('excel-header').onchange=describe;
 for(const id of ['excel-day','excel-name','excel-fill','excel-target'])$(id).onchange=preview;
 $('excel-close').onclick=()=>$('excel-dialog').close();
 $('excel-dialog').addEventListener('close',()=>{if(session)window.notesAPI.closeExcel(session.token);session=null;view=null;sequence++;});
 $('excel-commit').onclick=async()=>{
  if(!session||!previewOkay)return;$('excel-commit').disabled=true;
  try{
   if(window.NotesFlush)await window.NotesFlush();
   if(window.WorkOrdersUI)await window.WorkOrdersUI.flush();
   const context=window.WorkOrdersUI?.getContext(),result=await window.notesAPI.commitExcel({token:session.token,config:config(),target:$('excel-target').value,workorderId:context?.doc?.id});
   if(!result.ok){messages('excel-errors',[result.error]);$('excel-commit').disabled=false;return;}
   const message=result.alreadyImported?'Ezek a tételek már be vannak olvasva.':'✓ Excelből beolvasva: '+result.rows+' tétel.';
   if(result.target==='notes')window.WorkOrdersUI?.showNotes();
   $('excel-dialog').close();window.dispatchEvent(new CustomEvent('excel-imported',{detail:{...result,message}}));
  }catch{messages('excel-errors',['A beolvasás nem sikerült. Az eredeti Excel-fájl megmaradt.']);$('excel-commit').disabled=false;}
 };
 $('excel-template').onclick=async()=>{try{const result=await window.notesAPI.excelTemplate();if(!result.canceled)messages('excel-warnings',[result.ok?'Az Excel-minta elmentve.':result.error]);}catch{messages('excel-errors',['A minta mentése nem sikerült.']);}};
})();
