import { api }  from '../api.js';
import { fmt, fmtDate, loading, apiError } from '../utils.js';

let chartA = null, chartB = null;

export async function mount(el) {
  el.innerHTML = loading();
  try {
    const [dash, acctSummary, monthly] = await Promise.all([
      api.summary.dashboard(),
      api.summary.accounts(),
      api.summary.monthly(6),
    ]);
    render(el, dash, acctSummary, monthly);
  } catch (err) {
    el.innerHTML = apiError(err);
  }
}

function render(el, dash, acctSummary, monthly) {
  el.innerHTML = `
    <!-- Stat cards -->
    <div class="stat-grid">
      <div class="stat-card blue">
        <div class="stat-label">Total Assets</div>
        <div class="stat-value">${fmt(dash.total_assets)}</div>
        <div class="stat-sub">${dash.account_count} account${dash.account_count !== 1 ? 's' : ''}</div>
      </div>
      <div class="stat-card green">
        <div class="stat-label">US Monthly</div>
        <div class="stat-value">${fmt(dash.us_monthly_total)}</div>
        <div class="stat-sub">Recurring expenses</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-label">Annual Projection</div>
        <div class="stat-value">${fmt(dash.us_annual_total)}</div>
        <div class="stat-sub">US expenses × 12</div>
      </div>
      <div class="stat-card purple">
        <div class="stat-label">Gobi Total</div>
        <div class="stat-value">${fmt(dash.gobi_total)}</div>
        <div class="stat-sub">Location expenses</div>
      </div>
    </div>

    <!-- Charts -->
    <div class="chart-grid">
      <div class="card chart-card">
        <h3>Account Balances</h3>
        <canvas id="chartAccounts"></canvas>
      </div>
      <div class="card chart-card">
        <h3>Expenses by Section</h3>
        <canvas id="chartExpenses"></canvas>
      </div>
    </div>

    <!-- Section breakdown table -->
    <div class="card" style="margin-bottom:24px">
      <div class="view-header" style="margin-bottom:12px">
        <h2>Section Breakdown</h2>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Section</th><th>Category</th><th>Frequency</th><th>Amount</th><th>Annual</th>
            </tr>
          </thead>
          <tbody>
            ${dash.sections.flatMap(s =>
              s.categories.map(c => `
                <tr>
                  <td>${s.section}</td>
                  <td>${c.category}</td>
                  <td>${freqBadge(c.frequency)}</td>
                  <td class="amount">${fmt(c.amount)}</td>
                  <td class="amount" style="color:var(--muted)">
                    ${c.frequency === 'monthly' ? fmt(c.amount * 12) : '—'}
                  </td>
                </tr>`
              )
            ).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  renderAccountsChart(acctSummary);
  renderExpensesChart(dash);
}

function renderAccountsChart(acctSummary) {
  if (chartA) chartA.destroy();
  const ctx = document.getElementById('chartAccounts');
  if (!ctx) return;
  chartA = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: acctSummary.accounts.map(a => a.name),
      datasets: [{
        data: acctSummary.accounts.map(a => a.balance),
        backgroundColor: ['#3b82f6','#22c55e','#f97316','#a855f7','#ec4899','#14b8a6'],
        borderWidth: 2, borderColor: '#fff',
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { padding: 14, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => ` ${c.label}: ${fmt(c.parsed)}` } },
      },
    },
  });
}

function renderExpensesChart(dash) {
  if (chartB) chartB.destroy();
  const ctx = document.getElementById('chartExpenses');
  if (!ctx) return;

  const labels = [];
  const data   = [];
  const colors = [];
  const palette = ['#3b82f6','#f97316','#22c55e','#a855f7'];
  dash.sections.forEach((s, i) =>
    s.categories.forEach(c => {
      labels.push(c.category);
      data.push(c.amount);
      colors.push(palette[i % palette.length]);
    })
  );

  chartB = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Amount', data, backgroundColor: colors, borderRadius: 5 }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${fmt(c.parsed.y)}` } } },
      scales: {
        x: { ticks: { font: { size: 10 }, maxRotation: 35 } },
        y: { ticks: { callback: v => '$' + (v >= 1000 ? (v/1000).toFixed(0) + 'k' : v) } },
      },
    },
  });
}

function freqBadge(f) {
  const map = {
    monthly: 'badge-blue', annual: 'badge-green',
    'one-time': 'badge-orange', weekly: 'badge-purple',
  };
  return `<span class="badge ${map[f] || 'badge-gray'}">${f}</span>`;
}
