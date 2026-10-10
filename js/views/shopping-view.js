/* Tab "Einkauf" (spec 12): list grouped by the walk through the shop, ticked entries folded away,
   copy/share as text, and the check list before ticked entries go into the pantry. */
import {app} from '../app.js';
import {esc} from '../text.js';
import {fmt} from '../units.js';
import {shopName, shoppingAmountText, groupShopping} from '../shopping.js';
import {header} from './components.js';

function reasonText(s) {
  const ids = s.reason && s.reason.recipes;
  if (!ids || !ids.length) return '';
  const titles = ids.map(id => (app.state.recipes.find(r => r.id === id) || {}).title).filter(Boolean);
  return titles.length ? `für ${titles.join(', ')}` : '';
}

function row(s, icon) {
  const name = shopName(s), amount = shoppingAmountText(s), why = reasonText(s);
  return `<div class="shop-row ${s.done ? 'done' : ''}">
    <label class="shop-main"><input type="checkbox" data-act="shoppingTick" data-v="${s.id}" ${s.done ? 'checked' : ''} aria-label="${esc(name)} ${s.done ? 'wieder offen' : 'abhaken'}">
      <span class="group-icon" aria-hidden="true">${icon}</span>
      <span class="shop-name"><span>${esc(name)}</span>${why ? `<span class="shop-why small muted">${esc(why)}</span>` : ''}</span>
      <span class="shop-qty num">${esc(amount)}</span></label>
    <button type="button" class="remove" data-act="shoppingDelete" data-v="${s.id}" aria-label="${esc(name)} entfernen">×</button></div>`;
}

export function renderShopping() {
  const {state, ui} = app;
  const list = state.shopping;
  const open = list.filter(s => !s.done), done = list.filter(s => s.done);
  let h = header('Einkaufszettel', open.length ? `${open.length} offen` : done.length ? 'Alles abgehakt' : '');
  h += `<form class="add-line" data-form="shopping"><label class="sr-only" for="shopping-input">Auf den Zettel</label>
    <input type="text" id="shopping-input" placeholder="z. B. 500 g Tofu, Bananen" autocomplete="off" enterkeyhint="done"><button class="btn primary" type="submit" aria-label="Hinzufügen">+</button></form>`;
  if (!list.length) return h + `<div class="panel empty">Leer. Fehlendes aus Rezepten und Aufgebrauchtes aus dem Vorrat landen hier.</div>`;
  for (const g of groupShopping(open)) {
    h += `<div class="cat-head"><h3>${esc(g.label)}</h3><span class="small muted num">${g.entries.length}</span></div><div class="items">${g.entries.map(s => row(s, g.icon)).join('')}</div>`;
  }
  if (!open.length) h += `<div class="panel empty">Alles abgehakt.</div>`;
  if (done.length) {
    h += `<div class="gone"><button class="gone-head spread" data-act="toggleShopDone" aria-expanded="${!!ui.showShopDone}"><h3>Erledigt (${done.length})</h3><span class="muted">${ui.showShopDone ? '▾' : '▸'}</span></button>`;
    if (ui.showShopDone) h += `<div class="items">${done.map(s => row(s, '')).join('')}</div>`;
    h += `</div>`;
  }
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;
  h += `<div class="row">${done.length ? `<button class="btn primary" data-act="shoppingToStock">${done.length} in den Vorrat</button><button class="btn" data-act="shoppingClear">Erledigte löschen</button>` : ''}
    ${open.length ? `<button class="btn" data-act="shoppingCopy">Kopieren</button>${canShare ? '<button class="btn" data-act="shoppingShare">Teilen</button>' : ''}` : ''}</div>`;
  return h;
}

/* Sheet "In den Vorrat": ticked entries as packs, each correctable (spec 12.2). */
export function stockSheet(sh) {
  const {rows, reminders} = sh.plan;
  const n = rows.filter(r => r.take).length;
  const editor = (r, i) => {
    if (r.kind === 'level') return '<span class="small muted">wird aufgefüllt</span>';
    const value = r.kind === 'packs' ? r.count : r.amount;
    return `<div class="pack-amount"><div class="stepper"><button type="button" data-act="stockStep" data-v="${i}" data-d="-1" aria-label="weniger">−</button>
      <input type="number" id="stock-amount-${i}" data-stock-amount="${i}" value="${value}" min="0" step="any" inputmode="decimal" aria-label="${r.kind === 'packs' ? 'Packungen' : `Menge in ${esc(r.unit)}`}">
      <button type="button" data-act="stockStep" data-v="${i}" data-d="1" aria-label="mehr">+</button></div>
      <span class="muted">${r.kind === 'packs' ? `× ${esc(fmt(r.size, r.unit))}` : esc(r.unit === 'Stück' ? 'Stück' : r.unit)}</span></div>`;
  };
  return `<div class="sheet-head"><div><h2 id="sheet-title">In den Vorrat</h2><p class="muted small">So kommt es rein. Mengen anpassen oder abwählen, was nicht gekauft wurde.</p></div>
      <button class="icon-btn" data-act="closeSheet" aria-label="Schließen">✕</button></div>
    ${rows.length ? `<div class="cook-rows">${rows.map((r, i) => `<div class="cook-row${r.take ? '' : ' muted'}">
      <label class="check"><input type="checkbox" data-stock-take="${i}" ${r.take ? 'checked' : ''}> <b>${esc(r.ingredient)}</b></label>${r.take ? editor(r, i) : ''}</div>`).join('')}</div>` : ''}
    ${reminders.length ? `<p class="small muted">Nur vom Zettel genommen: ${esc(reminders.map(shopName).join(', '))}</p>` : ''}
    <div class="row"><button class="btn primary" data-act="stockApply">${n ? `${n} in den Vorrat` : 'Nur vom Zettel nehmen'}</button><button class="btn ghost" data-act="closeSheet">Abbrechen</button></div>`;
}
