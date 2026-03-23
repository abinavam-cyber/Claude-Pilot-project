import { api }                        from '../api.js';
import { fmt, fmtDate, loading, empty, apiError } from '../utils.js';
import { openModal, getFormData }     from '../modal.js';
import { toast }                      from '../toast.js';

let state = { page: 1, limit: 10, total: 0, data: [] };

export async function mount(el) {
  el.innerHTML = loading();
  await load(el);
}

async function load(el) {
  try {
    const res = await api.accounts.list({ page: state.page, limit: state.limit });
    state = { ...state, total: res.total, data: res.data };
    render(el);
  } catch (err) {
    el.innerHTML = apiError(err);
  }
}

function render(el) {
  const totalPages = Math.ceil(state.total / state.limit) || 1;
  el.innerHTML = `
    <div class="view-header">
      <h2>Accounts <span style="font-weight:400;color:var(--muted);font-size:0.85rem">(${state.total})</span></h2>
      <button class="btn-primary" id="addAccount">+ Add Account</button>
    </div>

    ${state.data.length === 0 ? empty('No accounts yet.') : `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th><th>Name</th><th>Balance</th><th>Currency</th>
            <th>Notes</th><th>Updated</th><th style="text-align:right">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${state.data.map(a => `
            <tr>
              <td style="color:var(--muted)">#${a.id}</td>
              <td><strong>${a.name}</strong></td>
              <td class="amount">${fmt(a.balance)}</td>
              <td><span class="badge badge-gray">${a.currency}</span></td>
              <td style="color:var(--muted);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                ${a.notes || '—'}
              </td>
              <td style="color:var(--muted)">${fmtDate(a.updated_at)}</td>
              <td class="actions">
                <button class="btn-sm edit"   data-id="${a.id}" data-action="edit">Edit</button>
                <button class="btn-sm delete" data-id="${a.id}" data-action="delete">Delete</button>
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

  // Events
  el.querySelector('#addAccount').onclick = () => openAccountModal(el);

  el.querySelectorAll('[data-action="edit"]').forEach(btn =>
    btn.addEventListener('click', () => {
      const acct = state.data.find(a => a.id == btn.dataset.id);
      openAccountModal(el, acct);
    })
  );

  el.querySelectorAll('[data-action="delete"]').forEach(btn =>
    btn.addEventListener('click', () => confirmDelete(el, btn.dataset.id))
  );

  el.querySelector('[data-pg="prev"]')?.addEventListener('click', () => { state.page--; load(el); });
  el.querySelector('[data-pg="next"]')?.addEventListener('click', () => { state.page++; load(el); });
}

function openAccountModal(el, acct = null) {
  const isEdit = !!acct;
  openModal({
    title: isEdit ? `Edit Account — ${acct.name}` : 'Add Account',
    body: `
      <div class="field">
        <label>Account Name *</label>
        <input name="name" value="${acct?.name || ''}" placeholder="e.g. Chase" required />
      </div>
      <div class="field">
        <label>Balance *</label>
        <input name="balance" type="number" step="0.01" min="0"
               value="${acct?.balance ?? ''}" placeholder="0.00" required />
      </div>
      <div class="field">
        <label>Currency</label>
        <select name="currency">
          ${['USD','EUR','GBP','JPY','CAD','AUD'].map(c =>
            `<option ${(acct?.currency || 'USD') === c ? 'selected' : ''}>${c}</option>`
          ).join('')}
        </select>
      </div>
      <div class="field">
        <label>Notes</label>
        <textarea name="notes" placeholder="Optional notes…">${acct?.notes || ''}</textarea>
      </div>`,
    saveLabel: isEdit ? 'Update' : 'Create',
    onSave: async () => {
      const body = getFormData(['name', 'balance', 'currency', 'notes']);
      if (!body.name) { toast('Account name is required.', 'error'); return false; }
      if (body.balance === null) { toast('Balance is required.', 'error'); return false; }
      body.balance = parseFloat(body.balance);

      try {
        if (isEdit) {
          await api.accounts.update(acct.id, body);
          toast('Account updated.', 'success');
        } else {
          await api.accounts.create(body);
          toast('Account created.', 'success');
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
  const acct = state.data.find(a => a.id == id);
  openModal({
    title: 'Delete Account',
    body: `<div class="confirm-box">
      <div class="warning">🗑️</div>
      <p>Delete <strong>${acct?.name}</strong>? This cannot be undone.</p>
    </div>`,
    saveLabel: 'Delete',
    danger: true,
    onSave: async () => {
      try {
        await api.accounts.delete(id);
        toast('Account deleted.', 'success');
        state.page = 1;
        await load(el);
      } catch (err) {
        toast(err.message || 'Delete failed.', 'error');
        return false;
      }
    },
  });
}
