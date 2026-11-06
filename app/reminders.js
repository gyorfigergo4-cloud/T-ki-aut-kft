(function (root) {
  const iso = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
  function validate(rows) {
    if (rows === undefined) return;
    if (!Array.isArray(rows) || rows.length > 1000) throw new Error('Érvénytelen emlékeztetőlista');
    const ids = new Set();
    for (const row of rows) {
      if (!row || typeof row.id !== 'string' || !row.id || row.id.length > 200 || ids.has(row.id) || typeof row.text !== 'string' || !row.text.trim() || row.text.length > 1000 || typeof row.done !== 'boolean' || !iso(row.createdAt)) throw new Error('Ellenőrizd az emlékeztető szövegét.');
      for (const field of ['dueAt', 'snoozedUntil']) if (row[field] !== undefined && !iso(row[field])) throw new Error('Érvénytelen ébresztési időpont.');
      if (row.snoozedUntil !== undefined && row.dueAt === undefined) throw new Error('Szundihoz előbb állíts be ébresztési időt.');
      ids.add(row.id);
    }
  }
  function entries(notes) {
    return notes.flatMap(note => (note.reminders || []).map(reminder => ({ noteId: note.id, title: note.title || 'Új név', day: note.day || '', reminder })))
      .sort((a, b) => Number(a.reminder.done) - Number(b.reminder.done) || a.reminder.createdAt.localeCompare(b.reminder.createdAt));
  }
  function alarmTime(reminder) { return reminder.snoozedUntil || reminder.dueAt; }
  function due(notes, now = Date.now()) { return entries(notes).filter(e => !e.reminder.done && alarmTime(e.reminder) && Date.parse(alarmTime(e.reminder)) <= now).sort((a,b) => Date.parse(alarmTime(a.reminder)) - Date.parse(alarmTime(b.reminder))); }
  function snooze(reminder, now = Date.now()) {
    if (!reminder.dueAt || reminder.done || !Number.isFinite(now)) throw new Error('Csak nyitott, időzített emlékeztető szundizható.');
    const next = { ...reminder, snoozedUntil: new Date(now + 5 * 60 * 1000).toISOString() }; validate([next]); return next;
  }
  function localInput(isoDate) {
    if (!isoDate) return ''; const d = new Date(isoDate), pad = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function parseLocal(value) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Adj meg pontos dátumot és időt az ébresztőhöz.');
    const date = new Date(value); if (!Number.isFinite(date.getTime()) || localInput(date.toISOString()) !== value) throw new Error('Ez a helyi időpont nem érvényes.'); return date.toISOString();
  }
  const api = { validate, entries, alarmTime, due, snooze, localInput, parseLocal };
  if (typeof module !== 'undefined') module.exports = api; else root.NoteReminders = api;
})(globalThis);
