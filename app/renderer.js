const $ = id => document.getElementById(id);
const { months, localDay, validDay, normalize } = window.NotesArchive;
const fields = ['title', 'vin', 'oil', 'body'];
const Items = window.LineItems;
const NoteStatuses = window.NoteStatuses;
const invalidInputs = new Set();
const today = localDay(new Date());
let notes = [], years = [], days = [], loaded = false, selected = null, selectedDay = today;
let activeYear = Number(today.slice(0, 4)), selectedMonth = today.slice(0, 7);
const openedYears = new Set(), openedMonths = new Set(), saveErrors = new Set();
let queue = Promise.resolve(), revision = 0, pending = 0;
const current = () => notes.find(note => note.id === selected);
const fold = value => value.toLocaleLowerCase('hu').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const dateLabel = day => new Date(day + 'T12:00:00').toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
const money = value => new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 2 }).format(value);
const archiveData = () => ({ years: [...years], days: [...days] });
function queueSave(target, value, writer) {
  const snapshot = JSON.parse(JSON.stringify(value)), version = ++revision;
  pending++; $('status').textContent = 'Mentés…';
  queue = queue.catch(() => {}).then(() => writer(snapshot)).then(() => {
    saveErrors.delete(target);
    if (version === revision) $('status').textContent = saveErrors.size ? 'A mentés nem sikerült. Készíts biztonsági mentést!' : '✓ Minden változás mentve';
  }).catch(() => {
    saveErrors.add(target); $('status').textContent = 'A mentés nem sikerült. Készíts biztonsági mentést!';
  }).finally(() => { pending--; });
}
const persistNotes = () => queueSave('notes', notes, data => window.notesAPI.save(data));
const persistArchive = () => queueSave('archive', archiveData(), data => window.notesAPI.saveArchive(data));
function clearSearch() { $('search').value = ''; $('clear').hidden = true; }
function renderWorkflowStatus() {
  const note = current();
  for (const input of $('note-status-options').querySelectorAll('input')) {
    input.disabled = !note; input.checked = !!note && input.value === NoteStatuses.get(note).id;
  }
}
for (const status of NoteStatuses.all) {
  const label = document.createElement('label'); label.className = 'note-status-option'; label.dataset.workflowStatus = status.id;
  const input = document.createElement('input'); input.type = 'radio'; input.name = 'note-status'; input.value = status.id;
  const text = document.createElement('span'); text.textContent = status.label; label.append(input, text); $('note-status-options').append(label);
  input.onchange = () => {
    const note = current();
    if (!note || !allowNavigation()) { renderWorkflowStatus(); return; }
    note.workflowStatus = status.id; note.updated = new Date().toISOString(); persistNotes(); renderList(); metadata();
  };
}
function setDayContext(day) {
  selectedDay = day; selectedMonth = day.slice(0, 7); activeYear = Number(day.slice(0, 4));
  openedYears.add(activeYear); openedMonths.add(selectedMonth);
}
function visibleNotes() {
  const query = fold($('search').value.trim());
  return notes.filter(note => query ? fold(fields.map(field => note[field]).join(' ') + ' ' + NoteStatuses.get(note).label + ' ' + note.day + ' ' + note.part + ' ' + note.items.map(item => [item.partNumber, item.description || '', item.supplier, item.fullPrice, item.discountPercent, item.discountedPrice, item.quantity, Items.order(item).ordered ? 'megrendelve rendelve' : '', Items.order(item).orderedAt].join(' ')).join(' ')).includes(query) : note.day === selectedDay)
    .sort((a, b) => b.day.localeCompare(a.day) || a.created.localeCompare(b.created));
}
function openDay(day) {
  if (!allowNavigation()) return;
  clearSearch(); setDayContext(day);
  selected = notes.find(note => note.day === day)?.id ?? null;
  render();
}
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
  const root = $('folders'); root.replaceChildren();
  for (const year of years) {
    const yearKey = String(year), open = openedYears.has(year);
    const yearButton = folderButton(yearKey, 'year', notes.filter(note => note.day.startsWith(yearKey + '-')).length, open);
    yearButton.dataset.year = yearKey;
    yearButton.onclick = () => {
      if (!allowNavigation()) return;
      open ? openedYears.delete(year) : openedYears.add(year);
      activeYear = year; selectedMonth = null; selectedDay = null; selected = null; clearSearch(); render();
    };
    root.append(yearButton);
    if (!open) continue;
    const monthGroup = document.createElement('div'); monthGroup.className = 'months';
    months.forEach((month, index) => {
      const key = yearKey + '-' + String(index + 1).padStart(2, '0'), expanded = openedMonths.has(key);
      const monthButton = folderButton(month, 'month', notes.filter(note => note.day.startsWith(key + '-')).length, expanded);
      monthButton.dataset.month = key;
      if (key === selectedMonth) monthButton.classList.add('current');
      monthButton.onclick = () => {
        if (!allowNavigation()) return;
        expanded ? openedMonths.delete(key) : openedMonths.add(key);
        activeYear = year; selectedMonth = key; selectedDay = null; selected = null; clearSearch(); render();
      };
      monthGroup.append(monthButton);
      if (!expanded) return;
      const dayGroup = document.createElement('div'); dayGroup.className = 'days';
      for (const day of days.filter(day => day.startsWith(key + '-')).sort()) {
        const dayButton = folderButton(new Date(day + 'T12:00:00').toLocaleDateString('hu-HU', { day: '2-digit', weekday: 'long' }), 'day', notes.filter(note => note.day === day).length);
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
  for (const note of visible) {
    const button = document.createElement('button'); button.className = 'note' + (note.id === selected ? ' active' : ''); button.dataset.note = note.id;
    const workflowStatus = NoteStatuses.get(note); button.dataset.workflowStatus = workflowStatus.id;
    const title = document.createElement('strong'); title.textContent = note.title || 'Új név';
    const preview = document.createElement('small'); preview.textContent = query ? note.day : note.items.map(item => item.partNumber).filter(Boolean).join(' · ') || note.oil || note.vin || 'Adatok kitöltése…';
    const caption = document.createElement('span'); caption.className = 'note-status-caption'; caption.textContent = '● ' + workflowStatus.label;
    button.append(title, preview, caption); button.onclick = () => { if (!allowNavigation()) return; selected = note.id; setDayContext(note.day); render(); }; $('list').append(button);
  }
  if (!visible.length) {
    const empty = document.createElement('p'); empty.className = 'list-empty';
    empty.textContent = query ? 'Nincs találat. Próbálj más nevet, cikkszámot vagy alvázszámot.' : selectedDay ? 'Ide kerülnek az ehhez a naphoz felvett nevek.' : 'Év → hónap → nap → nevek és adatlapok';
    $('list').append(empty);
  }
}
function metadata() {
  const note = current(); if (!note) return;
  $('date').textContent = 'Rögzítve: ' + new Date(note.created).toLocaleString('hu-HU') + ' · Módosítva: ' + new Date(note.updated).toLocaleString('hu-HU');
  renderTotals(note);
  $('words').textContent = note.body.length + ' karakter';
}
function render() {
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
  if (note) { for (const field of fields) $(field).value = note[field]; renderItems(note); metadata(); }
}
function allowNavigation() {
  for (const input of invalidInputs) if (!input.isConnected) invalidInputs.delete(input);
  const input = invalidInputs.values().next().value;
  if (!input) return true;
  input.focus(); input.reportValidity(); return false;
}
function renderTotals(note) {
  const result = Items.totals(note.items);
  $('total-full').previousElementSibling.textContent = result.missing ? 'Teli részösszeg' : 'Teli összesen';
  $('total-discounted').previousElementSibling.textContent = result.missing ? 'Kedvezményes részösszeg' : 'Kedvezményes összesen';
  $('total-full').textContent = result.priced ? Items.formatMoney(result.fullPrice) : '—';
  $('total-savings').textContent = result.priced ? Items.formatMoney(result.savings) : '—';
  $('total-discounted').textContent = result.priced ? Items.formatMoney(result.discountedPrice) : '—';
  $('price-summary').textContent = result.missing ? result.missing + ' sornál még hiányzik az ár. Az összesítés csak az ismert árú tételeket tartalmazza.' : 'Az összesítés a darabszámokat is figyelembe veszi.';
  const orders = Items.orderCounts(note.items); $('order-summary').textContent = 'Megrendelve: ' + orders.ordered + ' / ' + orders.total + ' tétel';
}
function renderItems(note) {
  $('items-body').replaceChildren();
  invalidInputs.clear(); $('item-error').textContent = '';
  $('items-empty').hidden = note.items.length > 0;
  const legacy = [note.legacyParts || '', note.legacyTotals?.fullPrice ? 'Korábbi teli összeg: ' + note.legacyTotals.fullPrice + ' Ft' : '', note.legacyTotals?.discountedPrice ? 'Korábbi kedvezményes összeg: ' + note.legacyTotals.discountedPrice + ' Ft' : ''].filter(Boolean).join('\n');
  $('legacy-parts').hidden = !legacy; $('legacy-parts').open = false; $('legacy-parts-text').textContent = legacy;
  note.items.forEach((item, index) => {
    const row = document.createElement('tr'); row.dataset.itemId = item.id;
    const priceInputs = {};
    let priceDriver = item.priceMode === 'manual' || (item.priceMode === 'legacy' && item.discountedPrice !== '') ? 'manual' : 'auto';
    const orderControl = window.ItemOrderUI.create(item, (index + 1) + '. sor', checked => {
      try {
        Object.assign(item, Items.withOrder(item, checked)); Items.syncLegacy(note); note.updated = new Date().toISOString();
        persistNotes(); renderList(); metadata();
      } catch (error) { $('item-error').textContent = error.message; }
    });
    const columns = [['partNumber', 'Cikkszám', 'text'], ['fullPrice', 'Teli ár', 'number'], ['discountPercent', 'Kedvezmény %', 'number'], ['discountedPrice', 'Kedvezményes ár', 'number'], ['quantity', 'Db', 'number'], ['supplier', 'Beszállító', 'text']];
    for (const [field, label, type] of columns) {
      const cell = document.createElement('td');
      const input = document.createElement('input'); input.type = type; input.value = item[field]; input.dataset.field = field;
      input.setAttribute('aria-label', label + ' – ' + (index + 1) + '. sor');
      if (field === 'fullPrice' || field === 'discountedPrice') { input.min = '0'; input.max = '999999999999.99'; input.step = '0.01'; input.placeholder = 'Ár nélkül'; }
      if (field === 'discountPercent') { input.min = '0'; input.max = '100'; input.step = 'any'; input.placeholder = '0'; }
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
          Items.syncLegacy(note); note.updated = new Date().toISOString(); persistNotes(); renderList(); metadata();
        } catch (error) {
          input.setCustomValidity(error.message); input.setAttribute('aria-invalid', 'true'); invalidInputs.add(input); $('item-error').textContent = error.message;
        }
      });
      cell.append(input); row.append(cell);
    }
    row.append(orderControl.cell);
    const actions = document.createElement('td'), remove = document.createElement('button');
    remove.className = 'remove-item'; remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', (index + 1) + '. cikkszámsor törlése');
    remove.onclick = () => {
      for (const input of row.querySelectorAll('input')) invalidInputs.delete(input);
      if (!allowNavigation()) return;
      note.items = note.items.filter(entry => entry.id !== item.id); Items.syncLegacy(note); note.updated = new Date().toISOString(); persistNotes(); renderItems(note); renderList(); metadata();
    };
    actions.append(remove); row.append(actions); $('items-body').append(row);
  });
}
$('add-item').onclick = () => {
  const note = current(); if (!note || !allowNavigation()) return;
  note.items.push(Items.blank(crypto.randomUUID())); note.updated = new Date().toISOString(); persistNotes(); renderItems(note); metadata();
  $('items-body').lastElementChild.querySelector('input').focus();
};
function showDayDialog(month = selectedMonth) {
  if (!loaded || !allowNavigation()) return;
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
  if (!loaded || !allowNavigation()) return;
  $('year-error').textContent = ''; $('year-value').value = String(Math.max(...years) + 1); $('year-dialog').showModal(); $('year-value').focus();
};
$('year-cancel').onclick = () => $('year-dialog').close();
$('year-form').onsubmit = event => {
  event.preventDefault(); if (!loaded) return;
  const year = Number($('year-value').value);
  if (!Number.isInteger(year) || year < 1900 || year > 9999) { $('year-error').textContent = '1900 és 9999 közötti évet adj meg.'; return; }
  if (years.includes(year)) { $('year-error').textContent = 'Ez az év már szerepel a mappák között.'; return; }
  years.push(year); years.sort((a, b) => a - b); openedYears.add(year); openedMonths.add(year + '-01');
  activeYear = year; selectedMonth = year + '-01'; selectedDay = null; selected = null; clearSearch();
  persistArchive(); $('year-dialog').close(); render();
};
$('new').onclick = () => {
  if (!loaded || !selectedDay || !allowNavigation()) return;
  clearSearch(); const now = new Date().toISOString();
  const note = { id: crypto.randomUUID(), title: '', body: '', vin: '', part: '', oil: '', fullPrice: '', discountPrice: '', workflowStatus: NoteStatuses.defaultId, items: [Items.blank(crypto.randomUUID())], day: selectedDay, created: now, updated: now };
  notes.push(note); selected = note.id;
  if (!days.includes(selectedDay)) { days.push(selectedDay); days.sort(); persistArchive(); }
  if (!years.includes(activeYear)) { years.push(activeYear); years.sort((a, b) => a - b); persistArchive(); }
  persistNotes(); render(); $('title').focus();
};
for (const field of fields) $(field).addEventListener('input', () => {
  const note = current(); if (!note) return;
  if (!$(field).validity.valid) { $('status').textContent = 'Az ár nem lehet negatív, legfeljebb két tizedest adj meg.'; return; }
  note[field] = $(field).value; note.updated = new Date().toISOString(); persistNotes(); renderList(); metadata();
});
$('search').oninput = () => {
  if (!allowNavigation()) return;
  const visible = visibleNotes();
  if (!visible.some(note => note.id === selected)) selected = visible[0]?.id ?? null;
  if (current()) setDayContext(current().day); render();
};
$('clear').onclick = () => { if (!allowNavigation()) return; clearSearch(); selected = notes.find(note => note.day === selectedDay)?.id ?? null; render(); };
$('delete').onclick = () => $('confirm').showModal(); $('cancel').onclick = () => $('confirm').close();
$('remove').onclick = () => { invalidInputs.clear(); notes = notes.filter(note => note.id !== selected); selected = visibleNotes()[0]?.id ?? null; if (current()) setDayContext(current().day); $('confirm').close(); persistArchive(); persistNotes(); render(); };
$('export').onclick = async () => {
  if (!loaded) return;
  if (window.WorkOrdersUI) { try { await window.WorkOrdersUI.flush(); } catch { return; } }
  try { if (await window.notesAPI.export(notes, archiveData())) $('status').textContent = '✓ Biztonsági mentés elkészült'; }
  catch { $('status').textContent = 'Nem sikerült a biztonsági mentés.'; }
};
window.addEventListener('beforeunload', event => {
  if (invalidInputs.size) { event.preventDefault(); event.returnValue = false; allowNavigation(); }
  else if (pending || saveErrors.size) { event.preventDefault(); event.returnValue = false; queue.then(() => { if (!pending && !saveErrors.size) window.close(); }); }
});
function loadData(preferredNoteId) {
return Promise.all([window.notesAPI.load(), window.notesAPI.loadArchive()]).then(([data, archive]) => {
  ({ notes, years, days } = normalize(data, archive)); loaded = true;
  const preferred = notes.find(note => note.id === preferredNoteId);
  const initialDay = preferred?.day || (days.includes(today) ? today : [...days].sort().at(-1) ?? today);
  setDayContext(initialDay); selected = preferred?.id || notes.find(note => note.day === initialDay)?.id || null;
  $('status').textContent = '✓ Minden változás mentve'; render(); return true;
}).catch(() => {
  $('status').textContent = 'A mentett adatok nem olvashatók. Az eredeti fájlok megmaradtak.';
  for (const id of ['new', 'add-year', 'add-day']) $(id).disabled = true;
  return false;
});
}
loadData();
window.NotesImportContext = () => ({ day: selectedDay || today, canLeave: allowNavigation });
window.NotesRefresh = id => { clearSearch(); return loadData(id); };
window.NotesFlush = async () => {
 if (!loaded) throw new Error('A jegyzetek még nem töltődtek be.');
 await queue;
 if (saveErrors.size) throw new Error('A jegyzetek mentése nem sikerült. Beolvasás előtt ellenőrizd a lemez szabad helyét.');
};
window.NoteForWorkOrder = () => { if (!allowNavigation()) return null; return current(); };
window.addEventListener('excel-imported', async event => {
 if (event.detail.target === 'notes') { await loadData(event.detail.noteId); $('status').textContent = event.detail.message; }
});
