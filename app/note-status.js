(function (root) {
 const all = Object.freeze([
  Object.freeze({ id: 'ordered', label: 'Megrendelve' }),
  Object.freeze({ id: 'quote', label: 'Ajánlat' }),
  Object.freeze({ id: 'unfinished', label: 'Félbehagyott' }),
  Object.freeze({ id: 'written', label: 'Felírva' })
 ]);
 function validate(value) {
  if (value !== undefined && !all.some(status => status.id === value)) throw new Error('Érvénytelen bejegyzésállapot');
 }
 function get(note) { validate(note.workflowStatus); return all.find(status => status.id === (note.workflowStatus ?? 'written')); }
 const api = { all, validate, get, defaultId: 'written' };
 if (typeof module !== 'undefined') module.exports = api; else root.NoteStatuses = api;
})(globalThis);
