/* Shopping list logic. */
import {uid} from './text.js';
import {key, catalogFor} from './catalog.js';
import {addItem} from './pantry.js';

/* Adds to the list; merges with an open entry of the same ingredient. Returns true if a new row was added. */
export function addToShopping(state, name, amount, unit) {
  const ex = state.shopping.find(s => !s.done && key(s.name) === key(name) && (s.unit === unit || s.amount == null || amount == null));
  if (ex) {
    if (amount != null) { ex.amount = (ex.unit === unit ? (ex.amount || 0) : 0) + amount; ex.unit = unit; }
    return false;
  }
  state.shopping.push({id: uid(), name, amount: amount ?? null, unit: amount != null ? unit : null, done: false});
  return true;
}

/* Ticked entries -> pantry, in usual pack sizes (one pack per pack bought). Returns the number of list entries moved. */
export function shoppingToStock(state) {
  const done = state.shopping.filter(s => s.done);
  for (const s of done) {
    const c = catalogFor(s.name) || {};
    const name = c.name || s.name;
    if (c.pack && (!s.amount || (s.unit || c.unit) === c.unit)) {
      const packs = s.amount ? Math.max(1, Math.ceil(s.amount / c.pack - 1e-9)) : 1;
      for (let n = 0; n < packs; n++) addItem(state, {name, amount: c.pack, unit: c.unit, source: 'shopping'});
    } else {
      addItem(state, {name, amount: s.amount || 1, unit: s.unit || c.unit || 'Stück', source: 'shopping'});
    }
  }
  state.shopping = state.shopping.filter(s => !s.done);
  return done.length;
}
