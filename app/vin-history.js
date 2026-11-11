(function (root) {
  'use strict';
  const Vehicles = typeof module !== 'undefined' ? require('./vehicles') : root.NoteVehicles;
  const Items = typeof module !== 'undefined' ? require('./items') : root.LineItems;
  const MIN_LENGTH = 6;
  const key = value => String(value || '').toUpperCase().replace(/[\s-]+/g, '');
  const ownerKey = entry => entry.title.trim().toLocaleLowerCase('hu') + '\n' + entry.phone.replace(/[\s()-]+/g, '');
  function summary(note, vehicle) {
    const items = (note.items || []).filter(item => (item.vehicleId || '') === vehicle.id && Items.isActive(item));
    return [vehicle.oil, ...items.map(item => item.description), note.body, ...items.map(item => item.partNumber)]
      .filter(value => typeof value === 'string' && value.trim()).map(value => value.trim().replace(/\s+/g, ' ')).join(' · ').slice(0, 180) || 'Korábbi bejegyzés';
  }
  function find(notes, query, excludeNoteId) {
    const needle = key(query);
    if (needle.length < MIN_LENGTH) return [];
    const groups = new Map();
    for (const note of notes) {
      if (note.id === excludeNoteId) continue;
      for (const vehicle of Vehicles.get(note)) {
        const normalized = key(vehicle.vin);
        if (!normalized || !normalized.includes(needle)) continue;
        if (!groups.has(normalized)) groups.set(normalized, { key: normalized, vin: vehicle.vin.trim(), brands: [], entries: [], exact: normalized === needle });
        const group = groups.get(normalized);
        if (vehicle.brand.trim() && !group.brands.includes(vehicle.brand.trim())) group.brands.push(vehicle.brand.trim());
        group.entries.push({ noteId: note.id, vehicleId: vehicle.id, day: note.day || '', updated: note.updated || '', title: note.title || 'Név nélkül', phone: note.phone || '', summary: summary(note, vehicle) });
      }
    }
    for (const group of groups.values()) {
      group.entries.sort((a, b) => b.day.localeCompare(a.day) || b.updated.localeCompare(a.updated) || a.noteId.localeCompare(b.noteId));
      group.owners = [...new Set(group.entries.map(entry => entry.title))];
      group.multipleOwners = new Set(group.entries.map(ownerKey)).size > 1;
    }
    return [...groups.values()].sort((a, b) => Number(b.exact) - Number(a.exact) || b.entries[0].day.localeCompare(a.entries[0].day) || a.key.localeCompare(b.key));
  }
  const api = { MIN_LENGTH, key, find };
  if (typeof module !== 'undefined') module.exports = api; else root.VinHistory = api;
})(globalThis);
