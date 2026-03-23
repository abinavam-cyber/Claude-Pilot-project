export const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

export const fmtFull = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n || 0);

export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

export const today = () => new Date().toISOString().slice(0, 10);

export const FREQ_BADGE = {
  monthly:  '<span class="badge badge-blue">Monthly</span>',
  annual:   '<span class="badge badge-green">Annual</span>',
  'one-time': '<span class="badge badge-orange">One-time</span>',
  weekly:   '<span class="badge badge-purple">Weekly</span>',
};

export function loading() {
  return `<div class="loading-state"><div class="spinner"></div><p>Loading…</p></div>`;
}

export function empty(msg = 'No records found.') {
  return `<div class="empty-state"><div class="empty-icon">📭</div><p>${msg}</p></div>`;
}

export function apiError(err) {
  return `<div class="empty-state">
    <div class="empty-icon">⚠️</div>
    <p>${err.message || 'Failed to load data.'}</p>
    ${err.status === undefined ? '<p style="font-size:0.78rem;margin-top:4px;">Is the API server running on port 8080?</p>' : ''}
  </div>`;
}
