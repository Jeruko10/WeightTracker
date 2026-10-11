// The Log tab: add a weigh-in, and edit or delete past ones from the history list.
import { byId } from '../../../lib/dom.js';
import { today, formatDate } from '../../../lib/dates.js';
import { confirmTap } from '../../../lib/confirm-tap.js';
import { state, sortEntries } from '../state.js';
import { createEntry, updateEntry, deleteEntry } from '../repository.js';
import { render } from '../render.js';

const MIN_KG = 30, MAX_KG = 250;

function isValidWeight(w) {
  return !!w && w >= MIN_KG && w <= MAX_KG;
}

function entryByDate(date) {
  return state.entries.find((e) => e.date === date);
}

// ── Render ────────────────────────────────────────────────────────────────────
// Each entry is a row plus a hidden inline edit row right after it.
function entryHtml(e, isToday) {
  return `<div class="entry${isToday ? ' today' : ''}" data-date="${e.date}">` +
      `<span class="edate">${formatDate(e.date)}${isToday ? '<span class="today-badge">Today</span>' : ''}</span>` +
      `<span class="ewt">${e.weight.toFixed(1)} kg</span>` +
      '<span class="entry-actions">' +
        '<button class="ebtn edit-btn" data-action="edit">Edit</button>' +
        '<button class="ebtn del-btn" data-action="delete">Delete</button>' +
      '</span>' +
    '</div>' +
    `<div class="edit-row" id="er-${e.date}" data-date="${e.date}">` +
      `<input type="number" id="ei-${e.date}" value="${e.weight}" min="${MIN_KG}" max="${MAX_KG}" step="0.1">` +
      '<button class="btn primary" data-action="save">Save</button>' +
      '<button class="btn secondary" data-action="cancel">Cancel</button>' +
    '</div>';
}

export function renderHistory() {
  const list = byId('entry-list');
  if (!state.entries.length) {
    list.innerHTML = '<p class="empty">No entries yet</p>';
    return;
  }
  const t = today();
  list.innerHTML = state.entries.slice().reverse().map((e) => entryHtml(e, e.date === t)).join('');
}

// ── Actions ───────────────────────────────────────────────────────────────────
async function onAdd() {
  const date = byId('inp-date').value;
  const weight = parseFloat(byId('inp-wt').value);
  const err = byId('add-err');
  if (!date) { err.textContent = 'Please select a date.'; return; }
  if (!isValidWeight(weight)) { err.textContent = 'Invalid weight (30–250 kg).'; return; }
  if (entryByDate(date)) { err.textContent = 'An entry already exists for this day.'; return; }
  err.textContent = '';
  const entry = { date, weight };
  state.entries.push(entry);
  sortEntries();
  byId('inp-wt').value = '';
  render();
  await createEntry(entry);
}

function openEdit(date) {
  document.querySelectorAll('.edit-row').forEach((r) => { r.style.display = 'none'; });
  const row = byId('er-' + date);
  if (!row) return;
  row.style.display = 'flex';
  row.querySelector('input').focus();
}

function saveEdit(entry) {
  const input = byId('ei-' + entry.date);
  const weight = parseFloat(input.value);
  if (!isValidWeight(weight)) {
    input.style.borderColor = '#ff7b7b';
    return;
  }
  entry.weight = weight;
  render();
  updateEntry(entry);
}

function remove(entry, btn) {
  if (!confirmTap(btn)) return;
  state.entries = state.entries.filter((e) => e._id !== entry._id);
  render();
  deleteEntry(entry);
}

function onListClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const date = btn.closest('[data-date]').dataset.date;
  const entry = entryByDate(date);
  if (!entry) return;
  switch (btn.dataset.action) {
    case 'edit': openEdit(date); break;
    case 'save': saveEdit(entry); break;
    case 'cancel': byId('er-' + date).style.display = 'none'; break;
    case 'delete': remove(entry, btn); break;
  }
}

export function initHistory() {
  byId('inp-date').value = today();
  byId('btn-add').addEventListener('click', onAdd);
  byId('entry-list').addEventListener('click', onListClick);
}
