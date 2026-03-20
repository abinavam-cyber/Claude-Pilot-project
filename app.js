const SHEET_ID = '18Ein8ZziNlcmzhPlcslkAqcOrgiXrw8vECuM4DHG6yQ';

let accountsChartInst = null;
let expensesChartInst = null;

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function parseNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  return parseFloat(String(v).replace(/[$,]/g, '')) || 0;
}

// Load data via JSONP so it works from file:// with no CORS issues
function fetchSheetData() {
  return new Promise((resolve, reject) => {
    const cbName = '__sheetCb_' + Date.now();
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json;responseHandler:${cbName}`;
    const script = document.createElement('script');
    script.src = url;

    const timer = setTimeout(() => {
      delete window[cbName];
      document.head.removeChild(script);
      reject(new Error('Timeout'));
    }, 10000);

    window[cbName] = (data) => {
      clearTimeout(timer);
      delete window[cbName];
      document.head.removeChild(script);
      resolve(data);
    };

    script.onerror = () => {
      clearTimeout(timer);
      delete window[cbName];
      reject(new Error('Script load error'));
    };

    document.head.appendChild(script);
  });
}

function extractSections(data) {
  // data.table.rows — each row has .c[] cells, each cell has .v (value) and .f (formatted)
  const rows = data.table.rows;
  const accounts   = [];
  const usExpenses = [];
  const gobi       = [];

  const cell = (row, col) => {
    const c = row.c && row.c[col];
    return c ? (c.f || c.v) : null;
  };
  const cellNum = (row, col) => {
    const c = row.c && row.c[col];
    return c ? parseNum(c.v) : 0;
  };

  for (const r of rows) {
    // Column indices: A=0,B=1 | G=6,H=7 | J=9,K=10
    const aLabel = cell(r, 0),    aAmt = cellNum(r, 1);
    const uLabel = cell(r, 6),    uAmt = cellNum(r, 7);
    const gLabel = cell(r, 9),    gAmt = cellNum(r, 10);

    if (aLabel && String(aLabel).trim() && aAmt > 0)
      accounts.push({ name: String(aLabel).trim(), amount: aAmt });
    if (uLabel && String(uLabel).trim() && uAmt > 0)
      usExpenses.push({ name: String(uLabel).trim(), amount: uAmt });
    if (gLabel && String(gLabel).trim() && gAmt > 0)
      gobi.push({ name: String(gLabel).trim(), amount: gAmt });
  }

  return { accounts, usExpenses, gobi };
}

function renderSummaryCards(accounts, usExpenses, gobi) {
  const totalAssets = accounts.reduce((s, x) => s + x.amount, 0);
  const totalUS     = usExpenses.reduce((s, x) => s + x.amount, 0);
  const totalGobi   = gobi.reduce((s, x) => s + x.amount, 0);

  document.getElementById('totalAssets').textContent = fmt(totalAssets);
  document.getElementById('totalUS').textContent     = fmt(totalUS);
  document.getElementById('totalGobi').textContent   = fmt(totalGobi);
  document.getElementById('annualUS').textContent    = fmt(totalUS * 12);
}

function renderTable(tbodyId, tfootId, rows, columns) {
  const tbody = document.getElementById(tbodyId);
  const tfoot = document.getElementById(tfootId);
  tbody.innerHTML = '';

  let total = 0;
  for (const row of rows) {
    total += row.amount;
    const tr = document.createElement('tr');
    tr.innerHTML = columns.map(col => {
      const val = col.key === 'name' ? row[col.key] : fmt(row[col.key]);
      return `<td>${val}</td>`;
    }).join('');
    tbody.appendChild(tr);
  }

  const footCells = columns.map((col, i) => {
    if (col.key === 'name') return `<td><strong>Total</strong></td>`;
    if (col.isTotal) return `<td>${fmt(total)}</td>`;
    if (col.isAnnual) return `<td>${fmt(total * 12)}</td>`;
    return `<td></td>`;
  }).join('');
  tfoot.innerHTML = `<tr>${footCells}</tr>`;
}

function renderAccountsTable(accounts) {
  renderTable('accountsTable', 'accountsFoot', accounts, [
    { key: 'name' },
    { key: 'amount', isTotal: true }
  ]);
}

function renderUSTable(usExpenses) {
  const withAnnual = usExpenses.map(x => ({ ...x, annual: x.amount * 12 }));
  const tbody = document.getElementById('usTable');
  const tfoot = document.getElementById('usFoot');
  tbody.innerHTML = '';
  let total = 0;
  for (const row of withAnnual) {
    total += row.amount;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${row.name}</td><td>${fmt(row.amount)}</td><td>${fmt(row.annual)}</td>`;
    tbody.appendChild(tr);
  }
  tfoot.innerHTML = `<tr><td><strong>Total</strong></td><td>${fmt(total)}</td><td>${fmt(total * 12)}</td></tr>`;
}

function renderGobiTable(gobi) {
  renderTable('gobiTable', 'gobiFoot', gobi, [
    { key: 'name' },
    { key: 'amount', isTotal: true }
  ]);
}

const CHART_COLORS = [
  '#3b82f6','#22c55e','#f97316','#a855f7','#ec4899','#14b8a6','#f59e0b','#6366f1'
];

function renderAccountsChart(accounts) {
  if (accountsChartInst) accountsChartInst.destroy();
  const ctx = document.getElementById('accountsChart').getContext('2d');
  accountsChartInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: accounts.map(a => a.name),
      datasets: [{
        data: accounts.map(a => a.amount),
        backgroundColor: CHART_COLORS,
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { padding: 16, font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${fmt(ctx.parsed)}`
          }
        }
      }
    }
  });
}

function renderExpensesChart(usExpenses, gobi) {
  if (expensesChartInst) expensesChartInst.destroy();
  const allItems = [
    ...usExpenses.map(x => ({ name: x.name, amount: x.amount, group: 'US' })),
    ...gobi.map(x => ({ name: x.name, amount: x.amount, group: 'Gobi' }))
  ];
  const ctx = document.getElementById('expensesChart').getContext('2d');
  expensesChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: allItems.map(x => x.name),
      datasets: [{
        label: 'Amount ($)',
        data: allItems.map(x => x.amount),
        backgroundColor: allItems.map((x, i) =>
          x.group === 'US' ? '#3b82f6' : '#f97316'
        ),
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${fmt(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: { ticks: { font: { size: 11 }, maxRotation: 30 } },
        y: {
          ticks: {
            callback: v => '$' + (v >= 1000 ? (v/1000).toFixed(0) + 'k' : v)
          }
        }
      }
    }
  });
}

async function loadData() {
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('content').classList.add('hidden');
  document.getElementById('error').classList.add('hidden');

  try {
    const data = await fetchSheetData();
    const { accounts, usExpenses, gobi } = extractSections(data);

    renderSummaryCards(accounts, usExpenses, gobi);
    renderAccountsTable(accounts);
    renderUSTable(usExpenses);
    renderGobiTable(gobi);
    renderAccountsChart(accounts);
    renderExpensesChart(usExpenses, gobi);

    document.getElementById('loading').classList.add('hidden');
    document.getElementById('content').classList.remove('hidden');
  } catch (err) {
    console.error(err);
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('error').classList.remove('hidden');
  }
}

loadData();
