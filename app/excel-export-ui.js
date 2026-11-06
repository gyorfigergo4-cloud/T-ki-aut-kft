(function(){
 const $=id=>document.getElementById(id);let busy=false;
 function scope(){const garage=$('excel-export-kind').value==='garage';$('excel-export-scope').disabled=garage;if(garage)$('excel-export-scope').value='all';}
 $('export-excel').onclick=()=>{const tab=window.WorkOrdersUI?.getContext().tab||'notes';$('excel-export-kind').value=tab==='garage'?'garage':tab==='workorders'?'workorders':'notes';$('excel-export-scope').value='all';scope();$('excel-export-status').textContent='';$('excel-export-dialog').showModal();};
 $('excel-export-kind').onchange=scope;
 $('excel-export-cancel').onclick=()=>{if(!busy)$('excel-export-dialog').close();};
 $('excel-export-dialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 $('excel-export-form').onsubmit=async e=>{
  e.preventDefault();if(busy)return;
  const kind=$('excel-export-kind').value;let id=null;
  if($('excel-export-scope').value==='selected'&&kind!=='garage'){id=kind==='notes'?window.NotesExportSelection():window.WorkOrdersUI?.getContext().doc?.id;if(!id){$('excel-export-status').textContent='Előbb válassz ki egy bejegyzést.';return;}}
  busy=true;for(const c of $('excel-export-form').querySelectorAll('button,select'))c.disabled=true;$('excel-export-status').textContent='Excel-mentés…';
  try{
   if(kind!=='garage'&&!await window.SaveLocalWork())throw Error('A helyi módosítások nem menthetők. Javítsd a megjelölt mezőket, majd próbáld újra.');
   const result=await window.notesAPI.exportExcel({kind,id});
   if(result.canceled)$('excel-export-status').textContent='A mentés megszakítva.';
   else if(!result.ok)throw Error(result.error||'Nem sikerült az Excel-mentés.');
   else $('excel-export-status').textContent='✓ Az Excel-fájl elmentve.';
  }catch(error){$('excel-export-status').textContent=error.message;}
  finally{busy=false;for(const c of $('excel-export-form').querySelectorAll('button,select'))c.disabled=false;scope();}
 };
})();
