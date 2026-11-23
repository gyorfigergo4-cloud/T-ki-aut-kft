(() => {
  const api = window.notesAPI;
  const el = id => document.getElementById(id);
  const dialog = el('partners-dialog');
  const editor = el('partner-edit');
  const importer = el('partners-import');
  const add = el('partners-add');
  const preview = el('partners-preview');
  const importSave = el('partners-import-save');
  let snapshot, editSnapshot, editId, importRevision, loading;
  let previewing = false, editing = false, importing = false;

  function cell(row, value) {
    const td = row.insertCell();
    td.textContent = value;
    return td;
  }

  function render() {
    const body = el('partners-list');
    body.replaceChildren();
    if (!snapshot) return;
    const query = el('partners-search').value.trim().toLocaleLowerCase('hu');
    const digits = query.replace(/\D/g, '');
    const rows = snapshot.people.filter(({ name, phone }) =>
      name.toLocaleLowerCase('hu').includes(query) ||
      phone.includes(query) ||
      (/^[+\d(). /-]+$/.test(query) && digits && phone.replace(/\D/g, '').includes(digits)));
    rows.sort((a, b) => a.name.localeCompare(b.name, 'hu'));
    for (const person of rows) {
      const row = body.insertRow();
      cell(row, person.name);
      cell(row, person.phone);
      cell(row, person.discountPercent === undefined ? '—' : person.discountPercent + '%');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Szerkesztés';
      button.setAttribute('aria-label', person.name + ' szerkesztése');
      button.onclick = () => openEditor(person);
      cell(row, '').append(button);
    }
    if (!rows.length) cell(body.insertRow(), query ? 'Nincs találat.' : 'A partnerlista üres.').colSpan = 4;
  }

  async function call(request) {
    const result = await request;
    if (!result.ok) throw Error(result.error);
    return result;
  }

  async function refresh() {
    if (loading || !dialog.open) return;
    loading = true;
    const previous = snapshot;
    try {
      snapshot = await call(api.loadPartners());
      el('partners-mode').textContent = snapshot.mode === 'local'
        ? 'Helyi partnerlista · A közös listához állítsd be a kapcsolatot az Autónyilvántartóban.'
        : 'Közös partnerlista · A központhoz kapcsolódó gépeken érhető el.';
      el('partners-error').textContent = '';
    } catch (error) {
      snapshot = undefined;
      el('partners-error').textContent = error.message;
    } finally {
      loading = false;
      add.disabled = !snapshot;
      preview.disabled = !snapshot || previewing;
      if (snapshot?.revision !== previous?.revision) render();
    }
  }

  function openEditor(person) {
    if (!snapshot) return;
    editSnapshot = snapshot;
    editId = person?.id;
    el('partner-edit-heading').textContent = editId ? 'Partner szerkesztése' : 'Új partner';
    el('partner-name').value = person?.name || '';
    el('partner-phone').value = person?.phone || '';
    el('partner-discount').value = person?.discountPercent?.replace(',', '.') ?? '';
    el('partner-delete').hidden = !editId;
    el('partner-edit-error').textContent = '';
    editor.showModal();
  }

  async function saveEdit(deleting) {
    if (editing) return;
    const people = editSnapshot.people.filter(person => person.id !== editId);
    const discount = el('partner-discount').value;
    if (!deleting) people.push({
      id: editId || crypto.randomUUID(),
      name: el('partner-name').value.trim(),
      phone: el('partner-phone').value.trim(),
      ...(discount === '' ? {} : { discountPercent: discount })
    });
    editing = true;
    try {
      await call(api.savePartners({ people, revision: editSnapshot.revision }));
      editor.close();
      el('partners-status').textContent = deleting ? 'A partner törölve.' : 'A partner mentve.';
      await refresh();
    } catch (error) {
      el('partner-edit-error').textContent = error.message;
    } finally {
      editing = false;
    }
  }

  async function openImport() {
    if (previewing) return;
    previewing = preview.disabled = true;
    try {
      const { rows, missingName, missingPhone, invalidPhone, duplicates, revision } = await call(api.previewPartners());
      if (!dialog.open) return;
      importRevision = revision;
      el('partners-import-error').textContent = '';
      el('partners-import-summary').textContent =
        `Átvehető: ${rows.length}. Ismétlődés: ${duplicates}. Telefonszám nélkül: ${missingPhone}. Hibás telefonszámmező: ${invalidPhone}. Érvényes név nélkül: ${missingName}.`;
      const body = el('partners-import-rows');
      body.replaceChildren();
      for (const person of rows) {
        const row = body.insertRow();
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !person.possibleDuplicate && !person.fromText;
        checkbox.setAttribute('aria-label', person.name + ' ' + person.phone + ' átvétele');
        cell(row, '').append(checkbox);
        cell(row, person.name);
        cell(row, person.phone);
        cell(row, [person.fromText && 'Jegyzetszövegből', person.possibleDuplicate && 'Lehetséges ismétlődés'].filter(Boolean).join(' · '));
      }
      const selected = () => [...body.querySelectorAll('input')].flatMap((input, index) =>
        input.checked ? [{ name: rows[index].name, phone: rows[index].phone }] : []);
      body.onchange = () => { importSave.disabled = importing || !body.querySelector('input:checked'); };
      body.onchange();
      importSave.onclick = async () => {
        if (importing) return;
        importing = importSave.disabled = true;
        try {
          const { added } = await call(api.importPartners({ rows: selected(), revision: importRevision }));
          importer.close();
          el('partners-status').textContent = `Átvett partnerek száma: ${added}.`;
          await refresh();
        } catch (error) {
          el('partners-import-error').textContent = error.message;
        } finally {
          importing = false;
          body.onchange();
        }
      };
      importer.showModal();
    } catch (error) {
      el('partners-error').textContent = error.message;
    } finally {
      previewing = false;
      preview.disabled = !snapshot;
    }
  }

  el('partners-open').onclick = () => {
    el('partners-status').textContent = '';
    dialog.showModal();
    void refresh();
  };
  el('partners-close').onclick = () => dialog.close();
  el('partners-search').oninput = render;
  add.onclick = () => openEditor();
  preview.onclick = openImport;
  el('partner-cancel').onclick = () => { if (!editing) editor.close(); };
  el('partners-import-cancel').onclick = () => { if (!importing) importer.close(); };
  editor.oncancel = event => { if (editing) event.preventDefault(); };
  importer.oncancel = event => { if (importing) event.preventDefault(); };
  el('partner-form').onsubmit = event => { event.preventDefault(); void saveEdit(false); };
  el('partner-delete').onclick = () => {
    if (!editing && window.confirm('Törlöd ezt a partnert a listából?')) void saveEdit(true);
  };
  setInterval(() => { if (!previewing && !editor.open && !importer.open) void refresh(); }, 3000);
})();
