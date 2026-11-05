(function (root) {
  const iso = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
  function validate(rows) {
    if (rows === undefined) return;
    if (!Array.isArray(rows) || rows.length > 1000) throw new Error('Érvénytelen emlékeztetőlista');
    const ids = new Set();
    for (const row of rows) {
      if (!row || typeof row.id !== 'string' || !row.id || row.id.length > 200 || ids.has(row.id) || typeof row.text !== 'string' || !row.text.trim() || row.text.length > 1000 || typeof row.done !== 'boolean' || !iso(row.createdAt)) throw new Error('Ellenőrizd az emlékeztető szövegét.');
      ids.add(row.id);
    }
  }
  function entries(notes) {
    return notes.flatMap(note => (note.reminders || []).map(reminder => ({ noteId: note.id, title: note.title || 'Új név', day: note.day || '', reminder })))
      .sort((a, b) => Number(a.reminder.done) - Number(b.reminder.done) || a.reminder.createdAt.localeCompare(b.reminder.createdAt));
  }
  const api = { validate, entries };
  if (typeof module !== 'undefined') module.exports = api; else root.NoteReminders = api;
})(globalThis);
