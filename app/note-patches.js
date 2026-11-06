// Local note updates only. This module never selects a file or network destination.
const { validate } = require('./store');
function apply(existing, patch) {
  if (!patch || Object.keys(patch).some(k => !['upserts','removed'].includes(k)) || !Array.isArray(patch.upserts) || !Array.isArray(patch.removed)) throw new Error('Érvénytelen jegyzetmódosítás.');
  validate(patch.upserts);
  const ids = new Set(); for (const note of existing) { if (ids.has(note.id)) throw new Error('Ismétlődő jegyzetazonosító; az eredeti fájl megmaradt.'); ids.add(note.id); }
  const changed = new Map(); for (const note of patch.upserts) { if (!note.id || changed.has(note.id)) throw new Error('Hibás módosított jegyzetazonosító.'); changed.set(note.id,note); }
  const removed = new Set(); for (const id of patch.removed) { if (typeof id!=='string' || !id || removed.has(id) || changed.has(id)) throw new Error('Hibás törölt jegyzetazonosító.'); removed.add(id); }
  const result = [...patch.upserts.filter(n=>!ids.has(n.id)), ...existing.filter(n=>!removed.has(n.id)).map(n=>changed.get(n.id)||n)];
  validate(result); return result;
}
module.exports = { apply };
