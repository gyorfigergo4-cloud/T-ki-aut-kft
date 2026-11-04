(function () {
 const $ = id => document.getElementById(id);
 let session = null, busy = false;
 const inputs = () => [...$('folder-date-fields').querySelectorAll('input')];
 function setBusy(value) {
  busy = value; $('folder-dialog').setAttribute('aria-busy', String(value));
  for (const id of ['folder-close', 'folder-choose', 'folder-commit', 'import-folder']) $(id).disabled = value;
  for (const input of inputs()) input.disabled = value;
 }
 function showError(message) { $('folder-error').textContent = message; $('folder-error').hidden = false; $('status').textContent = message; }
 function release() { if (session) window.notesAPI.closeFolderImport(session.token); session = null; }
 async function flush() {
  await window.NotesFlush();
  if (window.WorkOrdersUI) await window.WorkOrdersUI.flush();
 }
 async function commit() {
  if (!session || busy) return;
  for (const input of inputs()) if (!input.reportValidity()) return;
  setBusy(true); $('folder-error').hidden = true; $('folder-message').textContent = 'A jegyzetek feldolgozása és mentése…';
  try {
   await flush();
   const dates = Object.fromEntries(inputs().map(input => [input.dataset.path, input.value]));
   const result = await window.notesAPI.commitFolderImport({ token: session.token, dates });
   if (!result.ok) throw new Error(result.error || 'A jegyzetek betöltése nem sikerült.');
   const reloaded = await window.NotesRefresh(result.noteId);
   if (reloaded === false) throw new Error('A jegyzetek mentve vannak, de az újratöltés nem sikerült. Zárd be és indítsd újra az appot.');
   session = null; $('folder-title').textContent = 'A jegyzetek betöltve'; $('folder-dates').hidden = true; $('folder-commit').hidden = true;
   $('folder-message').textContent = result.alreadyImported ? 'Ez a jegyzetmappa már be van töltve. Nem készült új másolat.' : result.files + ' fájl feldolgozva · ' + result.imported + ' új bejegyzés · ' + result.days + ' nap.';
   $('status').textContent = $('folder-message').textContent; $('folder-view').hidden = false; $('folder-choose').hidden = true;
  } catch (error) { showError(error.message || 'A jegyzetmappa betöltése nem sikerült.'); $('folder-message').textContent = 'A betöltés nem fejeződött be. Ellenőrizd az alábbi üzenetet.'; }
  finally { setBusy(false); }
 }
 async function choose() {
  if (busy) return; release(); $('folder-title').textContent = 'Jegyzetmappa betöltése'; $('folder-error').hidden = true; $('folder-dates').hidden = true; $('folder-date-fields').replaceChildren(); $('folder-commit').hidden = true; $('folder-view').hidden = true; $('folder-choose').hidden = false;
  setBusy(true); $('folder-message').textContent = 'Mappa kiválasztása és a TXT-fájlok ellenőrzése…';
  let autoCommit = false;
  try {
   await flush();
   const result = await window.notesAPI.importFolder();
   if (result.canceled) { $('folder-message').textContent = 'Nem választottál mappát. A Mappa kiválasztása gombbal újra megnyithatod.'; return; }
   if (!result.ok) throw new Error(result.error || 'A jegyzetmappa nem olvasható.');
   session = result;
   if (!result.issues.length) { autoCommit = true; return; }
   $('folder-message').textContent = result.files + ' TXT-fájl található. ' + result.issues.length + ' fájlnál ki kell választani a napot.';
   for (const issue of result.issues) {
    const label = document.createElement('label'), name = document.createElement('span'), hint = document.createElement('small'), input = document.createElement('input');
    name.textContent = issue.path; hint.textContent = 'Választható hónap: ' + issue.month; input.type = 'date'; input.required = true; input.min = issue.min; input.max = issue.max; input.dataset.path = issue.path; input.setAttribute('aria-label', 'Jegyzet napja: ' + issue.path);
    label.append(name, hint, input); $('folder-date-fields').append(label);
   }
   $('folder-dates').hidden = false; $('folder-commit').hidden = false;
  } catch (error) { showError(error.message || 'A jegyzetmappa betöltése nem sikerült.'); $('folder-message').textContent = 'A mappát nem sikerült előkészíteni.'; }
  finally { setBusy(false); if (autoCommit) await commit(); }
 }
 $('import-folder').onclick = () => {
  if (!window.NotesImportContext().canLeave()) return;
  if (window.WorkOrdersUI && !window.WorkOrdersUI.canLeave()) return;
  $('folder-dialog').showModal(); choose();
 };
 $('folder-choose').onclick = choose; $('folder-commit').onclick = commit;
 $('folder-close').onclick = () => $('folder-dialog').close();
 $('folder-view').onclick = () => { window.WorkOrdersUI?.showNotes(); $('folder-dialog').close(); };
 $('folder-dialog').addEventListener('cancel', event => { if (busy) event.preventDefault(); });
 $('folder-dialog').addEventListener('close', release);
})();
