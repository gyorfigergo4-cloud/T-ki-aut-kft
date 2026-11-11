const $ = id => document.getElementById(id);
const { months, localDay, validDay, normalize } = window.NotesArchive;
const fields = ['title', 'phone', 'oil', 'body'];
const Items = window.LineItems;
const NoteStatuses = window.NoteStatuses;
const Vehicles = window.NoteVehicles;
const invalidInputs = new Set();
const today = localDay(new Date());
let notes = [], years = [], days = [], loaded = false, selected = null, selectedDay = today;
let activeYear = Number(today.slice(0, 4)), selectedMonth = today.slice(0, 7);
const openedYears = new Set(), openedMonths = new Set(), saveErrors = new Set();
let queue = Promise.resolve(), revision = 0, pending = 0, appliedSearch = '', drainingSaves = false, folderSignature = null, brandOptionsDirty = true, searchPage = 0;
const dirtyNotes = new Map(), deletedNotes = new Map(); let noteChangeVersion = 0;
const stagedSaves = new Map(), searchCache = new WeakMap(), SEARCH_PAGE_SIZE = 80;
const current = () => notes.find(note => note.id === selected);
function markNoteChanged(note) { dirtyNotes.set(note.id, { note, version: ++noteChangeVersion }); deletedNotes.delete(note.id); }
function touchNote(note) { note.updated = new Date().toISOString(); searchCache.delete(note); markNoteChanged(note); }
const fold = value => value.toLocaleLowerCase('hu').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const dateLabel = day => new Date(day + 'T12:00:00').toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
const money = value => new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 2 }).format(value);
const archiveData = () => ({ years: [...years], days: [...days] });
// Keep only the newest pending snapshot per file while a save is running.
// Typing only marks data as unsaved. Disk writes require manual/hourly/close flush.
function queueSave(target, value, writer) {
  if (!stagedSaves.has(target)) pending++;
  stagedSaves.set(target, { value, writer, version: ++revision });
  $('status').textContent = 'Nem mentett módosítások · Ctrl+S';
}
function flushSaveQueue() {
  if(saveErrors.has('notes')&&!stagedSaves.has('notes'))persistNotes();
  if(saveErrors.has('archive')&&!stagedSaves.has('archive'))persistArchive();
  if(stagedSaves.size&&!drainingSaves){drainingSaves=true;$('status').textContent='Mentés…';queue=queue.catch(()=>{}).then(drainSaves);}
  return queue;
}
async function drainSaves() {
  try {
    while (stagedSaves.size) {
      const [target, job] = stagedSaves.entries().next().value; stagedSaves.delete(target);
      try {
        const snapshot = typeof structuredClone === 'function' ? structuredClone(job.value) : JSON.parse(JSON.stringify(job.value));
        await job.writer(snapshot); saveErrors.delete(target);
        if (job.version === revision) $('status').textContent = saveErrors.size ? 'A mentés nem sikerült. Készíts biztonsági mentést!' : '✓ Minden változás mentve';
      } catch(error) { saveErrors.add(target); $('status').textContent = 'A jegyzetek mentése nem sikerült: '+String(error?.message||'A mentés nem sikerült.').replace(/^Error invoking remote method '[^']+': (?:Error: )?/,''); }
      finally { pending--; }
    }
  } finally { drainingSaves = false; }
}
async function writeNoteChanges() {
  const changed = new Map(dirtyNotes), removed = new Map(deletedNotes);
  if (window.notesAPI.saveNoteChanges) {
    const upserts = notes.filter(n=>changed.has(n.id));
    const payload = { upserts, removed:[...removed.keys()] };
    const snapshot = typeof structuredClone==='function' ? structuredClone(payload) : JSON.parse(JSON.stringify(payload));
    await window.notesAPI.saveNoteChanges(snapshot);
  } else { await window.notesAPI.save(JSON.parse(JSON.stringify(notes))); }
  for(const [id,state] of changed) if(dirtyNotes.get(id)?.version===state.version) dirtyNotes.delete(id);
  for(const [id,version] of removed) if(deletedNotes.get(id)===version) deletedNotes.delete(id);
}
const persistNotes = () => queueSave('notes', null, writeNoteChanges);
const persistArchive = () => queueSave('archive', archiveData(), data => window.notesAPI.saveArchive(data));
function clearSearch() { searchPage = 0; $('search').value = ''; appliedSearch = ''; $('clear').hidden = true; }
function renderPayment(note = current()) {
  const input = $('note-paid'); input.disabled = !note;
  const state = note ? Items.paymentState(note.items, note.paid) : { paid: false, partial: false, paidCount: 0, total: 0 };
  input.checked = state.paid; input.indeterminate = state.partial;
  $('note-paid-label').textContent = note?.vehicles.length > 1 ? 'Fizetve – teljes bejegyzés' : 'Fizetve';
  $('note-paid-wrap').title = state.total ? 'Fizetve: ' + state.paidCount + ' / ' + state.total + ' tétel. A pipával a teljes bejegyzés összes tételét egyszerre jelölheted.' : 'A teljes bejegyzés fizetve jelölése.';
}
function renderWorkflowStatus() {
  const note = current();
  for (const input of $('note-status-options').querySelectorAll('input[name=note-status]')) {
    input.disabled = !note; input.checked = !!note && input.value === NoteStatuses.get(note).id;
  }
  renderPayment(note);
}
for (const status of NoteStatuses.all.filter(status => status.id !== 'written')) {
  const label = document.createElement('label'); label.className = 'note-status-option'; label.dataset.workflowStatus = status.id;
  const input = document.createElement('input'); input.type = 'radio'; input.name = 'note-status'; input.value = status.id;
  const text = document.createElement('span'); text.textContent = status.label; label.append(input, text); $('note-status-options').append(label);
  input.onchange = () => {
    const note = current();
    if (!note || !validInputs()) { renderWorkflowStatus(); return; }
    note.workflowStatus = status.id; touchNote(note); persistNotes(); renderList(); metadata();
  };
}
$('note-status-options').append($('note-paid-wrap'));
$('note-paid').onchange = () => {
  const note = current();
  if (!note || !validInputs()) { renderPayment(note); return; }
  note.items = Items.setAllPaid(note.items, $('note-paid').checked); note.paid = $('note-paid').checked;
  Items.syncLegacy(note); touchNote(note); persistNotes(); renderItems(note); metadata();
};
function renderVehicleTabs(note) {
  $('vehicle-tabs').replaceChildren();
  const choices = note.vehicles.map((vehicle, index) => ({ id: vehicle.id, text: Vehicles.label(vehicle, index) }));
  if (!note.vehicles.length || note.activeVehicleId === '' || note.items.some(item => item.vehicleId === '' && Items.isActive(item))) choices.push({ id: '', text: 'Hozzárendelés nélkül' });
  for (const choice of choices) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'vehicle-tab'; button.dataset.vehicleId = choice.id;
    button.setAttribute('role', 'tab'); button.setAttribute('aria-selected', String(note.activeVehicleId === choice.id));
    const name = document.createElement('strong'); name.textContent = choice.text;
    const count = document.createElement('small'); count.textContent = Vehicles.itemsFor(note, choice.id).filter(Items.isActive).length + ' tétel';
    button.append(name, count); button.onclick = () => selectVehicle(note, choice.id); $('vehicle-tabs').append(button);
  }
  for (const row of $('vehicles-list').children) {
    const selected = row.dataset.vehicleId === note.activeVehicleId;
    row.hidden = !selected; row.classList.toggle('is-selected', selected);
  }
  const vehicle = note.vehicles.find(row => row.id === note.activeVehicleId);
  $('oil').value = vehicle?.oil || ''; $('oil').disabled = !vehicle;
  $('vehicle-items-context').textContent = vehicle ? 'Kiválasztott autó: ' + Vehicles.label(vehicle, note.vehicles.indexOf(vehicle)) : 'Hozzárendelés nélküli tételek – a sor Autó mezőjében választhatsz alvázszámot.';
  $('note-to-wo').textContent = vehicle ? 'Munkalap – kiválasztott autó' : 'Munkalap – közös tételek';
  $('note-to-wo').title = 'Csak az itt látható tételeket és a kiválasztott autót veszi át.';
}
function selectVehicle(note, id) {
  if (!validInputs()) return false;
  window.VinHistoryUI?.close();
  if (note.activeVehicleId !== id) { note.activeVehicleId = id; markNoteChanged(note); persistNotes(); }
  renderVehicleTabs(note); renderItems(note); metadata(); return true;
}
function renderBrandOptions() {
  if (!brandOptionsDirty) return; brandOptionsDirty = false;
  const names = new Set(Vehicles.brands);
  for (const note of notes) for (const row of Vehicles.get(note)) if (row.brand.trim()) names.add(row.brand.trim());
  $('car-brands').replaceChildren();
  for (const name of [...names].sort((a, b) => a.localeCompare(b, 'hu'))) { const option = document.createElement('option'); option.value = name; $('car-brands').append(option); }
}
function renderVehicles(note) {
  window.VinHistoryUI?.close();
  renderBrandOptions(); $('vehicles-list').replaceChildren(); $('vehicles-empty').hidden = !!note.vehicles.length; $('vehicle-error').textContent = '';
  note.vehicles.forEach((vehicle, index) => {
    const row = document.createElement('div'); row.className = 'vehicle-row'; row.dataset.vehicleId = vehicle.id;
    for (const [field, title] of [['vin', 'Alvázszám'], ['brand', 'Autómárka']]) {
      const label = document.createElement('label'); label.textContent = title;
      const input = document.createElement('input'); input.type = 'text'; input.dataset.vehicleField = field; input.value = vehicle[field]; input.spellcheck = false;
      input.id = field === 'vin' ? (index ? 'vin-' + vehicle.id : 'vin') : (index ? 'brand-' + vehicle.id : 'vehicle-brand');
      input.setAttribute('aria-label', title + ' – ' + (index + 1) + '. jármű');
      if (field === 'vin') { input.maxLength = Math.max(1000, vehicle.vin.length); input.placeholder = 'Alvázszám'; }
      else { input.maxLength = 200; input.placeholder = 'Válassz vagy írj márkát…'; input.setAttribute('list', 'car-brands'); input.autocomplete = 'off'; }
      function save() {
        input.setCustomValidity('');
        try {
          if (!input.validity.valid) throw new Error('Ellenőrizd az alvázszámot vagy az autómárkát.');
          const next = note.vehicles.map(entry => entry.id === vehicle.id ? { ...entry, [field]: input.value } : entry); Vehicles.validate(next);
          note.vehicles = next; Vehicles.sync(note); touchNote(note); invalidInputs.delete(input); input.removeAttribute('aria-invalid'); $('vehicle-error').textContent = '';
          persistNotes(); renderVehicleTabs(note); renderList(); metadata();
        } catch (error) { input.setCustomValidity(error.message); input.setAttribute('aria-invalid', 'true'); invalidInputs.add(input); $('vehicle-error').textContent = error.message; }
      }
      input.onfocus = () => { if (note.activeVehicleId !== vehicle.id) selectVehicle(note, vehicle.id); };
      input.oninput = save;
      if (field === 'brand') input.onchange = () => { brandOptionsDirty = true; input.value = Vehicles.normalizeBrand(input.value); save(); renderBrandOptions(); };
      label.append(input); row.append(label);
      if (field === 'vin') window.VinHistoryUI?.attach(input, row);
    }
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove-vehicle'; remove.textContent = '×'; remove.setAttribute('aria-label', (index + 1) + '. jármű törlése');
    remove.onclick = () => {
      const ownInvalid = [...row.querySelectorAll('input')].filter(input => invalidInputs.has(input)); for (const input of ownInvalid) invalidInputs.delete(input);
      if (!validInputs()) { for (const input of ownInvalid) invalidInputs.add(input); return; }
      brandOptionsDirty = true; const moved = Vehicles.remove(note, vehicle.id); touchNote(note); persistNotes(); renderVehicles(note); renderItems(note); renderList(); metadata(); if (moved) $('vehicle-error').textContent = 'A tételek megmaradtak a Hozzárendelés nélkül listában.';
    };
    row.append(remove); $('vehicles-list').append(row);
  });
  renderVehicleTabs(note);
}
$('add-vehicle').onclick = () => {
  const note = current(); if (!note || !validInputs()) return;
  const next = [...note.vehicles, Vehicles.blank(crypto.randomUUID())];
  try { Vehicles.validate(next); } catch (error) { $('vehicle-error').textContent = error.message; return; }
  note.vehicles = next; note.activeVehicleId = next.at(-1).id; note.items.push({ ...Items.blank(crypto.randomUUID()), vehicleId: note.activeVehicleId }); Vehicles.sync(note); touchNote(note); persistNotes(); renderVehicles(note); renderItems(note); metadata(); $('vehicles-list').lastElementChild.querySelector('input').focus();
};
function setDayContext(day) {
  selectedDay = day; selectedMonth = day.slice(0, 7); activeYear = Number(day.slice(0, 4));
  openedYears.add(activeYear); openedMonths.add(selectedMonth);
}
function searchableText(note) {
  if (!searchCache.has(note)) searchCache.set(note, fold(fields.map(field => note[field]).join(' ') + ' ' + (note.reminders || []).map(r => r.text).join(' ') + ' ' + Vehicles.searchText(note) + ' ' + note.vin + ' ' + NoteStatuses.get(note).label + ' ' + note.day + ' ' + note.part + ' ' + note.items.map(item => [item.partNumber, item.description || '', item.supplier, item.fullPrice, item.discountPercent, item.discountedPrice, item.quantity, Items.order(item).ordered ? 'megrendelve rendelve' : '', Items.order(item).orderedAt].join(' ')).join(' ')));
  return searchCache.get(note);
}
function visibleNotes() {
  const query = fold($('search').value.trim());
  return notes.filter(note => query ? searchableText(note).includes(query) : note.day === selectedDay).sort((a,b) => b.day.localeCompare(a.day));
}
function openDay(day) { return navigate(() => {
  clearSearch(); setDayContext(day);
  selected = notes.find(note => note.day === day)?.id ?? null;
  render();
}); }
function folderButton(label, type, badge, expanded) {
  const button = document.createElement('button');
  button.className = 'folder-row ' + type;
  const arrow = document.createElement('span'); arrow.className = 'chevron'; arrow.textContent = expanded ? '▾' : '▸'; arrow.setAttribute('aria-hidden', 'true');
  const icon = document.createElement('span'); icon.className = type === 'day' ? 'day-dot' : 'folder-icon'; icon.setAttribute('aria-hidden', 'true');
  const name = document.createElement('span'); name.className = 'label'; name.textContent = label;
  const count = document.createElement('span'); count.className = 'badge'; count.textContent = String(badge);
  button.append(...(type === 'day' ? [] : [arrow]), icon, name, count);
  if (type !== 'day') button.setAttribute('aria-expanded', String(expanded));
  return button;
}
function renderFolders() {
  const signature = JSON.stringify([years,days,[...openedYears],[...openedMonths],activeYear,selectedMonth,selectedDay,notes.length]);
  if (signature === folderSignature) return; folderSignature = signature;
  const counts = new Map(); for (const note of notes) for (const key of [note.day,note.day.slice(0,7),note.day.slice(0,4)]) counts.set(key,(counts.get(key)||0)+1);
  const root = $('folders'); root.replaceChildren();
  for (const year of years) {
    const yearKey = String(year), open = openedYears.has(year);
    const yearButton = folderButton(yearKey, 'year', counts.get(yearKey) || 0, open);
    yearButton.dataset.year = yearKey;
    yearButton.onclick = () => navigate(() => {
      open ? openedYears.delete(year) : openedYears.add(year);
      activeYear = year; selectedMonth = null; selectedDay = null; selected = null; clearSearch(); render();
    });
    root.append(yearButton);
    if (!open) continue;
    const monthGroup = document.createElement('div'); monthGroup.className = 'months';
    months.forEach((month, index) => {
      const key = yearKey + '-' + String(index + 1).padStart(2, '0'), expanded = openedMonths.has(key);
      const monthButton = folderButton(month, 'month', counts.get(key) || 0, expanded);
      monthButton.dataset.month = key;
      if (key === selectedMonth) monthButton.classList.add('current');
      monthButton.onclick = () => navigate(() => {
        expanded ? openedMonths.delete(key) : openedMonths.add(key);
        activeYear = year; selectedMonth = key; selectedDay = null; selected = null; clearSearch(); render();
      });
      monthGroup.append(monthButton);
      if (!expanded) return;
      const dayGroup = document.createElement('div'); dayGroup.className = 'days';
      for (const day of days.filter(day => day.startsWith(key + '-')).sort()) {
        const dayButton = folderButton(new Date(day + 'T12:00:00').toLocaleDateString('hu-HU', { day: '2-digit', weekday: 'long' }), 'day', counts.get(day) || 0);
        dayButton.dataset.day = day; dayButton.setAttribute('aria-current', String(day === selectedDay));
        if (day === selectedDay) dayButton.classList.add('active');
        dayButton.onclick = () => openDay(day); dayGroup.append(dayButton);
      }
      const addDay = document.createElement('button'); addDay.className = 'month-add'; addDay.textContent = '＋ Nap hozzáadása';
      addDay.dataset.addMonth = key; addDay.onclick = () => showDayDialog(key); dayGroup.append(addDay);
      monthGroup.append(dayGroup);
    });
    root.append(monthGroup);
  }
  const activeDay = root.querySelector('.folder-row.day.active');
  if (activeDay && typeof activeDay.scrollIntoView === 'function') activeDay.scrollIntoView({ block: 'nearest' });
}
function renderList() {
  const query = $('search').value.trim(), visible = visibleNotes();
  $('clear').hidden = !query;
  $('day-heading').textContent = query ? 'Keresési találatok' : selectedDay ? dateLabel(selectedDay) : selectedMonth ? activeYear + '. ' + months[Number(selectedMonth.slice(5)) - 1].toLocaleLowerCase('hu') : activeYear + '. év';
  $('day-description').textContent = query ? visible.length + ' találat · keresés minden évben' : selectedDay ? visible.length + ' név / bejegyzés ezen a napon' : 'Válassz egy napot a mappákból, vagy adj hozzá egy újat.';
  $('new').disabled = !loaded || !selectedDay;
  $('list').replaceChildren();
  const pages = query ? Math.max(1,Math.ceil(visible.length/SEARCH_PAGE_SIZE)) : 1; searchPage = Math.min(searchPage,pages-1);
  $('notes-search-pages').hidden = !query || pages===1; $('notes-search-page').textContent = (searchPage+1)+' / '+pages+'. oldal'; $('notes-search-prev').disabled = searchPage===0; $('notes-search-next').disabled = searchPage>=pages-1;
  for (const note of query ? visible.slice(searchPage*SEARCH_PAGE_SIZE,(searchPage+1)*SEARCH_PAGE_SIZE) : visible) {
    const button = document.createElement('button'); button.className = 'note' + (note.id === selected ? ' active' : ''); button.dataset.note = note.id;
    const workflowStatus = NoteStatuses.get(note); button.dataset.workflowStatus = workflowStatus.id;
    const title = document.createElement('strong'); title.textContent = note.title || 'Új név';
    if (Items.needsRecording(note.items)) { const warning=document.createElement('span');warning.className='note-recording-warning';warning.textContent='!';warning.title='Van megrendelt, még fel nem írt tétel.';warning.setAttribute('aria-label',warning.title);button.append(warning); }
    const preview = document.createElement('small'); preview.textContent = noteVinPreview(note, query); preview.title = preview.textContent;
    const caption = document.createElement('span'); caption.className = 'note-status-caption'; caption.textContent = '● ' + workflowStatus.label;
    button.append(title, preview); if(workflowStatus.id !== 'written') button.append(caption); button.onclick = () => afterCheck(selected === note.id ? validInputs() : allowNavigation(), () => { selected = note.id; setDayContext(note.day); render(); }); $('list').append(button);
  }
  if (!visible.length) {
    const empty = document.createElement('p'); empty.className = 'list-empty';
    empty.textContent = query ? 'Nincs találat. Próbálj más nevet, cikkszámot vagy alvázszámot.' : selectedDay ? 'Ide kerülnek az ehhez a naphoz felvett nevek.' : 'Év → hónap → nap → nevek és adatlapok';
    $('list').append(empty);
  }
}
function noteVinPreview(note, query = '') {
  const vins = [...new Set(Vehicles.get(note).map(vehicle => vehicle.vin.trim()).filter(Boolean))];
  return (vins.join(' · ') || 'Alvázszám nincs megadva') + (query ? ' · ' + note.day : '');
}
function changeSearchPage(delta) { return navigate(() => { const visible = visibleNotes(); searchPage = Math.max(0,Math.min(Math.ceil(visible.length/SEARCH_PAGE_SIZE)-1,searchPage+delta)); selected = visible[searchPage*SEARCH_PAGE_SIZE]?.id ?? null; if (current()) setDayContext(current().day); render(); }); }
$('notes-search-prev').onclick = () => changeSearchPage(-1); $('notes-search-next').onclick = () => changeSearchPage(1);
function metadata(updateTotals = true) {
  const note = current(); if (!note) return;
  $('date').textContent = 'Rögzítve: ' + new Date(note.created).toLocaleString('hu-HU') + ' · Módosítva: ' + new Date(note.updated).toLocaleString('hu-HU');
  if(updateTotals) renderTotals(note);
  $('words').textContent = note.body.length + ' karakter';
}
function render() {
  window.VinHistoryUI?.close();
  window.RemindersUI?.render();
  renderFolders(); renderList();
  const note = current();
  renderWorkflowStatus();
  $('breadcrumb').textContent = [activeYear, selectedMonth ? months[Number(selectedMonth.slice(5)) - 1] : '', selectedDay ? selectedDay.slice(8) + '.' : ''].filter(Boolean).join('  /  ');
  $('editor').hidden = !note; $('empty').hidden = !!note; $('delete').disabled = !note;
  $('empty').querySelector('h2').textContent = $('search').value.trim() ? 'Keress az összes korábbi adatban.' : selectedDay ? 'Ennek a napnak még nincs bejegyzése.' : 'Minden bejegyzés a saját napján.';
  $('empty').querySelector('p').textContent = $('search').value.trim() ? 'Név, alvázszám, cikkszám, olaj és ár alapján is kereshetsz.' : selectedDay ? 'Az „Új név a naphoz” gombbal veheted fel az első adatlapot.' : 'Nyiss meg egy napot, és azon belül több nevet is felvehetsz.';
  $('import-source').hidden = !note?.source;
  $('import-source').open = false;
  if (note?.source) {
    $('import-path').textContent = note.source.path || '';
    $('import-original').textContent = note.source.originalText || '';
  }
  if (note && $('search').value.trim()) { const id = Vehicles.findSelection(note, $('search').value); if (id !== undefined && note.activeVehicleId !== id) { note.activeVehicleId = id; markNoteChanged(note); persistNotes(); } }
  if (note) { for (const field of fields) $(field).value = note[field]; renderVehicles(note); renderItems(note); metadata(); }
}
function validInputs() {
  for (const input of invalidInputs) if (!input.isConnected) invalidInputs.delete(input);
  const input = invalidInputs.values().next().value;
  if (!input) return true;
  input.focus(); input.reportValidity(); return false;
}
function allowNavigation() { return validInputs(); }
function afterCheck(result, action) {
  return result && typeof result.then === 'function' ? result.then(allowed => allowed ? action() : false) : result ? action() : false;
}
function navigate(action) { return afterCheck(allowNavigation(), action); }
function renderTotals(note) {
  const visible = Vehicles.itemsFor(note), ordered = visible.filter(item => Items.isActive(item) && Items.order(item).ordered);
  const result = Items.totals(ordered);
  $('total-full').previousElementSibling.textContent = result.missingFull ? 'Megrendelt teli részösszeg' : 'Megrendelt teli összesen';
  $('total-savings').previousElementSibling.textContent = result.missing && result.priced ? 'Megrendelt kedvezmény részösszege' : 'Megrendelt kedvezmény összesen';
  $('total-discounted').previousElementSibling.textContent = result.missingDiscounted ? 'Megrendelt kedvezményes részösszeg' : 'Megrendelt kedvezményes összesen';
  const missing = ordered.length ? '—' : Items.formatMoney('0');
  $('total-full').textContent = result.fullPriced ? Items.formatMoney(result.fullPrice) : missing;
  $('total-savings').textContent = result.priced ? Items.formatMoney(result.savings) : missing;
  $('total-discounted').textContent = result.discountedPriced ? Items.formatMoney(result.discountedPrice) : missing;
  $('price-summary').textContent = !ordered.length ? 'Még nincs megrendelt tétel. Az összesítésbe a Megrendelve pipával jelölt sorok kerülnek.' : [
    'Csak a megrendelt tételek, a darabszámokat is figyelembe véve.',
    result.missingFull ? result.missingFull + ' megrendelt tételnél hiányzik a teli ár.' : '',
    result.missingDiscounted ? result.missingDiscounted + ' megrendelt tételnél hiányzik a kedvezményes ár.' : ''
  ].filter(Boolean).join(' ');
  renderPayment(note);
  const orders = Items.orderCounts(visible); $('order-summary').textContent = 'Megrendelve: ' + orders.ordered + ' / ' + orders.total + ' tétel';
}
function renderItems(note) {
  $('items-body').replaceChildren();
  invalidInputs.clear(); $('item-error').textContent = '';
  $('items-empty').hidden = Vehicles.itemsFor(note).length > 0;
  const legacy = [note.legacyParts || '', note.legacyTotals?.fullPrice ? 'Korábbi teli összeg: ' + note.legacyTotals.fullPrice + ' Ft' : '', note.legacyTotals?.discountedPrice ? 'Korábbi kedvezményes összeg: ' + note.legacyTotals.discountedPrice + ' Ft' : ''].filter(Boolean).join('\n');
  $('legacy-parts').hidden = !legacy; $('legacy-parts').open = false; $('legacy-parts-text').textContent = legacy;
  Vehicles.itemsFor(note).forEach((item, index) => {
    const row = document.createElement('tr'); row.dataset.itemId = item.id; row.dataset.vehicleId = item.vehicleId;
    const priceInputs = {};
    async function useStockPrice(force=false,product){const sku=item.partNumber;const r=product?{ok:true,product}:await window.notesAPI.inventoryResolve(sku);if(!r.ok)throw Error(r.error);if(item.partNumber!==sku||current()!==note||!Vehicles.itemsFor(note).includes(item))return;if(invalidInputs.size){if(force)throw Error('Előbb javítsd a megjelölt mezőt.');return false;}const next=window.InventoryPolicy.applyPrice(item,r.product,force);if(next===item)return false;Object.assign(item,next);priceDriver='auto';const visibleRow=[...$('items-body').children].find(r=>r.dataset.itemId===item.id);for(const field of ['fullPrice','discountPercent','discountedPrice']){const input=visibleRow?.querySelector('[data-field='+field+']');if(input)input.value=item[field];}Items.syncLegacy(note);touchNote(note);persistNotes();renderList();metadata();return true;}
    let priceDriver = item.priceMode === 'manual' || (item.priceMode === 'legacy' && item.discountedPrice !== '') ? 'manual' : 'auto';
    const orderControl = window.ItemOrderUI.create(item, (index + 1) + '. sor', checked => {
      try {
        Object.assign(item, Items.withOrder(item, checked)); Items.syncLegacy(note); touchNote(note);
        persistNotes(); renderList(); metadata();
      } catch (error) { $('item-error').textContent = error.message; }
    }, checked => {
      try { Object.assign(item, Items.withPaid(item, checked)); Items.syncLegacy(note); touchNote(note); persistNotes(); metadata(); }
      catch (error) { $('item-error').textContent = error.message; }
    }, checked => {
      try { Object.assign(item,Items.withArrival(item,checked)); touchNote(note); persistNotes(); metadata(false); }
      catch(error) { $('item-error').textContent=error.message; }
    }, checked => {
      try { Object.assign(item,Items.withRecorded(item,checked));touchNote(note);persistNotes();renderList();metadata(false); }
      catch(error) { $('item-error').textContent=error.message; }
    }, async checked => {
      try {if(!validInputs())return;if(checked){const result=await window.notesAPI.inventoryResolve(item.partNumber);if(!result.ok)throw Error(result.error);item.stockProductId=result.product.id;await useStockPrice(false,result.product);}item.fromStock=checked;touchNote(note);persistNotes();await window.NotesFlush();renderItems(note);void window.StockAlertUI?.refresh();$('item-error').textContent='';}
      catch(error){$('item-error').textContent=error.message;}
    });
    const columns = [['partNumber', 'Cikkszám', 'text'], ['fullPrice', 'Teli ár', 'number'], ['discountPercent', 'Kedvezmény %', 'number'], ['discountedPrice', 'Kedvezményes ár', 'number'], ['quantity', 'Db', 'number'], ['supplier', 'Beszállító', 'text']];
    for (const [field, label, type] of columns) {
      const cell = document.createElement('td');
      const input = document.createElement('input'); input.type = type; input.value = item[field]; input.dataset.field = field;
      input.setAttribute('aria-label', label + ' – ' + (index + 1) + '. sor');
      if (field === 'fullPrice' || field === 'discountedPrice') { input.min = '0'; input.max = '999999999999.99'; input.step = '0.01'; input.placeholder = 'Ár nélkül'; }
      if (field === 'discountPercent') { input.min = '0'; input.max = '100'; input.step = 'any'; input.placeholder = '—'; }
      if (field === 'quantity') { input.min = '1'; input.max = '999999'; input.step = '1'; input.required = true; }
      if (field === 'partNumber') { input.placeholder = 'Cikkszám'; input.maxLength = 1000; input.spellcheck = false; }
      if (field === 'supplier') { input.setAttribute('list', 'suppliers'); input.placeholder = 'Pl. IC'; input.maxLength = 200; }
      if (['fullPrice', 'discountPercent', 'discountedPrice'].includes(field)) priceInputs[field] = input;
      if (field === 'discountedPrice') { cell.className = 'calculated-price'; input.className = 'discounted-price-input'; }
      input.addEventListener('input', () => {
        input.setCustomValidity('');
        try {
          if (!input.validity.valid) throw new Error(field === 'quantity' ? 'A darabszám legalább 1, egész szám legyen.' : field === 'discountPercent' ? 'A kedvezmény 0 és 100 közötti százalék legyen.' : 'Az ár nem lehet negatív, és legfeljebb két tizedesjegyű lehet.');
          let patch = { [field]: input.value };
          if (['fullPrice', 'discountPercent', 'discountedPrice'].includes(field)) {
            if (field === 'discountedPrice') priceDriver = 'manual'; else if (field === 'discountPercent') priceDriver = 'auto';
            for (const control of Object.values(priceInputs)) { control.setCustomValidity(''); control.removeAttribute('aria-invalid'); invalidInputs.delete(control); }
            const source = priceDriver === 'manual' ? 'discountedPrice' : 'discountPercent';
            for (const control of [priceInputs.fullPrice, priceInputs[source]]) if (!control.validity.valid) throw new Error('Ellenőrizd az árakat és a kedvezményt.');
            patch = { fullPrice: priceInputs.fullPrice.value, [source]: priceInputs[source].value };
          }
          const next = Items.edit(item, patch);
          Items.validate([next]); Object.assign(item, next);
          invalidInputs.delete(input); input.removeAttribute('aria-invalid');
          const derived = ['fullPrice', 'discountPercent', 'discountedPrice'].includes(field) ? (item.priceMode === 'auto' ? 'discountedPrice' : 'discountPercent') : null;
          if (derived) { const control = priceInputs[derived]; control.value = item[derived]; control.setCustomValidity(''); control.removeAttribute('aria-invalid'); invalidInputs.delete(control); }
          if (field === 'supplier') input.value = item.supplier;
          $('item-error').textContent = invalidInputs.size ? 'Javítsd a megjelölt mezőt a továbblépéshez.' : '';
          orderControl.refresh();
          Items.syncLegacy(note); touchNote(note); persistNotes(); renderVehicleTabs(note); renderList(); metadata();
        } catch (error) {
          input.setCustomValidity(error.message); input.setAttribute('aria-invalid', 'true'); invalidInputs.add(input); $('item-error').textContent = error.message;
        }
      });
      if(field==='partNumber')input.addEventListener('change',()=>{if(item.fullPrice===''&&item.partNumber.trim()&&window.notesAPI.inventoryResolve)void useStockPrice().catch(()=>{});});
      if(field==='quantity')input.addEventListener('change',()=>{if(item.fromStock&&validInputs())window.NotesFlush().then(()=>{$('item-error').textContent='';}).catch(e=>{$('item-error').textContent=e.message;});});
      cell.append(input);
      if (field === 'partNumber') {
        const stockPrice=document.createElement('button');stockPrice.type='button';stockPrice.className='item-location-button';stockPrice.textContent='Raktári ár';stockPrice.title='A raktár Ft/db árának átvétele a Teli ár mezőbe, készletlevonás nélkül';stockPrice.onclick=async()=>{stockPrice.disabled=true;try{if(!await useStockPrice(true))throw Error('Ehhez a termékhez még nincs raktári ár megadva.');$('item-error').textContent='';}catch(e){$('item-error').textContent=e.message;}finally{stockPrice.disabled=false;}};cell.append(stockPrice);
        const place=document.createElement('button');place.type='button';place.className='item-location-button';place.textContent='⌖ Hely';place.title='Raktári hely keresése ehhez a cikkszámhoz';place.onclick=async()=>{place.disabled=true;try{const r=await window.notesAPI.inventoryResolve(item.partNumber);if(!r.ok)throw Error(r.error);window.WarehouseMapUI.showProduct(r.product||r);}catch(e){$('item-error').textContent='Raktári hely: '+e.message;}finally{place.disabled=false;}};cell.append(place);
        const assignment = document.createElement('select'); assignment.className = 'item-vehicle-select'; assignment.dataset.field = 'vehicleId'; assignment.setAttribute('aria-label', 'Autó – ' + (index + 1) + '. cikkszámsor');
        const choices = [{ id: '', text: 'Hozzárendelés nélkül' }, ...note.vehicles.map((vehicle, number) => ({ id: vehicle.id, text: Vehicles.label(vehicle, number) }))];
        for (const choice of choices) { const option = document.createElement('option'); option.value = choice.id; option.textContent = choice.text; assignment.append(option); }
        assignment.value = item.vehicleId || '';
        assignment.onchange = () => {
          if (!validInputs()) { assignment.value = item.vehicleId || ''; return; }
          item.vehicleId = assignment.value; Vehicles.validateAssignments(note); touchNote(note); persistNotes(); renderVehicleTabs(note); renderItems(note); renderList(); metadata();
        };
        const label = document.createElement('label'); label.className = 'item-vehicle-label'; label.textContent = 'Autó'; label.append(assignment); cell.append(label);
      }
      row.append(cell);
    }
    row.append(orderControl.cell);
    const actions = document.createElement('td'), remove = document.createElement('button');
    remove.className = 'remove-item'; remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', (index + 1) + '. cikkszámsor törlése');
    remove.onclick = () => {
      for (const input of row.querySelectorAll('input')) invalidInputs.delete(input);
      if (!validInputs()) return;
      note.items = note.items.filter(entry => entry.id !== item.id); Items.syncLegacy(note); touchNote(note); persistNotes(); renderVehicleTabs(note); renderItems(note); renderList(); metadata();
    };
    actions.append(remove); row.append(actions); $('items-body').append(row);
  });
}
$('add-item').onclick = () => {
  const note = current(); if (!note || !validInputs()) return;
  note.items.push({ ...Items.blank(crypto.randomUUID()), vehicleId: note.activeVehicleId }); touchNote(note); persistNotes(); renderItems(note); metadata();
  $('items-body').lastElementChild.querySelector('input').focus();
};
function showDayDialog(month = selectedMonth) {
  if (!loaded || !validInputs()) return;
  $('day-value').value = month ? (today.startsWith(month + '-') ? today : month + '-01') : (activeYear === Number(today.slice(0, 4)) ? today : activeYear + '-01-01');
  $('day-dialog').showModal(); $('day-value').focus();
}
$('add-day').onclick = () => showDayDialog();
$('day-cancel').onclick = () => $('day-dialog').close();
$('day-form').onsubmit = event => {
  event.preventDefault(); if (!loaded) return;
  const day = $('day-value').value;
  if (!validDay(day)) { $('day-value').reportValidity(); return; }
  const year = Number(day.slice(0, 4)); let changed = false;
  if (!years.includes(year)) { years.push(year); years.sort((a, b) => a - b); changed = true; }
  if (!days.includes(day)) { days.push(day); days.sort(); changed = true; }
  if (changed) persistArchive();
  $('day-dialog').close(); openDay(day);
};
$('add-year').onclick = () => {
  if (!loaded || !validInputs()) return;
  $('year-error').textContent = ''; $('year-value').value = String(Math.max(...years) + 1); $('year-dialog').showModal(); $('year-value').focus();
};
$('year-cancel').onclick = () => $('year-dialog').close();
$('year-form').onsubmit = event => {
  event.preventDefault(); if (!loaded) return;
  const year = Number($('year-value').value);
  if (!Number.isInteger(year) || year < 1900 || year > 9999) { $('year-error').textContent = '1900 és 9999 közötti évet adj meg.'; return; }
  if (years.includes(year)) { $('year-error').textContent = 'Ez az év már szerepel a mappák között.'; return; }
  return navigate(() => {
  years.push(year); years.sort((a, b) => a - b); openedYears.add(year); openedMonths.add(year + '-01');
  activeYear = year; selectedMonth = year + '-01'; selectedDay = null; selected = null; clearSearch();
  persistArchive(); $('year-dialog').close(); render();
  });
};
function createNote(day, initial = {}) {
  clearSearch(); setDayContext(day); const now = new Date().toISOString();
  const vehicle = { ...Vehicles.blank(crypto.randomUUID()), vin: initial.vin || '', brand: initial.brand || '' };
  const note = { id: crypto.randomUUID(), title: initial.title || '', phone: initial.phone || '', body: '', vin: vehicle.vin, part: '', oil: '', fullPrice: '', discountPrice: '', workflowStatus: NoteStatuses.defaultId, reminders: [], paid: false, vehicles: [vehicle], items: [Items.blank(crypto.randomUUID())], day: selectedDay, created: now, updated: now };
  note.activeVehicleId = note.vehicles[0].id; note.items[0].vehicleId = note.activeVehicleId;
  notes.unshift(note); touchNote(note); selected = note.id;
  if (!days.includes(selectedDay)) { days.push(selectedDay); days.sort(); persistArchive(); }
  if (!years.includes(activeYear)) { years.push(activeYear); years.sort((a, b) => a - b); persistArchive(); }
  persistNotes(); render(); $('title').focus(); return true;
}
$('new').onclick = () => {
  if (!loaded || !selectedDay) return;
  return navigate(() => createNote(selectedDay));
};
for (const field of fields) $(field).addEventListener('input', () => {
  const note = current(); if (!note) return;
  if (!$(field).validity.valid) { $('status').textContent = 'Az ár nem lehet negatív, legfeljebb két tizedest adj meg.'; return; }
  if(field === 'oil'){const vehicle=note.vehicles.find(v=>v.id===note.activeVehicleId);if(!vehicle)return;vehicle.oil=$(field).value;note.oil=note.vehicles.map(v=>v.oil||'').filter(Boolean).join(' / ');}else note[field] = $(field).value; touchNote(note); persistNotes();
  if($('search').value.trim())renderList();else if(field==='title'||field==='oil'){const card=[...$('list').children].find(c=>c.dataset.note===note.id);if(card){card.querySelector('strong').textContent=note.title||'Új név';const preview=card.querySelector('small');preview.textContent=noteVinPreview(note);preview.title=preview.textContent;}}
  metadata(false);
});
$('search').oninput = () => {
  if (!validInputs()) { $('search').value = appliedSearch; return; }
  const query = $('search').value, visible = visibleNotes();
  const move = !visible.some(note => note.id === selected);
  if (move) $('search').value = appliedSearch;
  return afterCheck(move ? allowNavigation() : true, () => {
    $('search').value = query; appliedSearch = query; searchPage = move ? 0 : Math.max(0,Math.floor(visible.findIndex(n=>n.id===selected)/SEARCH_PAGE_SIZE));
    if (move) selected = visible[0]?.id ?? null;
    if (current()) setDayContext(current().day); render();
  });
};
$('clear').onclick = () => navigate(() => { clearSearch(); selected = notes.find(note => note.day === selectedDay)?.id ?? null; render(); });
$('delete').onclick = () => $('confirm').showModal(); $('cancel').onclick = () => $('confirm').close();
$('remove').onclick = () => { brandOptionsDirty = true; invalidInputs.clear(); dirtyNotes.delete(selected); deletedNotes.set(selected,++noteChangeVersion); notes = notes.filter(note => note.id !== selected); selected = visibleNotes()[0]?.id ?? null; if (current()) setDayContext(current().day); $('confirm').close(); persistArchive(); persistNotes(); render(); };
$('export').onclick = async () => {
  if (!loaded) return;
  try { await window.NotesFlush(); if(window.WorkOrdersUI)await window.WorkOrdersUI.flush(); } catch { return; }
  try { if (await window.notesAPI.export(notes, archiveData())) $('status').textContent = '✓ Biztonsági mentés elkészült'; }
  catch { $('status').textContent = 'Nem sikerült a biztonsági mentés.'; }
};
// Native closing is paused in main.js. Unload is only a final guard for reloads.
window.addEventListener('beforeunload', event => {
  if (invalidInputs.size || pending || saveErrors.size) { event.preventDefault(); event.returnValue = ''; }
});
window.NotesCheckBeforeHide = () => validInputs();
window.NotesPrepareClose = async () => {
  if (!validInputs()) return false;
  const pendingReminders = notes.flatMap(note => (note.reminders || []).filter(reminder => !reminder.done).map(reminder => (note.title || 'Új név') + ': ' + reminder.text));
  return await window.NoteReviewUI.confirm({ title: 'Kilépés előtti ellenőrzés', pending: pendingReminders }) === true;
};
window.NotesFlushForClose = async () => {
  await window.notesAPI.inventoryRecover?.();
 await flushSaveQueue();
  if (saveErrors.size) throw new Error($('status').textContent||'A jegyzetek mentése nem sikerült.');
};
function loadData(preferredNoteId) {
return Promise.all([window.notesAPI.load(), window.notesAPI.loadArchive()]).then(async ([data, archive]) => {
  folderSignature = null; brandOptionsDirty = true;
  ({ notes, years, days } = normalize(data, archive)); loaded = true;
  const preferred = notes.find(note => note.id === preferredNoteId);
  const initialDay = preferred?.day || (days.includes(today) ? today : [...days].sort().at(-1) ?? today);
  setDayContext(initialDay); selected = preferred?.id || notes.find(note => note.day === initialDay)?.id || null;
  const stockPending=await window.notesAPI.inventoryPending?.();
  $('status').textContent = stockPending?'Függő raktárművelet · kapcsolódj a központhoz és nyomj Mentést.':'✓ Betöltve · kézi / óránkénti mentés'; render(); return true;
}).catch(() => {
  $('status').textContent = 'A mentett adatok nem olvashatók. Az eredeti fájlok megmaradtak.';
  for (const id of ['new', 'add-year', 'add-day']) $(id).disabled = true;
  return false;
});
}
loadData();
window.ReminderContext = () => ({ loaded, notes, note: current() });
window.ReminderChange = (noteId, transform) => {
  if (!loaded || !validInputs()) return false;
  if (window.WorkOrdersUI && !window.WorkOrdersUI.canLeave()) return false;
  const note = notes.find(note => note.id === noteId); if (!note) return false;
  const rows = transform(JSON.parse(JSON.stringify(note.reminders || [])));
  window.NoteReminders.validate(rows); note.reminders = rows; touchNote(note);
  persistNotes(); renderList(); window.RemindersUI?.render(); if (current()?.id === noteId) metadata(); return true;
};
window.ReminderOpenNote = id => navigate(() => afterCheck(window.WorkOrdersUI ? window.WorkOrdersUI.showNotes() : true, () => {
  const note = notes.find(note => note.id === id); if (!note) return false;
  selected = id; clearSearch(); setDayContext(note.day); render(); return true;
}));
window.NotesNavigate = navigate;
window.VinHistoryContext = () => ({ notes, noteId: selected });
window.VinHistoryOpen = (noteId, vehicleId) => navigate(() => afterCheck(window.WorkOrdersUI ? window.WorkOrdersUI.showNotes() : true, () => {
  const note = notes.find(entry => entry.id === noteId);
  if (!note || !note.vehicles.some(vehicle => vehicle.id === vehicleId)) return false;
  selected = note.id; clearSearch(); setDayContext(note.day);
  if (note.activeVehicleId !== vehicleId) { note.activeVehicleId = vehicleId; markNoteChanged(note); persistNotes(); }
  render(); return true;
}));
window.VinHistoryNew = (noteId, vehicleId) => navigate(() => afterCheck(window.WorkOrdersUI ? window.WorkOrdersUI.showNotes() : true, () => {
  const source = notes.find(note => note.id === noteId), vehicle = source?.vehicles.find(entry => entry.id === vehicleId);
  if (!loaded || !source || !vehicle?.vin.trim()) return false;
  return createNote(localDay(new Date()), { title: source.title, phone: source.phone, vin: vehicle.vin, brand: vehicle.brand });
}));
window.NotesExportSelection = () => current()?.id || null;
window.NotesImportContext = () => ({ day: selectedDay || today, canLeave: allowNavigation });
window.NotesRefresh = id => { clearSearch(); return loadData(id); };
window.NotesFlush = async () => {
 if (!loaded) throw new Error('A jegyzetek még nem töltődtek be.');
 await window.notesAPI.inventoryRecover?.();
 await flushSaveQueue();
 if (saveErrors.size) throw new Error($('status').textContent||'A jegyzetek mentése nem sikerült.');
};

async function saveLocalWork() {
  if(!validInputs()||(window.WorkOrdersUI&&!window.WorkOrdersUI.canLeave()))return false;
  try { await window.NotesFlush(); if(window.WorkOrdersUI)await window.WorkOrdersUI.flush(); return true; }
  catch { return false; }
}
$('save-notes').onclick=saveLocalWork;
window.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();void saveLocalWork();}});
const hourlySaveTimer=setInterval(()=>{void saveLocalWork();},60*60*1000);
window.addEventListener('pagehide',()=>clearInterval(hourlySaveTimer));
window.SaveLocalWork=saveLocalWork;

window.NoteForWorkOrder = () => afterCheck(allowNavigation(), () => current() ? Vehicles.selectedNote(current()) : null);
window.addEventListener('excel-imported', async event => {
 if (event.detail.target === 'notes') { await loadData(event.detail.noteId); $('status').textContent = event.detail.message; }
});
