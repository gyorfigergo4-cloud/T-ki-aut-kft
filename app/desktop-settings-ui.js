(function () {
  const $ = id => document.getElementById(id), api = window.notesAPI;
  let busy = false, available = { startupSupported: false, trayAvailable: false };
  function controls() {
    $('desktop-startup').disabled = busy || !available.startupSupported;
    $('desktop-close-to-tray').disabled = busy || !available.trayAvailable;
    $('desktop-settings-save').disabled = busy;
    $('desktop-settings-cancel').disabled = busy;
  }
  function fill(state) {
    available = state; $('desktop-startup').checked = state.openAtLogin; $('desktop-close-to-tray').checked = state.closeToTray;
    $('desktop-settings-notice').textContent = state.notice || (!state.startupSupported ? 'Az automatikus indítás a Windowsra készült programban állítható be.' : ''); controls();
  }
  async function open() {
    if (busy || document.body.inert || !api.loadDesktopSettings) return;
    busy = true;
    try {
      const state = await api.loadDesktopSettings(); if (!state.ok) throw new Error(state.error || 'A beállítások nem olvashatók.');
      fill(state); $('desktop-settings-error').textContent = '';
      if (!$('desktop-settings-dialog').open) $('desktop-settings-dialog').showModal();
    } catch (error) { window.NoteReviewUI.showError(error.message || 'A beállítások nem olvashatók.'); }
    finally { busy = false; controls(); }
  }
  $('desktop-settings-open').disabled = !api.loadDesktopSettings;
  $('desktop-settings-open').onclick = () => void open();
  api.onDesktopSettingsRequested?.(() => void open());
  $('desktop-settings-cancel').onclick = () => { if (!busy) $('desktop-settings-dialog').close(); };
  $('desktop-settings-dialog').addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  $('desktop-settings-form').onsubmit = async event => {
    event.preventDefault(); if (busy) return; busy = true; controls(); $('desktop-settings-error').textContent = '';
    try {
      const state = await api.saveDesktopSettings({ openAtLogin: $('desktop-startup').checked, closeToTray: $('desktop-close-to-tray').checked });
      if (!state.ok) throw new Error(state.error || 'A beállítások mentése nem sikerült.');
      fill(state); $('desktop-settings-dialog').close();
    } catch (error) { $('desktop-settings-error').textContent = error.message || 'A beállítások mentése nem sikerült.'; }
    finally { busy = false; controls(); }
  };
})();
