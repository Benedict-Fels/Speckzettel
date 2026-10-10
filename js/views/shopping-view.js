/* Tab "Einkauf": shopping list, tick off, move ticked items into the pantry. */
import {app} from '../app.js';
import {esc} from '../text.js';
import {fmt} from '../units.js';
import {header} from './components.js';

export function renderShopping() {
  const list = app.state.shopping;
  const open = list.filter(s => !s.done), done = list.filter(s => s.done);
  let h = header('Einkaufszettel', open.length ? `${open.length} offen` : 'Alles erledigt');
  h += `<form class="row" data-form="shopping"><input type="text" id="shopping-input" placeholder="z. B. 500 g Tofu oder Bananen" style="flex:1"><button class="btn primary" type="submit">Hinzufügen</button></form>`;
  const row = s => `<label class="shop-row ${s.done ? 'done' : ''}"><input type="checkbox" data-act="shoppingTick" data-v="${s.id}" ${s.done ? 'checked' : ''}><span class="shop-name">${esc(s.name)}</span><span class="muted num">${s.amount != null ? fmt(s.amount, s.unit) : ''}</span><button type="button" class="remove" data-act="shoppingDelete" data-v="${s.id}" aria-label="${esc(s.name)} entfernen">×</button></label>`;
  h += `<div class="items">${list.length ? [...open, ...done].map(row).join('') : '<div class="empty">Leer. Beim Kochen landen fehlende Zutaten automatisch hier.</div>'}</div>`;
  if (done.length) h += `<div class="panel"><p class="small">Abgehakt und eingekauft? Dann ab in den Vorrat, in üblichen Packungsgrößen.</p><div class="row"><button class="btn primary" data-act="shoppingToStock">${done.length} in den Vorrat übernehmen</button><button class="btn ghost small" data-act="shoppingClear">Abgehakte nur löschen</button></div></div>`;
  return h;
}
