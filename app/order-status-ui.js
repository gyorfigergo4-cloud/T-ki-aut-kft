(function (root) {
 function create(item, rowLabel, onToggle) {
  const cell = document.createElement('td'); cell.className = 'item-order-cell';
  const label = document.createElement('label'); label.className = 'item-order-toggle';
  const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.field = 'ordered'; input.setAttribute('aria-label', 'Megrendelve – ' + rowLabel);
  const text = document.createElement('span'), time = document.createElement('time'); time.className = 'item-order-time';
  label.append(input, text); cell.append(label, time);
  function refresh() {
   const status = root.LineItems.order(item); input.checked = status.ordered;
   input.disabled = !status.ordered && !item.partNumber.trim() && !item.description?.trim();
   label.title = input.disabled ? 'Előbb add meg a cikkszámot vagy a megnevezést.' : 'Jelöld, ha ezt a tételt már megrendelted.';
   text.textContent = status.ordered ? 'Megrendelve' : 'Nincs jelölve'; cell.classList.toggle('is-ordered', status.ordered);
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
