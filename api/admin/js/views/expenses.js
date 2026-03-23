import { api }                          from '../api.js';
import { fmt, fmtDate, FREQ_BADGE, today, loading, empty, apiError } from '../utils.js';
import { openModal, getFormData }       from '../modal.js';
import { toast }                        from '../toast.js';

let state    = { page: 1, limit: 15, total: 0, data: [] };
let filters  = { section_id: '', category_id: '', from: '', to: '', sort: 'date_desc' };
let sections = [];
let allCats  = [];

export async function mount(el) {
  el.innerHTML = loading();
  try {
    [sections, { data: allCats }] = await Promise.all([
      api.sections.list(),
      api.categories.list({ limit: 100 }),
    ]);
    await load(el);
  } catch (err) {
    el.innerHTML = apiError(err);
  }
}

async function load(el) {
  try {
    const params = { page: state.page, limit: state.limit, ...filters };
    const res    = await api.expenses.list(params);
    state = { ...state, total: res.total, data: res.data };
    render(el);
  } catch (err) {
    el.innerHTML = apiError(err);
  }
}

function render(el) {
  const totalPages  = Math.ceil(state.total / state.limit) || 1;
  const catName     = id => allCats.find(c => c.id == id)?.name || `#${id}`;
  const catSection  = id => {
    const cat = allCats.find(c => c.id == id);
    return cat ? sections.find(s => s.id == cat.section_id)?.name || '' : '';
  };

  // Filter cats by selected section
  const filteredCats = filters.section_id
    ? allCats.filter(c => c.section_id == filters.section_id)
    : allCats;

  el.innerHTML = `
    <div class="view-header">
      <h2>Expenses <span style="font-weight:400;color:var(--muted);font-size:0.85rem">(${state.total})</span></h2>
      <button class="btn-primary" id="addExpense">+ Log Expense</button>
    </div>

    <div class="filters">
      <select id="filterSection">
        <option value="">All Sections</option>
        ${sections.map(s => `<option value="${s.id}" ${filters.section_id == s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
      </select>
      <select id="filterCategory">
        <option value="">All Categories</option>
        ${filteredCats.map(c => `<option value="${c.id}" ${filters.category_id == c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
      </select>
      <input type="date" id="filterFrom" value="${filters.from}" title="From date" />
      <input type="date" id="filterTo"   value="${filters.to}"   title="To date" />
      <select id="filterSort">
        <option value="date_desc"   ${filters.sort === 'date_desc'   ? 'selected' : ''}>Newest first</option>
        <option value="date_asc"    ${filters.sort === 'date_asc'    ? 'selected' : ''}>Oldest first</option>
        <option value="amount_desc" ${filters.sort === 'amount_desc' ? 'selected' : ''}>Highest amount</option>
        <option value="amount_asc"  ${filters.sort === 'amount_asc'  ? 'selected' : ''}>Lowest amount</option>
      </select>
      <button class="btn-ghost" id="clearFilters">Clear</button>
    </div>

    ${state.data.length === 0 ? empty('No expenses match your filters.') : `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th><th>Date</th><th>Section</th><th>Category</th>
            <th>Amount</th><th>Currency</th><th>Notes</th><th style="text-align:right">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${state.data.map(e => `
            <tr>
              <td style="color:var(--muted)">#${e.id}</td>
              <td>${fmtDate(e.expense_date)}</td>
              <td><span class="badge badge-gray">${catSection(e.category_id)}</span></td>
              <td>${catName(e.category_id)}</td>
              <td class="amount">${fmt(e.amount)}</td>
              <td><span class="badge badge-blue">${e.currency}</span></td>
              <td style="color:var(--muted);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                ${e.notes || '—'}
              </td>
              <td class="actions">
                <button class="btn-sm edit"   data-id="${e.id}" data-action="edit">Edit</button>
                <button class="btn-sm delete" data-id="${e.id}" data-action="delete">Delete</button>
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
    filters.section_id = e.target.value; filters.category_id = ''; state.page = 1; load(el);
  };
  el.querySelector('#filterCategory').onchange = e => {
    filters.category_id = e.target.value; state.page = 1; load(el);
  };
  el.querySelector('#filterFrom').onchange = e => {
    filters.from = e.target.value; state.page = 1; load(el);
  };
  el.querySelector('#filterTo').onchange = e => {
    filters.to = e.target.value; state.page = 1; load(el);
  };
  el.querySelector('#filterSort').onchange = e => {
    filters.sort = e.target.value; state.page = 1; load(el);
  };
  el.querySelector('#clearFilters').onclick = () => {
    filters = { section_id: '', category_id: '', from: '', to: '', sort: 'date_desc' };
    state.page = 1; load(el);
  };

  el.querySelector('#addExpense').onclick = () => openExpenseModal(el);

  el.querySelectorAll('[data-action="edit"]').forEach(btn => {
    const exp = state.data.find(e => e.id == btn.dataset.id);
    btn.addEventListener('click', () => openExpenseModal(el, exp));
  });
  el.querySelectorAll('[data-action="delete"]').forEach(btn =>
    btn.addEventListener('click', () => confirmDelete(el, btn.dataset.id))
  );
  el.querySelector('[data-pg="prev"]')?.addEventListener('click', () => { state.page--; load(el); });
  el.querySelector('[data-pg="next"]')?.addEventListener('click', () => { state.page++; load(el); });
}

function openExpenseModal(el, exp = null) {
  const isEdit = !!exp;
  openModal({
    title: isEdit ? `Edit Expense #${exp.id}` : 'Log Expense',
    body: `
      <div class="field">
        <label>Category *</label>
        <select name="category_id">
          <option value="">Select category…</option>
          ${sections.map(s => `
            <optgroup label="${s.name}">
              ${allCats.filter(c => c.section_id === s.id).map(c =>
                `<option value="${c.id}" ${exp?.category_id == c.id ? 'selected' : ''}>${c.name}</option>`
              ).join('')}
            </optgroup>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Amount *</label>
        <input name="amount" type="number" step="0.01" min="0"
               value="${exp?.amount ?? ''}" placeholder="0.00" required />
      </div>
      <div class="field">
        <label>Currency</label>
        <select name="currency">
          ${['USD','EUR','GBP','JPY','CAD','AUD'].map(c =>
            `<option ${(exp?.currency || 'USD') === c ? 'selected' : ''}>${c}</option>`
          ).join('')}
        </select>
      </div>
      <div class="field">
        <label>Date *</label>
        <input name="expense_date" type="date" value="${exp?.expense_date || today()}" required />
      </div>
      <div class="field">
        <label>Notes</label>
        <textarea name="notes" placeholder="Optional notes…">${exp?.notes || ''}</textarea>
      </div>`,
    saveLabel: isEdit ? 'Update' : 'Log',
    onSave: async () => {
      const body = getFormData(['category_id', 'amount', 'currency', 'expense_date', 'notes']);
      if (!body.category_id) { toast('Please select a category.', 'error'); return false; }
      if (!body.amount)      { toast('Amount is required.', 'error'); return false; }
      if (!body.expense_date){ toast('Date is required.', 'error'); return false; }
      body.amount = parseFloat(body.amount);

      try {
        if (isEdit) {
          await api.expenses.update(exp.id, body);
          toast('Expense updated.', 'success');
        } else {
          await api.expenses.create(body);
          toast('Expense logged.', 'success');
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
  openModal({
    title: 'Delete Expense',
    body: `<div class="confirm-box">
      <div class="warning">🗑️</div>
      <p>Delete expense <strong>#${id}</strong>? This cannot be undone.</p>
    </div>`,
    saveLabel: 'Delete', danger: true,
    onSave: async () => {
      try {
        await api.expenses.delete(id);
        toast('Expense deleted.', 'success');
        state.page = 1;
        await load(el);
      } catch (err) {
        toast(err.message || 'Delete failed.', 'error');
        return false;
      }
    },
  });
}
