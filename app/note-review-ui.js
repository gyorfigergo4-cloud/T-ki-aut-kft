(function () {
  const $ = id => document.getElementById(id), dialog = $('note-review-dialog');
  let resolveReview = null, previousFocus = null;
  function finish(accepted) {
    const resolve = resolveReview; if (!resolve) return;
    resolveReview = null; dialog.close();
    if (!accepted) {
      const focus = previousFocus?.matches('input,textarea,select') && previousFocus.isConnected ? previousFocus : document.body.dataset.section === 'workorders' ? $('wo-customer') : $('title');
      focus?.focus();
    }
    resolve(accepted);
  }
  $('note-review-back').onclick = () => finish(false);
  $('note-review-confirm').onclick = () => finish(true);
  dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); });
  // A previous close event can arrive after the next confirmation has opened.
  dialog.addEventListener('close', () => { if (!dialog.open) finish(false); });
  window.NoteReviewUI = {
    confirm(request) {
      if (resolveReview) return false;
      $('note-review-customer').textContent = request.title;
      $('note-review-tasks').replaceChildren();
      for (const text of request.pending) { const li = document.createElement('li'); li.textContent = text; $('note-review-tasks').append(li); }
      $('note-review-pending').hidden = !request.pending.length;
      previousFocus = document.activeElement;
      return new Promise(resolve => { resolveReview = resolve; dialog.showModal(); $('note-review-back').focus(); });
    },
    showError(message) { $('app-close-error-text').textContent = message; $('app-close-error').showModal(); $('app-close-error-ok').focus(); }
  };
  $('app-close-error-ok').onclick = () => $('app-close-error').close();
})();
