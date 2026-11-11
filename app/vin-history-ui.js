(function () {
  'use strict';
  const $ = id => document.getElementById(id), Model = window.VinHistory;
  const PAGE_SIZE = 30;
  let active = null, sequence = 0, dialogQuery = '', dialogExclude = null, dialogPage = 0, returnInput = null;
  const suppressed = new WeakSet();
  function element(tag, className, text) {
    const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node;
  }
  function button(text, action, className) {
    const node = element('button', className, text); node.type = 'button'; node.onclick = action; return node;
  }
  function context() { return window.VinHistoryContext?.() || { notes: [], noteId: null }; }
  function close() {
    if (!active) return;
    clearTimeout(active.timer); active.panel.remove(); active.input.setAttribute('aria-expanded', 'false'); active.input.removeAttribute('aria-controls'); active = null;
  }
  function closeDialog() {
    $('vin-history-dialog').close();
    if (returnInput?.isConnected) { suppressed.add(returnInput); returnInput.focus(); }
  }
  async function openNote(entry) {
    if (await window.VinHistoryOpen(entry.noteId, entry.vehicleId)) {
      close(); if ($('vin-history-dialog').open) $('vin-history-dialog').close();
      const input = document.querySelector('.vehicle-row.is-selected input[data-vehicle-field=vin]');
      if (input) { suppressed.add(input); input.focus(); }
    }
  }
  async function newNote(entry) {
    if (await window.VinHistoryNew(entry.noteId, entry.vehicleId)) { close(); if ($('vin-history-dialog').open) $('vin-history-dialog').close(); $('title').focus(); }
  }
  function historyRow(entry, includeNew = false) {
    const row = element('div', 'vin-history-row'), text = element('div', 'vin-history-row-text');
    const date = /^\d{4}-\d{2}-\d{2}$/.test(entry.day) ? new Date(entry.day + 'T12:00:00').toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' }) : entry.day;
    text.append(element('strong', '', date + ' · ' + entry.title), element('small', '', entry.summary));
    const actions = element('div', 'vin-history-row-actions');
    const open = button('Megnyitás →', () => void openNote(entry)); open.setAttribute('aria-label', date + ' · ' + entry.title + ' · jegyzet megnyitása'); actions.append(open);
    if (includeNew) actions.append(button('Új jegyzet mára', () => void newNote(entry)));
    row.append(text, actions); return row;
  }
  function renderDialog() {
    const groups = Model.find(context().notes, dialogQuery, dialogExclude), entries = groups.flatMap(group => group.entries.map(entry => ({ group, entry })));
    dialogPage = Math.max(0, Math.min(dialogPage, Math.ceil(entries.length / PAGE_SIZE) - 1));
    $('vin-history-dialog-title').textContent = 'Korábbi jegyzetek az autóhoz';
    $('vin-history-dialog-summary').textContent = dialogQuery + ' · ' + groups.length + ' autó · ' + entries.length + ' bejegyzés a saját jegyzetekben';
    const list = $('vin-history-dialog-list'); list.replaceChildren();
    for (const { group, entry } of entries.slice(dialogPage * PAGE_SIZE, (dialogPage + 1) * PAGE_SIZE)) {
      const block = element('section', 'vin-history-dialog-entry'); block.append(element('h3', '', [...group.brands, group.vin].join(' · ')), historyRow(entry, true)); list.append(block);
    }
    if (!entries.length) list.append(element('p', 'vin-history-empty', 'Nincs másik jegyzet ezzel az alvázszámmal.'));
    $('vin-history-page').textContent = (dialogPage + 1) + ' / ' + Math.max(1, Math.ceil(entries.length / PAGE_SIZE)) + '. oldal';
    $('vin-history-prev').disabled = dialogPage === 0; $('vin-history-next').disabled = (dialogPage + 1) * PAGE_SIZE >= entries.length;
  }
  function showAll(query) {
    const state = context(); returnInput = active?.input || returnInput; dialogExclude = state.noteId; dialogQuery = query; dialogPage = 0;
    close(); renderDialog(); $('vin-history-dialog').showModal();
  }
  function renderPanel(input, row) {
    if (!input.isConnected || document.activeElement !== input && !active?.panel.contains(document.activeElement)) return;
    close();
    const panel = element('section', 'vin-history-panel'); panel.id = 'vin-history-panel-' + ++sequence; panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', 'Korábbi autó és jegyzetei');
    const state = context(), groups = Model.find(state.notes, input.value, state.noteId);
    active = { input, panel, timer: null }; row.append(panel); input.setAttribute('aria-controls', panel.id); input.setAttribute('aria-expanded', 'true');
    const heading = element('div', 'vin-history-panel-heading');
    heading.append(element('strong', '', groups.some(group => group.exact) ? '✓ Korábban rögzített autó' : groups.length ? 'Találatok az alvázszám részletére' : 'Nincs korábbi találat'));
    const dismiss = button('×', close, 'vin-history-dismiss'); dismiss.setAttribute('aria-label', 'Alvázszám-találatok bezárása'); heading.append(dismiss); panel.append(heading);
    const status = element('p', 'vin-history-count', groups.length ? 'Saját jegyzetek · ' + groups.length + ' autó · ' + groups.reduce((sum, group) => sum + group.entries.length, 0) + ' korábbi bejegyzés' : 'A saját jegyzetekben még nincs másik bejegyzés ehhez az alvázszámhoz.'); status.setAttribute('role', 'status'); panel.append(status);
    for (const group of groups.slice(0, 3)) {
      const section = element('section', 'vin-history-group');
      section.append(element('h4', '', [...group.brands, group.vin].join(' · ')), element('p', 'vin-history-owners', (group.multipleOwners ? 'Korábbi ügyfelek: ' : 'Ügyfél: ') + group.owners.join(' · ')));
      for (const entry of group.entries.slice(0, groups.length === 1 ? 3 : 1)) section.append(historyRow(entry));
      const actions = element('div', 'vin-history-actions'); actions.append(button('Összes előzmény (' + group.entries.length + ')', () => showAll(group.vin), 'primary'));
      actions.append(button(group.multipleOwners ? 'Új jegyzet – ügyfél kiválasztása' : 'Új jegyzet mára ehhez az autóhoz', () => group.multipleOwners ? showAll(group.vin) : void newNote(group.entries[0])));
      section.append(actions); panel.append(section);
    }
    if (groups.length > 3) panel.append(button('Összes találat (' + groups.length + ' autó)', () => showAll(input.value), 'vin-history-more'));
  }
  function attach(input, row) {
    input.autocomplete = 'off'; input.setAttribute('aria-expanded', 'false'); input.setAttribute('aria-describedby', 'vin-history-help');
    const update = immediate => {
      close();
      if (Model.key(input.value).length < Model.MIN_LENGTH) return;
      const panel = document.createElement('section'); active = { input, panel, timer: setTimeout(() => renderPanel(input, row), immediate ? 0 : 160) };
    };
    input.addEventListener('focus', () => { if (suppressed.has(input)) { suppressed.delete(input); return; } update(true); });
    input.addEventListener('input', () => update(false));
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape' && active?.input === input) { event.preventDefault(); event.stopPropagation(); close(); }
      if (event.key === 'ArrowDown' && active?.input === input && active.panel.isConnected) { event.preventDefault(); (active.panel.querySelector('.vin-history-row-actions button') || active.panel.querySelector('button'))?.focus(); }
    });
    row.addEventListener('focusout', () => setTimeout(() => { if (active?.input === input && !row.contains(document.activeElement)) close(); }, 0));
  }
  document.addEventListener('pointerdown', event => { if (active && !active.input.contains(event.target) && !active.panel.contains(event.target)) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && active) { const input = active.input; close(); suppressed.add(input); input.focus(); event.preventDefault(); event.stopPropagation(); } });
  $('vin-history-close').onclick = closeDialog;
  $('vin-history-dialog').addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
  $('vin-history-prev').onclick = () => { dialogPage--; renderDialog(); };
  $('vin-history-next').onclick = () => { dialogPage++; renderDialog(); };
  window.VinHistoryUI = { attach, close };
})();
