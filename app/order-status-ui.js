(function (root) {
 function create(item, rowLabel, onToggle, onPaidToggle) {
  const cell = document.createElement('td'); cell.className = 'item-order-cell';
  const label = document.createElement('label'); label.className = 'item-order-toggle';
  const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.field = 'ordered'; input.setAttribute('aria-label', 'Megrendelve – ' + rowLabel);
  const text = document.createElement('span'), time = document.createElement('time'); time.className = 'item-order-time';
  label.append(input, text); cell.append(label, time);
  let paidInput;
  if (onPaidToggle) {
   const paidLabel = document.createElement('label'); paidLabel.className = 'payment-toggle item-paid-toggle';
   paidInput = document.createElement('input'); paidInput.type = 'checkbox'; paidInput.dataset.field = 'paid'; paidInput.setAttribute('aria-label', 'Fizetve – ' + rowLabel);
   const paidText = document.createElement('span'); paidText.textContent = 'Fizetve'; paidLabel.append(paidInput, paidText); cell.append(paidLabel);
   paidInput.onchange = () => { onPaidToggle(paidInput.checked); refresh(); };
  }
  function refresh() {
   const status = root.LineItems.order(item); input.checked = status.ordered;
   if (paidInput) { paidInput.checked = item.paid === true; paidInput.disabled = !item.paid && !root.LineItems.isActive(item); }
   input.disabled = !status.ordered && !item.partNumber.trim() && !item.description?.trim();
   label.title = input.disabled ? 'Előbb add meg a cikkszámot vagy a megnevezést.' : 'Jelöld, ha ezt a tételt már megrendelted.';
   text.textContent = status.ordered ? 'Megrendelve' : 'Nincs megrendelve'; cell.classList.toggle('is-ordered', status.ordered);
   time.hidden = !status.ordered;
   if (status.orderedAt) {
    time.dateTime = status.orderedAt; time.textContent = new Intl.DateTimeFormat('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(status.orderedAt));
    time.title = 'Jelölés időpontja: ' + new Date(status.orderedAt).toLocaleString('hu-HU');
   } else { time.removeAttribute('datetime'); time.textContent = status.ordered ? 'Korábbi jelölés' : ''; time.title = status.ordered ? 'A korábbi jelöléshez nincs megadva időpont.' : ''; }
  }
  input.onchange = () => { onToggle(input.checked); refresh(); };
  refresh(); return { cell, refresh };
 }
 root.ItemOrderUI = { create };
})(globalThis);
