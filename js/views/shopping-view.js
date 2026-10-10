/* Tab "Einkauf" (spec 12): list grouped by the walk through the shop, ticked entries folded away,
   copy/share as text, and the check list before ticked entries go into the pantry. */
import {app} from '../app.js';
import {esc} from '../text.js';
import {fmt} from '../units.js';
import {shopName, shopLabel, shoppingAmountText, groupShopping, stockNote} from '../shopping.js';
import {iconFor, searchCatalog} from '../catalog.js';
import {iconOf} from '../recipe-icons.js';
import {header} from './components.js';

/* Recipes an entry is for: their symbols, tappable (11.10.2026: replaces the "für …" line). */
function reasonIcons(s) {
  const ids = (s.reason && s.reason.recipes) || [];
  return ids.map(id => app.state.recipes.find(r => r.id === id)).filter(Boolean).slice(0, 3)
    .map(r => `<button type="button" class="shop-recipe" data-act="openRecipe" data-v="${esc(r.id)}" title="für ${esc(r.title)}" aria-label="für ${esc(r.title)}">${iconOf(r.icon)}</button>`).join('');
}

function row(s) {
  const label = shopLabel(s), amount = shoppingAmountText(s);
  const editing = app.ui.shopEdit === s.id;
  const icon = s.ingredient ? iconFor(s.ingredient) : '📝';
  const have = !s.done && s.ingredient ? stockNote(app.state.items, s.ingredient) : '';
  const qty = s.done ? (amount ? `<span class="shop-qty num">${esc(amount)}</span>` : '')
    : `<button type="button" class="shop-qty num${amount ? '' : ' empty'}" data-act="shopEdit" data-v="${s.id}" aria-label="Menge ${esc(label)} ändern" aria-expanded="${editing}">${amount ? esc(amount) : '＋'}</button>`;
  let h = `<div class="shop-row ${s.done ? 'done' : ''}${editing ? ' editing' : ''}">
    <input type="checkbox" id="shop-cb-${s.id}" data-act="shoppingTick" data-v="${s.id}" ${s.done ? 'checked' : ''} aria-label="${esc(label)} ${s.done ? 'wieder offen' : 'abhaken'}">
    <label class="group-icon" for="shop-cb-${s.id}" aria-hidden="true">${icon}</label>
    <div class="shop-body"><label class="shop-name" for="shop-cb-${s.id}">${esc(label)}</label>${qty}${have ? `<span class="shop-have small">🏠 noch da: ${esc(have)}</span>` : ''}</div>
    <span class="shop-recipes">${reasonIcons(s)}</span>
    <button type="button" class="remove" data-act="shoppingDelete" data-v="${s.id}" aria-label="${esc(label)} entfernen">×</button></div>`;
  if (editing) h += `<div class="shop-edit"><div class="stepper"><button type="button" data-act="shopStep" data-v="${s.id}" data-d="-1" aria-label="weniger">−</button>
      <span class="num">${amount ? esc(amount) : 'ohne Menge'}</span><button type="button" data-act="shopStep" data-v="${s.id}" data-d="1" aria-label="mehr">+</button></div>
      <button type="button" class="btn small" data-act="shopEdit" data-v="${s.id}">Fertig</button></div>`;
  return h;
}

/* Suggestions from the catalog for the last entry being typed ("500 g Tom" -> Tomate). Tapping one adds it with its usual
   amount, which can then be changed (11.10.2026). */
const lastPart = q => (q || '').split(/,\s*|;/).pop().replace(/^\s*[\d.,½¼¾]+\s*(g|kg|ml|l|stk|stück|dose|dosen|pck|packung|bund|glas)?\.?\s*/i, '').trim();
export function shopSuggestions(q) {
  const hits = searchCatalog(lastPart(q), 8);
  return hits.map(h => {
    const label = h.variety ? `${h.name} (${h.variety})` : h.name;
    return `<button type="button" class="suggest-chip" data-act="shopSuggest" data-v="${esc(h.name)}" data-variety="${esc(h.variety || '')}"><span aria-hidden="true">${iconFor(h.name)}</span>${esc(label)}</button>`;
  }).join('');
}

export function renderShopping() {
  const {state, ui} = app;
  const list = state.shopping;
  const open = list.filter(s => !s.done), done = list.filter(s => s.done);
  let h = header('Einkaufszettel', open.length ? `${open.length} offen` : done.length ? 'Alles abgehakt' : '');
  h += `<form class="add-line" data-form="shopping"><label class="sr-only" for="shopping-input">Auf den Zettel</label>
    <input type="text" id="shopping-input" placeholder="Tippen: z. B. Tom… oder 500 g Tofu" autocomplete="off" enterkeyhint="done" value="${esc(ui.shopQuery || '')}"><button class="btn primary" type="submit" aria-label="Hinzufügen">+</button></form>
    <div class="suggest" id="shop-suggest">${shopSuggestions(ui.shopQuery)}</div>`;
  if (!list.length) return h + `<div class="panel empty">Leer. Fehlendes aus Rezepten und Aufgebrauchtes aus dem Vorrat landen hier.</div>`;
  for (const g of groupShopping(open)) {
    h += `<div class="cat-head"><h3>${esc(g.label)}</h3><span class="small muted num">${g.entries.length}</span></div><div class="items">${g.entries.map(row).join('')}</div>`;
  }
  if (!open.length) h += `<div class="panel empty">Alles abgehakt.</div>`;
  if (done.length) {
    h += `<div class="gone"><button class="gone-head spread" data-act="toggleShopDone" aria-expanded="${!!ui.showShopDone}"><h3>Erledigt (${done.length})</h3><span class="muted">${ui.showShopDone ? '▾' : '▸'}</span></button>`;
    if (ui.showShopDone) h += `<div class="items">${done.map(row).join('')}</div>`;
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
      <span class="muted">${r.kind === 'packs' ? `× ${esc(fmt(r.size, r.unit))}` : r.kind === 'pieces' ? `Stück <span class="num">(≈ ${esc(fmt(r.amount * r.per, r.storeUnit))})</span>` : esc(r.unit)}</span></div>
      ${r.kind === 'packs' && r.sizes ? `<div class="seg" role="group" aria-label="Größe">${r.sizes.map(z => `<button type="button" class="${z === r.size ? 'on' : ''}" data-act="stockSize" data-v="${i}" data-s="${z}">${esc(fmt(z, r.unit))}</button>`).join('')}</div>` : ''}`;
  };
  return `<div class="sheet-head"><div><h2 id="sheet-title">In den Vorrat</h2><p class="muted small">So kommt es rein. Mengen anpassen oder abwählen, was nicht gekauft wurde.</p></div>
      <button class="icon-btn" data-act="closeSheet" aria-label="Schließen">✕</button></div>
    ${rows.length ? `<div class="cook-rows">${rows.map((r, i) => `<div class="cook-row${r.take ? '' : ' muted'}">
      <label class="check"><input type="checkbox" data-stock-take="${i}" ${r.take ? 'checked' : ''}> <b>${esc(r.variety ? `${r.ingredient} (${r.variety})` : r.ingredient)}</b></label>${r.take ? editor(r, i) : ''}</div>`).join('')}</div>` : ''}
    ${reminders.length ? `<p class="small muted">Nur vom Zettel genommen: ${esc(reminders.map(shopName).join(', '))}</p>` : ''}
    <div class="row"><button class="btn primary" data-act="stockApply">${n ? `${n} in den Vorrat` : 'Nur vom Zettel nehmen'}</button><button class="btn ghost" data-act="closeSheet">Abbrechen</button></div>`;
}
