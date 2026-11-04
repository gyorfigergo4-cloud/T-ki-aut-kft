(function (root) {
  const lineItems = typeof module !== 'undefined' ? require('./items') : root.LineItems;
  const noteStatuses = typeof module !== 'undefined' ? require('./note-status') : root.NoteStatuses;
  const defaultYears = [2024, 2025, 2026];
  const months = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'];
  const localDay = value => {
    const date = new Date(value);
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  };
  function validDay(day) {
    return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number(day.slice(0, 4)) >= 1900 && Number.isFinite(Date.parse(day + 'T12:00:00Z')) && new Date(day + 'T12:00:00Z').toISOString().slice(0, 10) === day;
  }
  function validate(archive) {
    if (!archive || !Array.isArray(archive.years) || !Array.isArray(archive.days) || archive.years.some(year => !Number.isInteger(year) || year < 1900 || year > 9999) || archive.days.some(day => !validDay(day))) throw new Error('Sérült archívumadatok');
    return archive;
  }
  function normalize(data, archive) {
    validate(archive);
    const notes = data.map(note => lineItems.normalizeNote({
      ...note, workflowStatus: noteStatuses.get(note).id, vin: note.vin ?? '', part: note.part ?? '', oil: note.oil ?? '', fullPrice: note.fullPrice ?? '', discountPrice: note.discountPrice ?? '',
      created: note.created ?? note.updated, day: note.day ?? localDay(note.created ?? note.updated)
    }));
    if (notes.some(note => !validDay(note.day))) throw new Error('Érvénytelen bejegyzésdátum');
    const days = [...new Set([...archive.days, ...notes.map(note => note.day)])].sort();
    const years = [...new Set([...defaultYears, ...archive.years, ...days.map(day => Number(day.slice(0, 4)))])].sort((a, b) => a - b);
    return { notes, years, days };
  }
  const api = { defaultYears, months, localDay, validDay, validate, normalize };
  if (typeof module !== 'undefined') module.exports = api;
  else root.NotesArchive = api;
})(globalThis);
