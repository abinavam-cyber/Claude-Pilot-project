import { api }                      from '../api.js';
import { fmtDate, loading, empty, apiError } from '../utils.js';
import { openModal, getFormData }   from '../modal.js';
import { toast }                    from '../toast.js';

let data = [];

export async function mount(el) {
  el.innerHTML = loading();
  await load(el);
}

async function load(el) {
  try {
    data = await api.sections.list();
    render(el);
  } catch (err) {
    el.innerHTML = apiError(err);
  }
}

function render(el) {
  el.innerHTML = `
    <div class="view-header">
      <h2>Sections <span style="font-weight:400;color:var(--muted);font-size:0.85rem">(${data.length})</span></h2>
      <button class="btn-primary" id="addSection">+ Add Section</button>
    </div>

    ${data.length === 0 ? empty('No sections yet.') : `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>ID</th><th>Name</th><th>Description</th><th>Created</th><th style="text-align:right">Actions</th></tr>
        </thead>
        <tbody>
          ${data.map(s => `
            <tr>
              <td style="color:var(--muted)">#${s.id}</td>
              <td><strong>${s.name}</strong></td>
              <td style="color:var(--muted)">${s.description || '—'}</td>
              <td style="color:var(--muted)">${fmtDate(s.created_at)}</td>
              <td class="actions">
                <button class="btn-sm edit"   data-id="${s.id}" data-action="edit">Edit</button>
                <button class="btn-sm delete" data-id="${s.id}" data-action="delete">Delete</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`}
  `;

  el.querySelector('#addSection').onclick = () => openSectionModal(el);
  el.querySelectorAll('[data-action="edit"]').forEach(btn => {
    const sec = data.find(s => s.id == btn.dataset.id);
    btn.addEventListener('click', () => openSectionModal(el, sec));
  });
  el.querySelectorAll('[data-action="delete"]').forEach(btn =>
    btn.addEventListener('click', () => confirmDelete(el, btn.dataset.id))
  );
}

function openSectionModal(el, sec = null) {
  const isEdit = !!sec;
  openModal({
    title: isEdit ? `Edit Section — ${sec.name}` : 'Add Section',
    body: `
      <div class="field">
        <label>Section Name *</label>
        <input name="name" value="${sec?.name || ''}" placeholder="e.g. Europe" required />
      </div>
      <div class="field">
        <label>Description</label>
        <textarea name="description" placeholder="Optional description…">${sec?.description || ''}</textarea>
      </div>`,
    saveLabel: isEdit ? 'Update' : 'Create',
    onSave: async () => {
      const body = getFormData(['name', 'description']);
      if (!body.name) { toast('Section name is required.', 'error'); return false; }
      try {
        if (isEdit) {
          await api.sections.update(sec.id, body);
          toast('Section updated.', 'success');
        } else {
          await api.sections.create(body);
          toast('Section created.', 'success');
        }
        await load(el);
      } catch (err) {
        toast(err.message || 'Save failed.', 'error');
        return false;
      }
    },
  });
}

function confirmDelete(el, id) {
  const sec = data.find(s => s.id == id);
  openModal({
    title: 'Delete Section',
    body: `<div class="confirm-box">
      <div class="warning">🗑️</div>
      <p>Delete section <strong>${sec?.name}</strong>?<br>
      <span style="font-size:0.8rem;color:var(--red)">This will fail if categories exist under it.</span></p>
    </div>`,
    saveLabel: 'Delete', danger: true,
    onSave: async () => {
      try {
        await api.sections.delete(id);
        toast('Section deleted.', 'success');
        await load(el);
      } catch (err) {
        toast(err.message || 'Delete failed.', 'error');
        return false;
      }
    },
  });
}
