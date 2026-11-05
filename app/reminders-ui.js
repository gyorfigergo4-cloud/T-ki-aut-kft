(function () {
  const $ = id => document.getElementById(id), Model = window.NoteReminders;
  const context = () => window.ReminderContext();
  let editingNoteId = null, editingId = null, returnFilter = null;
  function change(noteId, transform) {
    try { return window.ReminderChange(noteId, transform); }
    catch (error) { $('reminders-error').textContent = error.message; return false; }
  }
  function edit(noteId, reminder) {
    const note = context().notes.find(note => note.id === noteId); if (!note) return;
    returnFilter = $('reminders-dialog').open ? $('reminders-filter').value : null;
    if ($('reminders-dialog').open) $('reminders-dialog').close();
    editingNoteId = noteId; editingId = reminder?.id || null;
    $('reminder-edit-title').textContent = reminder ? 'Emlékeztető szerkesztése' : 'Új emlékeztető';
    $('reminder-customer').textContent = note.title || 'Új név';
    $('reminder-text').value = reminder?.text || ''; $('reminder-preset').value = '';
    $('reminder-edit-error').textContent = ''; $('reminder-edit').showModal(); $('reminder-text').focus();
  }
  function finishEdit() {
    $('reminder-edit').close();
    if (returnFilter) open(returnFilter);
    returnFilter = null;
  }
  function row(entry, global) {
    const reminder = entry.reminder, item = document.createElement('div'); item.className = 'reminder-row' + (reminder.done ? ' is-done' : ''); item.dataset.reminderId = reminder.id; item.dataset.noteId = entry.noteId;
    const label = document.createElement('label'); label.className = 'reminder-check';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = reminder.done; checkbox.setAttribute('aria-label', 'Kész: ' + reminder.text);
    const checkText = document.createElement('span'); checkText.textContent = 'Kész'; label.append(checkbox, checkText);
    checkbox.onchange = () => { if (!change(entry.noteId, rows => rows.map(r => r.id === reminder.id ? { ...r, done: checkbox.checked } : r))) render(); };
    const content = document.createElement('div'); content.className = 'reminder-content';
    const text = document.createElement('button'); text.type = 'button'; text.className = 'reminder-text'; text.textContent = reminder.text; text.title = 'Emlékeztető szerkesztése'; text.onclick = () => edit(entry.noteId, reminder);
    const detail = document.createElement('small'); detail.textContent = (global ? entry.title + (entry.day ? ' · ' + entry.day : '') + ' · ' : '') + (reminder.done ? 'Kész' : 'Nyitott teendő'); content.append(text, detail);
    const actions = document.createElement('div'); actions.className = 'reminder-actions';
    if (global) {
      const go = document.createElement('button'); go.type = 'button'; go.textContent = 'Jegyzet megnyitása';
      go.onclick = async () => { if (await window.ReminderOpenNote(entry.noteId)) $('reminders-dialog').close(); }; actions.append(go);
    }
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'reminder-remove'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Emlékeztető törlése: ' + reminder.text); remove.onclick = () => change(entry.noteId, rows => rows.filter(r => r.id !== reminder.id)); actions.append(remove);
    item.append(label, content, actions); return item;
  }
  function render() {
    const data = context(), entries = Model.entries(data.notes), pending = entries.filter(entry => !entry.reminder.done);
    $('reminders-open').disabled = !data.loaded; $('reminders-count').textContent = String(pending.length);
    $('reminders-open').title = pending.length + ' nyitott emlékeztető';
    $('reminder-add').disabled = !data.note; $('note-reminders').replaceChildren();
    for (const entry of entries.filter(entry => entry.noteId === data.note?.id)) $('note-reminders').append(row(entry, false));
    $('reminders-summary').textContent = pending.length + ' nyitott teendő';
    if ($('reminders-dialog').open) {
      const filter = $('reminders-filter').value, visible = entries.filter(entry => filter === 'done' ? entry.reminder.done : !entry.reminder.done);
      $('reminders-list').replaceChildren();
      for (const entry of visible) $('reminders-list').append(row(entry, true));
      if (!visible.length) { const message = document.createElement('p'); message.className = 'reminders-empty'; message.textContent = filter === 'done' ? 'Még nincs készre jelölt emlékeztető.' : 'Nincs nyitott teendő. A jegyzeteknél adhatsz hozzá új emlékeztetőt.'; $('reminders-list').append(message); }
    }
  }
  function open(filter = 'pending') {
    $('reminders-filter').value = filter; $('reminders-error').textContent = '';
    if (!$('reminders-dialog').open) $('reminders-dialog').showModal(); render();
  }
  $('reminder-add').onclick = () => { const note = context().note; if (note) edit(note.id); };
  $('reminders-open').onclick = () => open();
  $('reminders-close').onclick = () => $('reminders-dialog').close();
  $('reminders-filter').onchange = render;
  $('reminder-preset').onchange = () => { if ($('reminder-preset').value) $('reminder-text').value = $('reminder-preset').value; };
  $('reminder-cancel').onclick = finishEdit;
  $('reminder-edit').addEventListener('cancel', event => { event.preventDefault(); finishEdit(); });
  $('reminder-form').onsubmit = event => {
    event.preventDefault(); $('reminder-edit-error').textContent = '';
    try {
      const text = $('reminder-text').value.trim();
      const changed = window.ReminderChange(editingNoteId, rows => {
        const previous = rows.find(r => r.id === editingId);
        const reminder = previous ? { ...previous, text } : { id: crypto.randomUUID(), text, done: false, createdAt: new Date().toISOString() };
        Model.validate([reminder]); return previous ? rows.map(r => r.id === previous.id ? reminder : r) : [...rows, reminder];
      });
      if (!changed) throw new Error('Előbb javítsd a jegyzet megjelölt mezőjét, majd mentsd az emlékeztetőt.');
      finishEdit();
    } catch (error) { $('reminder-edit-error').textContent = error.message; }
  };
  window.RemindersUI = { render };
  render();
})();
