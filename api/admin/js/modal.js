const dialog    = () => document.getElementById('modal');
const titleEl   = () => document.getElementById('modal-title');
const bodyEl    = () => document.getElementById('modal-body');
const saveBtn   = () => document.getElementById('modalSave');
const cancelBtn = () => document.getElementById('modalCancel');
const closeBtn  = () => document.getElementById('modalClose');

let _onSave = null;

function close() {
  dialog().close();
  _onSave = null;
}

export function openModal({ title, body, saveLabel = 'Save', onSave, danger = false }) {
  titleEl().textContent  = title;
  bodyEl().innerHTML     = body;
  saveBtn().textContent  = saveLabel;
  saveBtn().className    = danger ? 'btn-danger' : 'btn-primary';
  _onSave = onSave;
  dialog().showModal();
}

export function closeModal() { close(); }

// Wire up persistent close handlers (call once on app init)
export function initModal() {
  closeBtn().addEventListener('click', close);
  cancelBtn().addEventListener('click', close);
  dialog().addEventListener('click', (e) => {
    if (e.target === dialog()) close();   // click backdrop
  });
  saveBtn().addEventListener('click', async () => {
    if (!_onSave) return;
    saveBtn().disabled = true;
    saveBtn().textContent = 'Saving…';
    try {
      const result = await _onSave();
      if (result !== false) close();     // false = keep modal open (validation)
    } finally {
      saveBtn().disabled = false;
      saveBtn().textContent = saveBtn().dataset.label || 'Save';
    }
  });
}

// Helper: read a form inside the modal body
export function getFormData(fields) {
  return Object.fromEntries(
    fields.map(f => {
      const el = bodyEl().querySelector(`[name="${f}"]`);
      const val = el ? el.value.trim() : '';
      return [f, val === '' ? null : val];
    })
  );
}
