/* Tab "Vorrat": attention boxes, one-field add, search, stock grouped by area, "Vermutlich weg", install and data panels. */
import {app} from '../app.js';
import {esc} from '../text.js';
import {fmt} from '../units.js';
import {AREAS} from '../areas.js';
import {catalogNames, groupOf} from '../catalog.js';
import {daysBetween, now} from '../clock.js';
import {groupItems, packStatus, inSoonBox, inCheckBox, levelText, itemLabel, purgeDate} from '../pantry.js';
import {header, worstChip} from './components.js';

const SEARCH_FROM = 5;
const dateDE = t => new Date(t).toLocaleDateString('de-DE', {day: 'numeric', month: 'numeric'});
const daysText = n => `${n} ${n === 1 ? 'Tag' : 'Tagen'}`;
export const agoText = t => { const d = daysBetween(t, now()); return d <= 0 ? 'heute' : d === 1 ? 'gestern' : `vor ${d} Tagen`; };
export function frozenText(days) { return days < 1 ? 'heute eingefroren' : days < 45 ? `seit ${daysText(days)} eingefroren` : `seit ${Math.round(days / 30)} Monaten eingefroren`; }

/* Amount shown on the right of a row. */
export function groupQty(g) {
  const exact = g.items.filter(i => i.tracking === 'exact');
  if (exact.length === g.items.length) {
    const byUnit = {};
    for (const i of exact) byUnit[i.unit] = (byUnit[i.unit] || 0) + i.amount;
    const total = Object.entries(byUnit).map(([u, a]) => fmt(+a.toFixed(2), u)).join(' + ');
    return exact.length > 1 ? `${exact.length} Pck. · ${total}` : total;
  }
  const rough = g.items.filter(i => i.tracking === 'rough');
  if (rough.length) { const l = Math.max(...rough.map(i => i.level)); const n = Math.round(l * 4); return `<span class="level" title="${levelText(l)}">${[1, 2, 3, 4].map(k => `<i class="${k <= n ? 'on' : ''}"></i>`).join('')}</span>`; }
  return '<span class="muted small">da</span>';
}

function groupMeta(g) {
  const first = g.items[0], s = packStatus(first);
  if (s.phase === 'frozen') return frozenText(s.frozenDays);
  if (g.items.length > 1 && g.items.every(i => i.tracking === 'exact')) return g.items.map(i => fmt(i.amount, i.unit)).join(' + ');
  if (first.tracking === 'rough') { const l = Math.max(...g.items.map(i => i.level)); return l > .25 ? levelText(l) : ''; }
  if (s.profile === 'perishable') return `${agoText(first.boughtAt)} gekauft`;
  return '';
}

function groupRow(g) {
  const chip = worstChip(g.items);
  const meta = groupMeta(g);
  return `<div class="item"><button class="item-main" data-act="sheet" data-v="${esc(g.key)}">
    <span class="item-name"><span class="group-icon" aria-hidden="true">${groupOf(g.ingredient).icon}</span>${esc(g.name)}</span><span class="item-qty">${groupQty(g)}</span>
    <span class="item-meta">${chip ? `<span class="chip ${chip.cls}">${chip.text}</span>` : ''}${meta ? `<span>${esc(meta)}</span>` : ''}</span></button></div>`;
}

const boxLabel = s => s.phase === 'over' ? 'drüber' : s.daysLeft <= 0 ? 'heute' : s.daysLeft === 1 ? 'morgen' : `${s.daysLeft} T.`;

function goneReason(i, s) {
  if (i.probablyGoneAt) return 'neu gekauft, die alte ist wohl weg';
  if (s.useBy) return `Verbrauchsdatum ${dateDE(s.expiry)}`;
  return `seit ${daysText(-s.daysLeft)} drüber`;
}

function goneSection(gone) {
  if (!gone.length) return '';
  const open = app.ui.showGone;
  let h = `<div class="stack gone"><button class="cat-head gone-head" data-act="toggleGone" aria-expanded="${open}"><h3>Vermutlich weg (${gone.length})</h3><span class="muted small">${open ? 'zuklappen' : 'aufklappen'}</span></button>`;
  if (open) {
    h += `<div class="items">${gone.map(({i, s}) => `<div class="gone-row"><div class="gone-text"><b>${esc(itemLabel(i))}</b> <span class="muted num">${i.tracking === 'exact' ? fmt(i.amount, i.unit) : ''}</span>
      <span class="small muted">${esc(goneReason(i, s))} · wird am ${dateDE(purgeDate(s))} entfernt</span></div>
      <div class="row"><button class="btn small" data-act="stillThere" data-v="${i.id}">Noch da</button><button class="btn small danger" data-act="goneDelete" data-v="${i.id}">Weg</button></div></div>`).join('')}</div>
      <div class="row"><button class="btn small" data-act="allStillThere">Alles da</button><button class="btn small danger" data-act="allGoneDelete">Alles weg</button></div>
      <p class="muted small">Was hier liegt, zählt beim Kochen nicht mit und wird nach 14 Tagen automatisch entfernt.</p>`;
  }
  return h + `</div>`;
}

function installHint() {
  const {env, state} = app;
  if (env.standalone || state.settings.installHintDismissed) return '';
  return `<div class="notice row spread"><span>Tipp: Speckzettel lässt sich wie eine App installieren und läuft dann auch offline.</span>
    <span class="row"><button class="btn small" data-act="tab" data-v="settings">So geht's</button><button class="btn small ghost" data-act="dismissInstallHint" aria-label="Tipp ausblenden">✕</button></span></div>`;
}

export function renderPantry() {
  const {state, ui} = app;
  const groups = groupItems(state.items);
  const withStatus = groups.map(g => ({g, st: g.items.map(i => packStatus(i))}));
  const {hintSoon, hintCheck} = state.settings;
  const soon = hintSoon ? withStatus.filter(x => x.st.some(inSoonBox)) : [];
  const check = hintCheck ? withStatus.filter(x => !soon.includes(x) && x.st.some(inCheckBox)) : [];
  const gone = state.items.map(i => ({i, s: packStatus(i)})).filter(x => x.s.phase === 'gone');
  let h = header('Was ist da?', `${groups.length} ${groups.length === 1 ? 'Sache' : 'Sachen'} im Haus${soon.length ? ` · ${soon.length} bald verbrauchen` : ''}`);
  if (soon.length || check.length) {
    h += `<div class="attn">`;
    if (soon.length) h += `<div class="attn-box bad"><h3>Bald verbrauchen</h3><div class="attn-list">${soon.map(({g, st}) => {
      const s = st.filter(inSoonBox).sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0))[0];
      return `<button data-act="sheet" data-v="${esc(g.key)}">${esc(g.name)} · ${boxLabel(s)}</button>`;
    }).join('')}</div></div>`;
    if (check.length) h += `<div class="attn-box warn"><h3>Schau lieber nach</h3><div class="attn-list">${check.map(({g}) => `<button data-act="sheet" data-v="${esc(g.key)}">${esc(g.name)}</button>`).join('')}</div></div>`;
    h += `</div>`;
  }
  h += `<form class="add-line" data-form="add"><label class="sr-only" for="add-input">Zum Vorrat hinzufügen</label>
    <input type="text" id="add-input" list="catalog" placeholder="z. B. 500 g Tofu, 2 Zucchini" autocomplete="off" enterkeyhint="done">
    <button class="btn primary" type="submit">Rein</button>
    <datalist id="catalog">${catalogNames().map(n => `<option value="${esc(n)}">`).join('')}</datalist></form>`;
  const q = (ui.search || '').trim().toLowerCase();
  if (groups.length >= SEARCH_FROM || q) h += `<input type="search" id="pantry-search" class="search" placeholder="Im Vorrat suchen" value="${esc(ui.search || '')}" aria-label="Im Vorrat suchen">`;
  let shown = 0;
  for (const [area, label] of Object.entries(AREAS)) {
    const list = groups.filter(g => g.area === area && (!q || g.name.toLowerCase().includes(q) || g.ingredient.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    if (!list.length) continue;
    shown += list.length;
    h += `<div class="stack"><div class="cat-head"><h3>${label}</h3><span class="muted small">${list.length}</span></div><div class="items">${list.map(groupRow).join('')}</div></div>`;
  }
  if (q && !shown) h += `<div class="panel empty">Nichts gefunden für „${esc(ui.search)}“.</div>`;
  if (!groups.length) h += `<div class="panel empty">Noch nichts im Vorrat. Tipp oben ein, was da ist, oder lies einen Bon ein.</div>`;
  h += goneSection(gone);
  h += installHint();
  return h;
}
