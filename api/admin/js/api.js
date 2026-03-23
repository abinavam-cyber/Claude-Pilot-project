const BASE = '/api/v1';

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(BASE + path, opts);
  if (res.status === 204) return null;

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.message || 'API error');
    err.data = data;
    err.status = res.status;
    throw err;
  }
  return data;
}

function qs(params = {}) {
  const p = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null)
  );
  return Object.keys(p).length ? '?' + new URLSearchParams(p) : '';
}

export const api = {
  // ── Accounts ──────────────────────────────────────────────
  accounts: {
    list:   (p = {})    => request('GET', `/accounts${qs(p)}`),
    get:    (id)        => request('GET', `/accounts/${id}`),
    create: (b)         => request('POST', '/accounts', b),
    update: (id, b)     => request('PUT', `/accounts/${id}`, b),
    patch:  (id, b)     => request('PATCH', `/accounts/${id}`, b),
    delete: (id)        => request('DELETE', `/accounts/${id}`),
  },

  // ── Sections ──────────────────────────────────────────────
  sections: {
    list:   ()          => request('GET', '/sections'),
    get:    (id)        => request('GET', `/sections/${id}`),
    create: (b)         => request('POST', '/sections', b),
    update: (id, b)     => request('PUT', `/sections/${id}`, b),
    delete: (id)        => request('DELETE', `/sections/${id}`),
  },

  // ── Categories ────────────────────────────────────────────
  categories: {
    list:   (p = {})    => request('GET', `/categories${qs(p)}`),
    get:    (id)        => request('GET', `/categories/${id}`),
    create: (secId, b)  => request('POST', `/sections/${secId}/categories`, b),
    update: (id, b)     => request('PUT', `/categories/${id}`, b),
    delete: (id)        => request('DELETE', `/categories/${id}`),
  },

  // ── Expenses ──────────────────────────────────────────────
  expenses: {
    list:   (p = {})    => request('GET', `/expenses${qs(p)}`),
    get:    (id)        => request('GET', `/expenses/${id}`),
    create: (b)         => request('POST', '/expenses', b),
    update: (id, b)     => request('PUT', `/expenses/${id}`, b),
    patch:  (id, b)     => request('PATCH', `/expenses/${id}`, b),
    delete: (id)        => request('DELETE', `/expenses/${id}`),
  },

  // ── Summary ───────────────────────────────────────────────
  summary: {
    dashboard: ()       => request('GET', '/summary/dashboard'),
    accounts:  ()       => request('GET', '/summary/accounts'),
    expenses:  (p = {}) => request('GET', `/summary/expenses${qs(p)}`),
    monthly:   (m = 12) => request('GET', `/summary/expenses/monthly?months=${m}`),
  },
};
