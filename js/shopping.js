/* Shopping list logic (spec 12). An entry is either a known ingredient (can go into the pantry, merges with others)
   or free text ("Geschenkpapier", only a reminder). Amounts are kept exact; rounding happens only for display. */
import {uid} from './text.js';
import {now} from './clock.js';
import {key, catalogFor, groupOf, groupList} from './catalog.js';
import {addItem} from './pantry.js';
import {convert, fmt, COUNT_UNITS} from './units.js';
import {nf} from './text.js';

/* Display name of an entry. */
export const shopName = s => s.ingredient || s.text || '';

const sameThing = (s, name) => key(shopName(s)) === key(name);

/* Adds to the list. Merges with an open entry of the same ingredient, converting units where the catalog knows how
   (1 Dose Kichererbsen + 240 g = 2 Dosen). reason: {recipe: id} or {item: id}; recipes collect in reason.recipes.
   Returns the entry. */
export function addToShopping(state, name, amount, unit, reason = null) {
  const c = catalogFor(name);
  const ingredient = c ? c.name : null;
  amount = amount ?? null;
  unit = amount != null ? (unit || 'Stück') : null;
  const ex = state.shopping.find(s => !s.done && sameThing(s, name));
  if (ex) {
    if (amount != null) {
      if (ex.amount == null) { ex.amount = amount; ex.unit = unit; }
      else {
        const add = convert(amount, unit, ex.unit, c);
        if (add != null) ex.amount = +(ex.amount + add).toFixed(3);
        else {
          const back = convert(ex.amount, ex.unit, unit, c);
          if (back != null) { ex.amount = +(back + amount).toFixed(3); ex.unit = unit; }
          else return pushEntry(state, ingredient, name, amount, unit, reason);   /* "1 Bund" + "30 g" without a rule: two lines */
        }
      }
    }
    mergeReason(ex, reason);
    return ex;
  }
  return pushEntry(state, ingredient, name, amount, unit, reason);
}

function pushEntry(state, ingredient, name, amount, unit, reason) {
  const s = {id: uid(), ingredient, text: ingredient ? null : name, amount, unit, done: false, doneAt: null, addedAt: now(), reason: null};
  mergeReason(s, reason);
  state.shopping.push(s);
  return s;
}

function mergeReason(s, reason) {
  if (!reason) return;
  if (reason.recipe) {
    const r = s.reason && s.reason.recipes ? s.reason : {recipes: []};
    if (!r.recipes.includes(reason.recipe)) r.recipes.push(reason.recipe);
    s.reason = r;
  } else if (!s.reason) s.reason = reason;
}

export function setDone(s, done, t = now()) { s.done = done; s.doneAt = done ? t : null; }

/* Amount as shown on the list (spec 8.3/12.1): countable units rounded up to whole ones, g/ml as whole numbers plus
   the packs that means ("100 g (1 Pck.)"), spoons as packs. Exact amounts stay in the data. */
export function shoppingAmountText(s) {
  if (s.amount == null) return '';
  const c = s.ingredient ? catalogFor(s.ingredient) : null;
  const a = s.amount, u = s.unit;
  const packHint = () => {
    if (!c || !c.pack) return null;
    const inCat = convert(a, u, c.unit, c);
    if (inCat == null) return null;
    if (COUNT_UNITS.includes(c.unit)) return fmt(Math.max(1, Math.ceil(inCat - 1e-9)), c.unit);
    const n = Math.max(1, Math.ceil(inCat / c.pack - 1e-9));
    return `${n} Pck.`;
  };
  if (['EL', 'TL', 'Prise'].includes(u)) return packHint() || '';   /* "1 TL Kreuzkümmel": you buy the spice, not the spoon */
  if (COUNT_UNITS.includes(u)) return fmt(Math.max(1, Math.ceil(a - 1e-9)), u).replace(/ Stück$/, '');
  if (u === 'g' || u === 'ml') {
    const base = fmt(Math.round(a), u);
    const hint = packHint();
    return hint ? `${base} (${hint})` : base;
  }
  return `${nf(a)} ${u}`;
}

/* Open entries grouped in the fixed walk through the shop (spec 12.1, E14); free text under "Sonstiges". */
export function groupShopping(list) {
  const order = groupList().map(g => g.key);
  const byGroup = new Map();
  for (const s of list) {
    const g = s.ingredient ? groupOf(s.ingredient) : {key: 'other', label: 'Sonstiges', icon: '📝'};
    if (!byGroup.has(g.key)) byGroup.set(g.key, {...g, entries: []});
    byGroup.get(g.key).entries.push(s);
  }
  const pos = k => { const i = order.indexOf(k); return i < 0 ? order.length : i; };
  return [...byGroup.values()].sort((a, b) => pos(a.key) - pos(b.key));
}

/* Plain text of the open entries for copying or sharing. */
export function shoppingText(list) {
  const open = list.filter(s => !s.done);
  const lines = groupShopping(open).flatMap(g => g.entries.map(s => { const a = shoppingAmountText(s); return `– ${shopName(s)}${a ? `, ${a}` : ''}`; }));
  return ['Einkauf (Speckzettel)', ...lines].join('\n');
}

/* Proposal for "In den Vorrat" (spec 12.2): one row per ticked ingredient, editable before anything changes.
   kind packs: count × size (usual pack), amount: a total in the catalog unit, level: rough/"nur da" (refilled).
   Free-text entries are only reminders and are listed separately. */
export function stockPlan(state) {
  const done = state.shopping.filter(s => s.done);
  const rows = [], reminders = [];
  for (const s of done) {
    if (!s.ingredient) { reminders.push(s); continue; }
    const c = catalogFor(s.ingredient) || {};
    const base = {id: s.id, ingredient: c.name || s.ingredient, take: true};
    if (c.tracking && c.tracking !== 'exact') { rows.push({...base, kind: 'level'}); continue; }
    const unit = c.unit || s.unit || 'Stück';
    const inCat = s.amount != null ? convert(s.amount, s.unit, unit, c) : null;
    if (c.pack && !COUNT_UNITS.includes(unit)) {
      const count = inCat != null ? Math.max(1, Math.ceil(inCat / c.pack - 1e-9)) : 1;
      rows.push({...base, kind: 'packs', count, size: c.pack, unit});
    } else {
      const amount = inCat != null ? (COUNT_UNITS.includes(unit) ? Math.max(1, Math.ceil(inCat - 1e-9)) : Math.round(inCat)) : (c.pack || 1);
      rows.push({...base, kind: 'amount', amount, unit});
    }
  }
  return {rows, reminders};
}

/* Applies the (corrected) plan: packs into the pantry, all ticked entries off the list. Returns the number of rows added. */
export function applyStockPlan(state, plan) {
  let n = 0;
  for (const r of plan.rows) {
    if (!r.take) continue;
    if (r.kind === 'packs') { for (let k = 0; k < r.count; k++) addItem(state, {name: r.ingredient, amount: r.size, unit: r.unit, source: 'shopping'}); }
    else if (r.kind === 'amount') { if (r.amount > 0) addItem(state, {name: r.ingredient, amount: r.amount, unit: r.unit, source: 'shopping'}); else continue; }
    else addItem(state, {name: r.ingredient, source: 'shopping'});
    n++;
  }
  state.shopping = state.shopping.filter(s => !s.done);
  return n;
}

/* Ticked entries -> pantry in usual pack sizes, without corrections. Returns the number of list entries moved. */
export function shoppingToStock(state) {
  const n = state.shopping.filter(s => s.done).length;
  applyStockPlan(state, stockPlan(state));
  return n;
}

/* After a receipt was taken over (spec 12.3): entries for ingredients on the receipt are done – open ones and ticked ones.
   Returns the names removed. */
export function settleWithReceipt(state, ingredients) {
  const keys = new Set(ingredients.map(key));
  const hit = state.shopping.filter(s => s.ingredient && keys.has(key(s.ingredient)));
  state.shopping = state.shopping.filter(s => !hit.includes(s));
  return [...new Set(hit.map(shopName))];
}
