/* Shared pieces: tab bar, page header, status chips. */
import {app, $} from '../app.js';
import {groupItems, packStatus, inSoonBox} from '../pantry.js';

const ICONS = {
  pantry: '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M5 10h14M9 6v2M9 13v3"/></svg>',
  cooking: '<svg viewBox="0 0 24 24"><path d="M4 11h16v3a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z"/><path d="M2 11h2M20 11h2M9 4c0 2 2 2 2 4M14 4c0 2 2 2 2 4"/></svg>',
  shopping: '<svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18h2"/></svg>',
  receipt: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
};
const TABS = [['pantry', 'Vorrat'], ['cooking', 'Kochen'], ['shopping', 'Einkauf'], ['receipt', 'Bon']];

/* Number of pantry rows in "Bald verbrauchen" (dot on the Vorrat tab). */
export const soonCount = () => app.state.settings.hintSoon ? groupItems(app.state.items).filter(g => g.items.some(i => inSoonBox(packStatus(i)))).length : 0;

export function renderNav() {
  const open = app.state.shopping.filter(s => !s.done).length;
  const soon = soonCount();
  const tab = app.ui.tab;
  const badge = k => k === 'shopping' && open ? `<span class="badge">${open}</span>`
    : k === 'pantry' && soon ? `<span class="badge soon" aria-label="${soon} bald verbrauchen">${soon}</span>` : '';
  $('#nav').innerHTML = TABS.map(([k, l]) => `<button data-act="tab" data-v="${k}" class="${tab === k ? 'on' : ''}" aria-current="${tab === k}">${ICONS[k]}<span>${l}</span>${badge(k)}</button>`).join('');
}

const GEAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';

export function header(title, sub) {
  const settings = app.ui.tab === 'settings';
  return `<header class="top"><div class="stack" style="gap:2px"><span class="eyebrow brand"><img src="icons/icon.svg" alt="" width="18" height="18">Speckzettel</span><h1>${title}</h1>${sub ? `<p class="muted small">${sub}</p>` : ''}</div>
    <div class="row">${app.state.demo ? '<span class="demo-note">Beispieldaten</span>' : ''}${settings ? '' : `<button class="icon-btn gear" data-act="tab" data-v="settings" aria-label="Einstellungen">${GEAR}</button>`}</div></header>`;
}

const days = n => `${n} ${n === 1 ? 'Tag' : 'Tagen'}`;
/* Chip for a pack status, or null. cls: bad (red), check (yellow), plain (grey). Respects the hint settings. */
export function statusChip(s) {
  const {hintSoon, hintCheck} = app.state.settings;
  if (!hintSoon && (s.phase === 'soon' || s.phase === 'over')) return null;
  if (!hintCheck && (s.phase === 'unsure' || s.phase === 'low')) return null;
  switch (s.phase) {
    case 'soon': return {cls: 'bad', text: s.daysLeft <= 0 ? 'heute verbrauchen' : s.daysLeft === 1 ? 'morgen verbrauchen' : `noch ${s.daysLeft} Tage`};
    case 'over':
      if (s.confirmed) return {cls: 'plain', text: 'drüber – laut dir noch gut'};
      if (s.overDays <= 3) return {cls: 'bad', text: `MHD seit ${days(s.overDays)} drüber – riech mal`};
      return {cls: 'plain', text: 'MHD drüber'};
    case 'unsure': return {cls: 'check', text: 'schau lieber nach'};
    case 'low': return {cls: 'check', text: 'fast leer'};
    default: return null;
  }
}
const RANK = {bad: 3, check: 2, plain: 1};
/* Most urgent chip among several packs. */
export function worstChip(items) {
  let best = null;
  for (const i of items) { const c = statusChip(packStatus(i)); if (c && (!best || RANK[c.cls] > RANK[best.cls])) best = c; }
  return best;
}
