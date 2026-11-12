(function () {
  const $ = id => document.getElementById(id), opener = $('settings-menu-open'), panel = $('settings-menu');
  function close(restoreFocus = false) {
    if (panel.hidden) return;
    panel.hidden = true; opener.setAttribute('aria-expanded', 'false');
    if (restoreFocus) opener.focus();
  }
  opener.onclick = () => {
    if (!panel.hidden) { close(true); return; }
    panel.hidden = false; opener.setAttribute('aria-expanded', 'true'); $('settings-menu-close').focus();
  };
  $('settings-menu-close').onclick = () => close(true);
  // Close before the existing action opens a modal or native file chooser.
  // Keep the original buttons and handlers so their current context is kept.
  panel.addEventListener('click', event => {
    if (event.target.closest('.settings-menu-actions button')) close();
  }, true);
  document.addEventListener('pointerdown', event => {
    if (!panel.hidden && !panel.contains(event.target) && !opener.contains(event.target)) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); event.stopPropagation(); close(true); }
  });
  document.addEventListener('focusin', event => {
    if (!panel.hidden && !panel.contains(event.target) && event.target !== opener) close();
  });
  for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('close', () => {
    if (document.activeElement === document.body || panel.contains(document.activeElement)) opener.focus();
  });
})();
