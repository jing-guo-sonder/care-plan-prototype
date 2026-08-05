/* ==========================================================================
   Sonder Customer Portal — Reports prototype
   All data hard-coded from 02-content-source.md. No backend, no data layer.
   ========================================================================== */

/* Fictional "today" for the date-range presets. The content source dates the
   reports relative to early August 2026. */
const TODAY = new Date(2026, 7, 4); // 4 Aug 2026

const REPORTS = [
  { name: 'July 2026 Monthly Business Review',      author: 'Priya Nair (CSM)', tags: ['MBR', 'Monthly'],                 published: '2 Aug 2026'  },
  { name: 'Q2 2026 Quarterly Business Review',      author: 'Priya Nair (CSM)', tags: ['QBR', 'Quarterly'],               published: '12 Jul 2026' },
  { name: 'June 2026 Monthly Business Review',      author: 'Priya Nair (CSM)', tags: ['MBR', 'Monthly'],                 published: '3 Jul 2026'  },
  { name: 'FY26 Wellbeing Trends Summary',          author: 'Marcus Lee (BI)',  tags: ['Wellbeing', 'Annual'],            published: '1 Jul 2026'  },
  { name: 'May 2026 Monthly Business Review',       author: 'Priya Nair (CSM)', tags: ['MBR', 'Monthly'],                 published: '4 Jun 2026'  },
  { name: 'Q1 2026 Quarterly Business Review',      author: 'Priya Nair (CSM)', tags: ['QBR', 'Quarterly'],               published: '11 Apr 2026' },
  { name: 'April 2026 Monthly Business Review',     author: 'Priya Nair (CSM)', tags: ['MBR', 'Monthly'],                 published: '3 May 2026'  },
  { name: 'Psychosocial Risk Snapshot — H1 2026',   author: 'Marcus Lee (BI)',  tags: ['Safety', 'Half-year'],            published: '20 Apr 2026' },
  { name: 'March 2026 Monthly Business Review',     author: 'Priya Nair (CSM)', tags: ['MBR', 'Monthly'],                 published: '4 Apr 2026'  },
  { name: 'Injury Management Summary — Q2 2026',    author: 'Sam Ortiz (IM)',   tags: ['Injury Management', 'Quarterly'],  published: '12 Jul 2026' }
];

const TAG_OPTIONS = [
  'MBR', 'QBR', 'Wellbeing', 'Safety', 'Injury Management',
  'Annual', 'Half-year', 'Quarterly', 'Monthly'
];

/* Report types the user can subscribe to, with the cadence they arrive on.
   Derived from the report types present in the table above. */
const REPORT_TYPES = [
  { id: 'mbr',       name: 'Monthly Business Review',   desc: 'Published monthly by your CSM',        on: true  },
  { id: 'qbr',       name: 'Quarterly Business Review', desc: 'Published quarterly by your CSM',      on: true  },
  { id: 'wellbeing', name: 'Wellbeing Trends Summary',  desc: 'Published annually by the BI team',    on: false },
  { id: 'safety',    name: 'Psychosocial Risk Snapshot', desc: 'Published half-yearly by the BI team', on: false },
  { id: 'injury',    name: 'Injury Management Summary',  desc: 'Published quarterly by Injury Management', on: true }
];

/* --- Date parsing ---------------------------------------------------------- */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDate(str) {
  const [day, mon, year] = str.split(' ');
  return new Date(Number(year), MONTHS.indexOf(mon), Number(day));
}

REPORTS.forEach(r => { r.date = parseDate(r.published); });

/* --- View state ------------------------------------------------------------ */

const state = {
  search: '',
  sortKey: 'published',
  sortDir: 'desc',            // default sort = Published at, descending
  activeTags: new Set(),      // applied tag filters
  datePreset: 'all',          // applied date preset
  draftTags: new Set(),       // panel selections, not yet applied
  draftPreset: 'all'
};

/* Notification prefs: `prefs` is the saved state, `draftPrefs` is what the
   modal is editing. Cancel throws the draft away. */
let prefs = REPORT_TYPES.map(t => ({ ...t }));
let draftPrefs = [];

/* --- Elements -------------------------------------------------------------- */

const els = {
  searchInput: document.getElementById('search-input'),
  filtersBtn: document.getElementById('filters-btn'),
  filterBadge: document.getElementById('filter-badge'),
  filterPanel: document.getElementById('filter-panel'),
  tagChips: document.getElementById('tag-chips'),
  datePreset: document.getElementById('date-preset'),
  applyBtn: document.getElementById('apply-filters-btn'),
  clearBtn: document.getElementById('clear-filters-btn'),
  tbody: document.getElementById('reports-body'),
  noResults: document.getElementById('no-results'),
  rowCount: document.getElementById('row-count'),
  sortBtns: Array.from(document.querySelectorAll('.sort-btn')),

  // Report preview modal
  reportOverlay: document.getElementById('report-overlay'),
  reportModal: document.querySelector('#report-overlay .modal'),
  reportTitle: document.getElementById('report-modal-title'),
  reportMeta: document.getElementById('report-modal-meta'),
  reportCloseBtn: document.getElementById('report-close-btn'),
  reportDismissBtn: document.getElementById('report-dismiss-btn'),
  reportDownloadBtn: document.getElementById('report-download-btn'),

  // Email notifications modal
  overlay: document.getElementById('email-overlay'),
  modal: document.querySelector('#email-overlay .modal'),
  emailBtn: document.getElementById('email-notifications-btn'),
  modalCloseBtn: document.getElementById('modal-close-btn'),
  prefList: document.getElementById('report-pref-list'),
  cancelBtn: document.getElementById('cancel-notifications-btn'),
  saveBtn: document.getElementById('save-notifications-btn'),

  toastRegion: document.getElementById('toast-region')
};

/* --- Icons ----------------------------------------------------------------- */

function renderIcons() {
  if (window.lucide) {
    lucide.createIcons({ attrs: { 'stroke-width': 2 } });
  }
}

/* ==========================================================================
   Table: filter → sort → render
   ========================================================================== */

function withinPreset(date, preset) {
  if (preset === 'all') return true;
  const from = new Date(TODAY);
  if (preset === '30') from.setDate(from.getDate() - 30);
  else if (preset === 'quarter') from.setMonth(from.getMonth() - 3);
  else if (preset === '12months') from.setMonth(from.getMonth() - 12);
  return date >= from && date <= TODAY;
}

function matchesSearch(report, query) {
  if (!query) return true;
  const haystack = [report.name, report.author, ...report.tags].join(' ').toLowerCase();
  return haystack.includes(query);
}

function visibleReports() {
  const query = state.search.trim().toLowerCase();
  return REPORTS.filter(r =>
    matchesSearch(r, query) &&
    (state.activeTags.size === 0 || r.tags.some(t => state.activeTags.has(t))) &&
    withinPreset(r.date, state.datePreset)
  );
}

function sortReports(rows) {
  const dir = state.sortDir === 'asc' ? 1 : -1;
  return rows.slice().sort((a, b) => {
    let cmp;
    if (state.sortKey === 'published') {
      cmp = a.date - b.date;
    } else if (state.sortKey === 'tags') {
      cmp = a.tags.join(', ').localeCompare(b.tags.join(', '));
    } else {
      cmp = String(a[state.sortKey]).localeCompare(String(b[state.sortKey]));
    }
    if (cmp === 0) cmp = a.date - b.date; // stable-ish tiebreak
    return cmp * dir;
  });
}

function renderTable() {
  const rows = sortReports(visibleReports());

  els.tbody.innerHTML = rows.map(r => `
    <tr tabindex="0" data-report="${escapeHtml(r.name)}">
      <td class="cell-name">${escapeHtml(r.name)}</td>
      <td>${escapeHtml(r.author)}</td>
      <td>
        <span class="tag-chips">
          ${r.tags.map(t => `<span class="tag-chip">${escapeHtml(t)}</span>`).join('')}
        </span>
      </td>
      <td class="cell-muted">${escapeHtml(r.published)}</td>
      <td class="cell-action">
        <button class="download-btn" type="button"
                data-download="${escapeHtml(r.name)}"
                aria-label="Download ${escapeHtml(r.name)}">
          <i data-lucide="download" aria-hidden="true"></i>
        </button>
      </td>
    </tr>
  `).join('');

  els.noResults.hidden = rows.length > 0;
  els.rowCount.textContent = rows.length === REPORTS.length
    ? `${REPORTS.length} reports`
    : `${rows.length} of ${REPORTS.length} reports`;

  renderSortIndicators();
  renderIcons();
}

function renderSortIndicators() {
  els.sortBtns.forEach(btn => {
    const icon = btn.querySelector('[data-lucide], svg');
    if (btn.dataset.sort === state.sortKey) {
      btn.setAttribute('aria-sort', state.sortDir === 'asc' ? 'ascending' : 'descending');
      if (icon) icon.setAttribute('data-lucide', state.sortDir === 'asc' ? 'chevron-up' : 'chevron-down');
    } else {
      btn.removeAttribute('aria-sort');
      if (icon) icon.setAttribute('data-lucide', 'chevrons-up-down');
    }
    // Force a re-render of the swapped icon
    if (icon && icon.tagName.toLowerCase() === 'svg') {
      const placeholder = document.createElement('i');
      placeholder.setAttribute('data-lucide', icon.getAttribute('data-lucide'));
      placeholder.setAttribute('aria-hidden', 'true');
      icon.replaceWith(placeholder);
    }
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

/* --- Search --------------------------------------------------------------- */

els.searchInput.addEventListener('input', () => {
  state.search = els.searchInput.value;
  renderTable();
});

/* --- Sorting -------------------------------------------------------------- */

els.sortBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.sort;
    if (state.sortKey === key) {
      state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      state.sortKey = key;
      state.sortDir = key === 'published' ? 'desc' : 'asc';
    }
    renderTable();
  });
});

/* ==========================================================================
   Filters
   ========================================================================== */

els.tagChips.innerHTML = TAG_OPTIONS.map(tag => `
  <button class="chip" type="button" data-tag="${escapeHtml(tag)}" aria-pressed="false">
    <span>${escapeHtml(tag)}</span>
    <i data-lucide="check" class="chip-check" aria-hidden="true"></i>
  </button>
`).join('');

els.tagChips.addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  const tag = chip.dataset.tag;
  const pressed = chip.getAttribute('aria-pressed') === 'true';
  chip.setAttribute('aria-pressed', String(!pressed));
  if (pressed) state.draftTags.delete(tag);
  else state.draftTags.add(tag);
});

els.datePreset.addEventListener('change', () => {
  state.draftPreset = els.datePreset.value;
});

function setPanelOpen(open) {
  els.filterPanel.classList.toggle('is-open', open);
  els.filtersBtn.setAttribute('aria-expanded', String(open));
}

els.filtersBtn.addEventListener('click', () => {
  setPanelOpen(!els.filterPanel.classList.contains('is-open'));
});

/* Count of active filters: each selected tag counts as one, plus the date
   range if it isn't "All time". */
function activeFilterCount() {
  return state.activeTags.size + (state.datePreset === 'all' ? 0 : 1);
}

function renderFilterBadge() {
  const count = activeFilterCount();
  els.filterBadge.textContent = count;
  els.filterBadge.hidden = count === 0;
  els.filtersBtn.classList.toggle('has-filters', count > 0);
  els.filtersBtn.setAttribute(
    'aria-label',
    count > 0 ? `Filters, ${count} active` : 'Filters'
  );
}

els.applyBtn.addEventListener('click', () => {
  state.activeTags = new Set(state.draftTags);
  state.datePreset = state.draftPreset;
  renderTable();
  renderFilterBadge();
  setPanelOpen(false);          // applying closes the drawer
  els.filtersBtn.focus();
});

els.clearBtn.addEventListener('click', () => {
  state.draftTags.clear();
  state.draftPreset = 'all';
  state.activeTags.clear();
  state.datePreset = 'all';
  els.tagChips.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
  els.datePreset.value = 'all';
  renderTable();
  renderFilterBadge();
});

/* ==========================================================================
   Download: Preparing… → toast
   ========================================================================== */

function runDownload(cell, reportName) {
  const name = escapeHtml(reportName);

  cell.innerHTML = `
    <span class="preparing">
      <i data-lucide="loader-2" aria-hidden="true"></i> Preparing…
    </span>
  `;
  renderIcons();

  setTimeout(() => {
    cell.innerHTML = `
      <button class="download-btn" type="button"
              data-download="${name}"
              aria-label="Download ${name}">
        <i data-lucide="download" aria-hidden="true"></i>
      </button>
    `;
    renderIcons();
    showToast('Report downloaded.');
  }, 1000);
}

els.tbody.addEventListener('click', e => {
  const btn = e.target.closest('[data-download]');
  if (btn) {
    e.stopPropagation();                    // don't also open the row modal
    runDownload(btn.parentElement, btn.dataset.download);
    return;
  }

  const row = e.target.closest('tr[data-report]');
  if (row) openReportModal(row.dataset.report);
});

/* Keyboard: Enter/Space on a focused row opens the preview */
els.tbody.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const row = e.target.closest('tr[data-report]');
  if (!row || e.target.closest('[data-download]')) return;
  e.preventDefault();
  openReportModal(row.dataset.report);
});

/* ==========================================================================
   Toast
   ========================================================================== */

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i data-lucide="check-circle" aria-hidden="true"></i><span>${escapeHtml(message)}</span>`;
  els.toastRegion.appendChild(toast);
  renderIcons();

  setTimeout(() => {
    toast.classList.add('is-leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, 2600);
}

/* ==========================================================================
   Modal plumbing — shared by both modals
   ========================================================================== */

let lastFocused = null;
let openOverlay = null;
let onCancelCurrent = null;

function trapFocus(e, modal) {
  if (e.key !== 'Tab') return;
  const list = Array.from(
    modal.querySelectorAll('button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])')
  ).filter(el => !el.disabled && el.offsetParent !== null);
  if (!list.length) return;
  const first = list[0];
  const last = list[list.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function onOverlayKeydown(e) {
  if (!openOverlay) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    if (onCancelCurrent) onCancelCurrent();
    return;
  }
  trapFocus(e, openOverlay.querySelector('.modal'));
}

function showOverlay(overlay, { onCancel, focusEl }) {
  lastFocused = document.activeElement;
  openOverlay = overlay;
  onCancelCurrent = onCancel;
  overlay.classList.add('is-open');
  document.addEventListener('keydown', onOverlayKeydown);
  if (focusEl) focusEl.focus();
}

function hideOverlay(overlay) {
  overlay.classList.remove('is-open');
  document.removeEventListener('keydown', onOverlayKeydown);
  openOverlay = null;
  onCancelCurrent = null;
  if (lastFocused) lastFocused.focus();
}

/* ==========================================================================
   Report preview modal — same placeholder document for every report
   ========================================================================== */

let currentReport = null;

function openReportModal(name) {
  const report = REPORTS.find(r => r.name === name);
  if (!report) return;
  currentReport = report;

  els.reportTitle.textContent = report.name;
  els.reportMeta.textContent = `${report.author} · Published ${report.published}`;

  showOverlay(els.reportOverlay, {
    onCancel: closeReportModal,
    focusEl: els.reportModal
  });
}

function closeReportModal() {
  hideOverlay(els.reportOverlay);
  currentReport = null;
}

els.reportCloseBtn.addEventListener('click', closeReportModal);
els.reportDismissBtn.addEventListener('click', closeReportModal);

els.reportDownloadBtn.addEventListener('click', () => {
  closeReportModal();
  showToast('Report downloaded.');
});

els.reportOverlay.addEventListener('mousedown', e => {
  if (e.target === els.reportOverlay) closeReportModal();
});

/* ==========================================================================
   Email notifications modal — which report types to receive
   ========================================================================== */

function renderPrefs() {
  els.prefList.innerHTML = draftPrefs.map((t, i) => `
    <li class="pref-row">
      <span class="pref-text">
        <span class="pref-name">${escapeHtml(t.name)}</span>
        <span class="pref-desc">${escapeHtml(t.desc)}</span>
      </span>
      <i data-lucide="mail" class="pref-mail" aria-hidden="true"></i>
      <span class="switch">
        <input type="checkbox" id="pref-${escapeHtml(t.id)}" data-pref="${i}"
               ${t.on ? 'checked' : ''}
               aria-label="Email me new ${escapeHtml(t.name)} reports">
        <span class="switch-track"></span>
      </span>
    </li>
  `).join('');
  renderIcons();   // the mail icons inside the switches are injected here
}

function openEmailModal() {
  draftPrefs = prefs.map(t => ({ ...t }));   // edit a copy; Cancel discards it
  renderPrefs();
  showOverlay(els.overlay, {
    onCancel: closeEmailModal,
    focusEl: els.modal
  });
}

function closeEmailModal() {
  hideOverlay(els.overlay);
}

els.prefList.addEventListener('change', e => {
  const input = e.target.closest('[data-pref]');
  if (!input) return;
  draftPrefs[Number(input.dataset.pref)].on = input.checked;
});

els.emailBtn.addEventListener('click', openEmailModal);
els.modalCloseBtn.addEventListener('click', closeEmailModal);
els.cancelBtn.addEventListener('click', closeEmailModal);

els.saveBtn.addEventListener('click', () => {
  prefs = draftPrefs.map(t => ({ ...t }));   // commit
  closeEmailModal();
  showToast('Notification settings saved');
});

els.overlay.addEventListener('mousedown', e => {
  if (e.target === els.overlay) closeEmailModal();
});

/* ==========================================================================
   Boot
   ========================================================================== */

renderTable();
renderFilterBadge();
renderIcons();
