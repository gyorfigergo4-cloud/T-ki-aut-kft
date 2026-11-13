(() => {
  'use strict';
  const $ = id => document.getElementById(id), Pricing = window.InventoryPricing;
  const money = value => value === '' || value === null || value === undefined ? 'Nincs ár' : Pricing.formatMoney(value);
  let report, save, selected, defaultsToken, saving = false;

  function card(id, value) {
    const node = $(id); node.replaceChildren();
    if (!value) { node.textContent = 'Ehhez a régi ellenőrzéshez nem rögzült árösszesítés.'; return; }
    const amount = document.createElement('strong');
    amount.textContent = money(value.discountedValue) + (value.missingPrices ? ' · részösszeg' : '');
    const detail = document.createElement('p');
    detail.textContent = 'Teli áron: ' + money(value.fullValue) + ' · Kedvezmény: ' + money(value.savings) +
      (value.missingPrices ? ' · ' + value.missingPrices + ' pozitív készletű tételnél hiányzik az ár.' : '') +
      (value.uncounted ? ' · ' + value.uncounted + ' tétel még nincs számolva.' : '');
    node.append(amount, detail);
  }
  function render(data, command) {
    report = data; save = command;
    const supported = !!data.pricingSettings;
    $('stocktake-pricing-settings').disabled = !supported || !!data.session?.closedAt;
    $('stocktake-values').hidden = !supported;
    $('stocktake-pricing-info').textContent = !supported ? 'Az árazáshoz frissítsd a főgépen futó Töki Autó alkalmazást is.' : data.legacyPricing ?
      'A régi, lezárt ellenőrzéshez nem rögzültek árak. A mai árakból nem készül visszamenőleges összesítés.' :
      data.session?.closedAt ? 'Lezáráskori árak és készletértékek. A későbbi módosítások ezt az ellenőrzést nem írják át.' :
      'A teli ár és az egyedi kedvezmény az Ár / kedvezmény gombbal módosítható. Az összegzés minden terméket figyelembe vesz, a kereséstől és lapozástól függetlenül.';
    if (supported) { card('stocktake-warehouse-value', data.warehouseValuation); card('stocktake-counted-value', data.countedValuation); }
  }
  function append(tr, row, editable) {
    for (const [column, value] of Object.entries({category: InventoryCategories.label(row.category), full: money(row.fullPrice), discount: row.discountPercent === '' || row.discountPercent === undefined ? 'Nem rögzített' : row.discountPercent + '%', unit: money(row.discountedPrice), value: row.quantity === null ? 'Még nincs számolva' : money(row.discountedValue)})) {
      const td = document.createElement('td'); td.textContent = value; td.dataset.column = column; tr.append(td);
    }
    const td = document.createElement('td'); td.dataset.column = 'pricing';
    if (editable && report.pricingSettings && row.pricingVersion) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Ár / kedvezmény';
      button.onclick = () => {
        selected = { ...row, sessionId: report.session.id };
        $('stocktake-price-name').textContent = row.sku + ' · ' + row.name + ' · ' + InventoryCategories.label(row.category);
        $('stocktake-price-full').value = row.fullPrice;
        $('stocktake-price-auto').checked = row.discountOverride === '';
        $('stocktake-price-discount').value = row.discountPercent;
        $('stocktake-price-error').textContent = ''; preview(); $('stocktake-price-dialog').showModal();
      };
      td.append(button);
    }
    tr.append(td);
    const cells = new Map([...tr.children].map(cell => [cell.dataset.column, cell]));
    for (const column of ['sku', 'name', 'full', 'discount', 'unit', 'quantity', 'value', 'pricing', 'correction', 'expected', 'difference', 'current', 'changed', 'operator', 'codes', 'category']) tr.append(cells.get(column));
  }
  function preview() {
    const automatic = $('stocktake-price-auto').checked;
    $('stocktake-price-discount').disabled = automatic;
    if (automatic) $('stocktake-price-discount').value = selected.defaultDiscount;
    try {
      const q = Pricing.quote($('stocktake-price-full').value, $('stocktake-price-discount').value);
      $('stocktake-price-preview').textContent = 'Kedvezményes egységár: ' + money(q.discountedPrice) +
        (selected.quantity === null ? ' · Még nincs számolva.' : ' · Számolt érték (' + selected.quantity + ' db): ' + money(Pricing.line(q.fullPrice, q.discountPercent, selected.quantity)?.discountedValue));
    } catch (e) { $('stocktake-price-preview').textContent = e.message; }
  }
  for (const id of ['stocktake-price-full', 'stocktake-price-discount', 'stocktake-price-auto']) $(id).addEventListener('input', preview);
  $('stocktake-pricing-settings').onclick = () => {
    defaultsToken = JSON.stringify(report.pricingSettings);
    for (const key of Object.keys(Pricing.DEFAULTS)) $('stocktake-default-' + key).value = report.pricingSettings[key];
    $('stocktake-default-error').textContent = ''; $('stocktake-default-dialog').showModal();
  };
  async function submit(dialog, fieldset, error, command) {
    if (saving) return;
    saving = true; $(fieldset).disabled = true; $(error).textContent = 'Mentés…';
    try {
      if (await save(command)) $(dialog).close();
      else $(error).textContent = $('stocktake-status').textContent;
    } catch (e) { $(error).textContent = e.message; }
    finally { saving = false; $(fieldset).disabled = false; if (dialog === 'stocktake-price-dialog') preview(); }
  }
  $('stocktake-price-form').onsubmit = e => {
    e.preventDefault();
    void submit('stocktake-price-dialog', 'stocktake-price-fields', 'stocktake-price-error', {
      type: 'stocktake', action: 'pricing', sessionId: selected.sessionId, productId: selected.productId,
      expectedPricing: selected.pricingVersion, fullPrice: $('stocktake-price-full').value,
      discountPercent: $('stocktake-price-auto').checked ? '' : $('stocktake-price-discount').value
    });
  };
  $('stocktake-default-form').onsubmit = e => {
    e.preventDefault();
    void submit('stocktake-default-dialog', 'stocktake-default-fields', 'stocktake-default-error', {
      type: 'pricing-settings', expectedSettings: defaultsToken,
      settings: Object.fromEntries(Object.keys(Pricing.DEFAULTS).map(key => [key, $('stocktake-default-' + key).value]))
    });
  };
  for (const kind of ['price', 'default']) {
    $('stocktake-' + kind + '-cancel').onclick = () => { if (!saving) $('stocktake-' + kind + '-dialog').close(); };
    $('stocktake-' + kind + '-dialog').addEventListener('cancel', e => { if (saving) e.preventDefault(); });
  }
  window.StocktakePricingUI = { render, append };
})();
