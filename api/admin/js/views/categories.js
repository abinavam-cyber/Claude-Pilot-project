import { api }                          from '../api.js';
import { fmtDate, FREQ_BADGE, loading, empty, apiError } from '../utils.js';
import { openModal, getFormData }       from '../modal.js';
import { toast }                        from '../toast.js';

let state   = { page: 1, limit: 15, total: 0, data: [] };
let filters = { section_id: '', frequency: '' };
let sections = [];

export async function mount(el) {
  el.innerHTML = loading();
  try {
    sections = await api.sections.list();
    await load(el);
  } catch (err) {
    el.innerHTML = apiError(err);
  }
}

async function load(el) {
  try {
    const params = { page: state.page, limit: state.limit, ...filters };
    const res    = await api.categories.list(params);
    state = { ...state, total: res.total, data: res.data };
    render(el);
  } catch (err) {
    el.innerHTML = apiError(err);
  }
}

function render(el) {
  const totalPages = Math.ceil(state.total / state.limit) || 1;
  const sectionName = id => sections.find(s => s.id == id)?.name || `#${id}`;

  el.innerHTML = `
    <div class="view-header">
      <h2>Categories <span style="font-weight:400;color:var(--muted);font-size:0.85rem">(${state.total})</span></h2>
      <button class="btn-primary" id="addCat">+ Add Category</button>
    </div>

    <div class="filters">
      <select id="filterSection">
        <option value="">All Sections</option>
        ${sections.map(s => `<option value="${s.id}" ${filters.section_id == s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
      </select>
      <select id="filterFreq">
        <option value="">All Frequencies</option>
        ${['monthly','annual','one-time','weekly'].map(f =>
          `<option value="${f}" ${filters.frequency === f ? 'selected' : ''}>${f}</option>`
        ).join('')}
      </select>
    </div>

    ${state.data.length === 0 ? empty('No categories match your filters.') : `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th><th>Name</th><th>Section</th><th>Frequency</th>
            <th>Notes</th><th>Updated</th><th style="text-align:right">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${state.data.map(c => `
            <tr>
              <td style="color:var(--muted)">#${c.id}</td>
              <td><strong>${c.name}</strong></td>
              <td><span class="badge badge-gray">${sectionName(c.section_id)}</span></td>
              <td>${FREQ_BADGE[c.frequency] || c.frequency}</td>
              <td style="color:var(--muted)">${c.notes || '—'}</td>
              <td style="color:var(--muted)">${fmtDate(c.updated_at)}</td>
              <td class="actions">
                <button class="btn-sm edit"   data-id="${c.id}" data-action="edit">Edit</button>
                <button class="btn-sm delete" data-id="${c.id}" data-action="delete">Delete</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <div class="pagination">
      <span>${state.total} total · page ${state.page} of ${totalPages}</span>
      <button ${state.page <= 1 ? 'disabled' : ''} data-pg="prev">‹ Prev</button>
      <button ${state.page >= totalPages ? 'disabled' : ''} data-pg="next">Next ›</button>
    </div>`}
  `;

  // Filter events
  el.querySelector('#filterSection').onchange = e => {
    filters.section_id = e.target.value; state.page = 1; load(el);
  };
  el.querySelector('#filterFreq').onchange = e => {
    filters.frequency = e.target.value; state.page = 1; load(el);
  };

  el.querySelector('#addCat').onclick = () => openCategoryModal(el);

  el.querySelectorAll('[data-action="edit"]').forEach(btn => {
    const cat = state.data.find(c => c.id == btn.dataset.id);
    btn.addEventListener('click', () => openCategoryModal(el, cat));
  });
  el.querySelectorAll('[data-action="delete"]').forEach(btn =>
    btn.addEventListener('click', () => confirmDelete(el, btn.dataset.id))
  );
  el.querySelector('[data-pg="prev"]')?.addEventListener('click', () => { state.page--; load(el); });
  el.querySelector('[data-pg="next"]')?.addEventListener('click', () => { state.page++; load(el); });
}

function openCategoryModal(el, cat = null) {
  const isEdit = !!cat;
  openModal({
    title: isEdit ? `Edit Category — ${cat.name}` : 'Add Category',
    body: `
      ${!isEdit ? `
      <div class="field">
        <label>Section *</label>
        <select name="section_id">
          <option value="">Select section…</option>
          ${sections.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
        </select>
      </div>` : `<input type="hidden" name="section_id" value="${cat.section_id}" />`}
      <div class="field">
        <label>Category Name *</label>
        <input name="name" value="${cat?.name || ''}" placeholder="e.g. Gym Membership" required />
      </div>
      <div class="field">
        <label>Frequency *</label>
        <select name="frequency">
          ${['monthly','annual','one-time','weekly'].map(f =>
            `<option value="${f}" ${(cat?.frequency || 'monthly') === f ? 'selected' : ''}>${f}</option>`
          ).join('')}
        </select>
      </div>
      <div class="field">
        <label>Notes</label>
        <textarea name="notes" placeholder="Optional notes…">${cat?.notes || ''}</textarea>
      </div>`,
    saveLabel: isEdit ? 'Update' : 'Create',
    onSave: async () => {
      const body = getFormData(['name', 'frequency', 'notes', 'section_id']);
      if (!body.name) { toast('Category name is required.', 'error'); return false; }
      if (!isEdit && !body.section_id) { toast('Please select a section.', 'error'); return false; }

      try {
        if (isEdit) {
          await api.categories.update(cat.id, { name: body.name, frequency: body.frequency, notes: body.notes });
          toast('Category updated.', 'success');
        } else {
          await api.categories.create(body.section_id, { name: body.name, frequency: body.frequency, notes: body.notes });
          toast('Category created.', 'success');
        }
        state.page = 1;
        await load(el);
      } catch (err) {
        toast(err.message || 'Save failed.', 'error');
        return false;
      }
    },
  });
}

function confirmDelete(el, id) {
  const cat = state.data.find(c => c.id == id);
  openModal({
    title: 'Delete Category',
    body: `<div class="confirm-box">
      <div class="warning">🗑️</div>
      <p>Delete <strong>${cat?.name}</strong>?<br>
      <span style="font-size:0.8rem;color:var(--red)">This will fail if expense entries exist for this category.</span></p>
    </div>`,
    saveLabel: 'Delete', danger: true,
    onSave: async () => {
      try {
        await api.categories.delete(id);
        toast('Category deleted.', 'success');
        state.page = 1;
        await load(el);
      } catch (err) {
        toast(err.message || 'Delete failed.', 'error');
        return false;
      }
    },
  });
}
