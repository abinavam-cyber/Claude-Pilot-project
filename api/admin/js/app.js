import { initModal }   from './modal.js';
import * as dashboard  from './views/dashboard.js';
import * as accounts   from './views/accounts.js';
import * as sections   from './views/sections.js';
import * as categories from './views/categories.js';
import * as expenses   from './views/expenses.js';

const VIEWS = { dashboard, accounts, sections, categories, expenses };
const TITLES = {
  dashboard:  'Dashboard',
  accounts:   'Accounts',
  sections:   'Sections',
  categories: 'Categories',
  expenses:   'Expenses',
};

let current = null;

function navigate(view) {
  if (!VIEWS[view]) view = 'dashboard';
  current = view;

  // Update nav links
  document.querySelectorAll('.nav-item').forEach(a => {
    a.classList.toggle('active', a.dataset.view === view);
  });

  // Update topbar title
  document.getElementById('topbarTitle').textContent = TITLES[view];

  // Mount view
  const el = document.getElementById('content');
  el.innerHTML = '';
  VIEWS[view].mount(el);

  // Update hash without triggering hashchange
  history.replaceState(null, '', `#${view}`);

  // Close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');
}

function initNav() {
  document.querySelectorAll('.nav-item').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(a.dataset.view);
    });
  });
}

function initMobileMenu() {
  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
}

function getInitialView() {
  const hash = location.hash.replace('#', '');
  return VIEWS[hash] ? hash : 'dashboard';
}

// Boot
initModal();
initNav();
initMobileMenu();
navigate(getInitialView());

// Handle browser back/forward
window.addEventListener('hashchange', () => {
  const view = location.hash.replace('#', '');
  if (view !== current && VIEWS[view]) navigate(view);
});
