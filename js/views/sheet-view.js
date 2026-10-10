/* Bottom sheet: details of one pantry row (all its packs), the question "where does this new ingredient go?", or the "Gekocht" preview. */
import {app} from '../app.js';
import {esc} from '../text.js';
import {fmt} from '../units.js';
import {AREAS} from '../areas.js';
import {key} from '../catalog.js';
import {groupItems, packStatus, rulesFor, levelText} from '../pantry.js';
import {statusChip} from './components.js';
import {agoText, frozenText} from './pantry-view.js';
import {cookSheet} from './cook-sheet-view.js';

const isoDate = t => { if (!t) return ''; const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dateDE = t => new Date(t).toLocaleDateString('de-DE', {day: 'numeric', month: 'numeric'});
const SOURCES = {receipt: 'vom Bon', shopping: 'vom Einkaufszettel', manual: '', cooking: ''};

export const findGroup = k => groupItems(app.state.items).find(g => g.key === k);

function packStatusText(i) {
  const s = packStatus(i);
  const chip = statusChip(s);
  if (chip) return chip.text;
  if (s.phase === 'frozen') return frozenText(s.frozenDays);
  if (s.profile === 'stable') return i.tracking === 'rough' ? levelText(i.level) : 'hält lange';
  return s.daysLeft != null ? `noch ${s.daysLeft} Tage` : '';
}

function packRow(i) {
  const r = rulesFor(i), s = packStatus(i);
  const bought = [`gekauft ${agoText(i.boughtAt)}`, SOURCES[i.source]].filter(Boolean).join(' ');
  let amount;
  if (i.tracking === 'exact') amount = `<div class="stepper"><button data-act="packStep" data-v="${i.id}" data-d="-1" aria-label="weniger">−</button>
      <input type="number" id="pack-amount-${i.id}" data-pack="${i.id}" data-f="amount" value="${i.amount}" min="0" step="any" inputmode="decimal" aria-label="Menge in ${esc(i.unit)}">
      <button data-act="packStep" data-v="${i.id}" data-d="1" aria-label="mehr">+</button></div><span class="muted">${esc(i.unit)}</span>`;
  else if (i.tracking === 'rough') amount = `<div class="seg" role="group" aria-label="Füllstand">${[[1, 'voll'], [.5, 'halb'], [.25, 'fast leer'], [0, 'leer']].map(([v, l]) => `<button class="${Math.abs(i.level - v) < .13 ? 'on' : ''}" data-act="level" data-v="${i.id}" data-l="${v}">${l}</button>`).join('')}</div>`;
  else amount = `<span class="muted">da</span>`;
  const canOpen = s.phase !== 'frozen' && (r.baseProfile === 'perishable' || r.openedDays);
  const chip = statusChip(s);
  return `<div class="pack">
    <div class="pack-amount">${amount}</div>
    <p class="small"><span class="${chip ? `chip ${chip.cls}` : 'muted'}">${esc(packStatusText(i))}</span> <span class="muted">· ${esc(bought)}</span></p>
    <div class="pack-tools">
      ${canOpen ? `<label class="check"><input type="checkbox" data-pack="${i.id}" data-f="opened" ${i.openedAt ? 'checked' : ''}> angebrochen${i.openedAt ? ` seit ${dateDE(i.openedAt)}` : ''}</label>` : ''}
      ${s.phase !== 'frozen' && r.baseProfile === 'perishable' ? `<label class="fld inline">MHD<input type="date" data-pack="${i.id}" data-f="bestBefore" value="${isoDate(i.bestBefore)}"></label>` : ''}
      <button class="btn small ghost danger" data-act="packDelete" data-v="${i.id}">Packung entfernen</button>
    </div></div>`;
}

function groupSheet(g) {
  const first = g.items[0], r = rulesFor(first);
  const recipes = app.state.recipes.filter(rc => rc.ingredients.some(x => key(x.name) === key(g.ingredient))).slice(0, 3);
  const n = g.items.length;
  return `<div class="sheet-head"><div><h2 id="sheet-title">${esc(g.name)}</h2><p class="muted small">${AREAS[g.area]} · ${n} ${n === 1 ? 'Packung' : 'Packungen'}</p></div>
      <button class="icon-btn" data-act="closeSheet" aria-label="Schließen">✕</button></div>
    <div class="packs">${g.items.map(packRow).join('')}</div>
    <div class="row"><button class="btn" data-act="groupSeen">Stimmt so</button><button class="btn danger" data-act="groupGone">Aufgebraucht</button><button class="btn" data-act="groupToShopping">Auf den Zettel</button></div>
    <details class="more"${app.ui.sheetMore ? ' open' : ''}><summary data-act="toggleSheetMore">${app.ui.sheetMore ? 'Weniger ▴' : 'Mehr ▾'}</summary>
      <div class="grid2">
        <label class="fld">Bereich<select data-group-f="area">${Object.entries(AREAS).map(([k, l]) => `<option value="${k}" ${k === g.area ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="fld">Haltbarkeit<select data-group-f="profile"><option value="perishable" ${r.baseProfile === 'perishable' ? 'selected' : ''}>läuft ab</option><option value="stable" ${r.baseProfile === 'stable' ? 'selected' : ''}>hält lange</option></select></label>
        ${r.baseProfile === 'perishable' ? `<label class="fld">Haltbar ab Kauf (Tage)<input type="number" min="1" data-group-f="shelfDays" value="${r.shelfDays}"></label>` : ''}
        <label class="fld">Erfassen als<select data-group-f="tracking"><option value="exact" ${first.tracking === 'exact' ? 'selected' : ''}>genaue Menge</option><option value="rough" ${first.tracking === 'rough' ? 'selected' : ''}>grob (voll/halb/leer)</option><option value="flag" ${first.tracking === 'flag' ? 'selected' : ''}>nur „da“</option></select></label>
      </div>
      <p class="muted small">Gilt für alle ${esc(g.ingredient)}-Packungen, auch künftige.</p>
    </details>
    ${recipes.length ? `<div class="stack"><h3>Passt zu</h3><div class="row">${recipes.map(rc => `<button class="btn small" data-act="openRecipe" data-v="${rc.id}">${esc(rc.title)} →</button>`).join('')}</div></div>` : ''}`;
}

function newIngredientSheet(entry) {
  const amount = entry.amount != null ? `${fmt(entry.amount, entry.unit)} ` : '';
  return `<div class="sheet-head"><div><h2 id="sheet-title">Neue Zutat: ${esc(entry.name)}</h2><p class="muted small">${esc(amount)}Kenne ich noch nicht. Wo liegt das?</p></div>
      <button class="icon-btn" data-act="closeSheet" aria-label="Schließen">✕</button></div>
    <div class="area-pick">${Object.entries(AREAS).map(([k, l]) => `<button class="btn" data-act="newIngredientArea" data-v="${k}">${l}</button>`).join('')}</div>
    <p class="muted small">Die App merkt sich das. Haltbarkeit und Erfassung kannst du danach in den Details ändern.</p>`;
}

export function renderSheet() {
  const sh = app.ui.sheet;
  if (!sh) return '';
  let body = '';
  if (sh.type === 'group') { const g = findGroup(sh.key); if (!g) { app.ui.sheet = null; return ''; } body = groupSheet(g); }
  else if (sh.type === 'newIngredient') body = newIngredientSheet(sh.queue[0]);
  else if (sh.type === 'cook') { body = cookSheet(sh); if (!body) { app.ui.sheet = null; return ''; } }
  return `<div class="sheet-backdrop" data-act="closeSheet"></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">${body}</div>`;
}
