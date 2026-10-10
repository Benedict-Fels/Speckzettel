/* Shopping list logic (spec 12). An entry is either a known ingredient (can go into the pantry, merges with others)
   or free text ("Geschenkpapier", only a reminder). Amounts are kept exact; rounding happens only for display. */
import {uid} from './text.js';
import {now} from './clock.js';
import {key, catalogFor, groupOf, groupList, resolve, pieceWeight} from './catalog.js';
import {addItem, stockFor, levelText, packStatus} from './pantry.js';
import {AREAS} from './areas.js';
import {convert, fmt, COUNT_UNITS} from './units.js';
import {nf} from './text.js';

/* Name of an entry; shopLabel adds the variety and uses the plural unless exactly one piece is wanted (11.10.2026). */
export const shopName = s => s.ingredient || s.text || '';
export function shopLabel(s) {
  const c = s.ingredient ? catalogFor(s.ingredient) : null;
  const one = s.amount != null && COUNT_UNITS.includes(s.unit) && Math.ceil(s.amount - 1e-9) <= 1;
  const name = c && c.plural && !one ? c.plural : shopName(s);
  return s.variety ? `${name} (${s.variety})` : name;
}

const sameThing = (s, name, variety) => key(shopName(s)) === key(name) && (s.variety || null) === (variety || null);
const WEIGHT = ['g', 'ml'];

/* Adds to the list. Merges with an open entry of the same ingredient and variety, converting units where the catalog
   knows how (1 Dose Kichererbsen + 240 g = 2 Dosen). Loose produce is stored in pieces, using the catalog's average weight
   ("200 g Tomaten" -> 2 Tomaten); pieces of something packed by weight are stored as weight ("2 Cherrytomaten" -> 30 g). reason: {recipe: id} or {item: id}; recipes collect in reason.recipes. Returns the entry. */
export function addToShopping(state, name, amount, unit, reason = null, variety = null) {
  const c = catalogFor(name);
  const ingredient = c ? c.name : null;
  if (!variety && c) { const r = resolve(name); variety = r && r.variety || null; }
  amount = amount ?? null;
  unit = amount != null ? (unit || 'Stück') : null;
  const piece = c ? pieceWeight(c.name, variety) : null;
  if (c && amount != null && piece && unit !== 'Stück') {
    const n = convert(amount, unit, 'Stück', c);
    if (n != null) { amount = +n.toFixed(2); unit = 'Stück'; }
  } else if (c && amount != null && !piece && WEIGHT.includes(c.unit) && COUNT_UNITS.includes(unit)) {
    const w = convert(amount, unit, c.unit, c);
    if (w != null) { amount = +w.toFixed(1); unit = c.unit; }
  }
  const ex = state.shopping.find(s => !s.done && sameThing(s, name, ingredient ? variety : null));
  if (ex) {
    if (amount != null) {
      if (ex.amount == null) { ex.amount = amount; ex.unit = unit; }
      else {
        const add = convert(amount, unit, ex.unit, c);
        if (add != null) ex.amount = +(ex.amount + add).toFixed(3);
        else {
          const back = convert(ex.amount, ex.unit, unit, c);
          if (back != null) { ex.amount = +(back + amount).toFixed(3); ex.unit = unit; }
          else return pushEntry(state, ingredient, name, amount, unit, reason, variety);   /* "1 Bund" + "30 g" without a rule: two lines */
        }
      }
    }
    mergeReason(ex, reason);
    return ex;
  }
  return pushEntry(state, ingredient, name, amount, unit, reason, variety);
}

function pushEntry(state, ingredient, name, amount, unit, reason, variety) {
  const s = {id: uid(), ingredient, variety: ingredient ? variety || null : null, text: ingredient ? null : name, amount, unit, done: false, doneAt: null, addedAt: now(), reason: null};
  mergeReason(s, reason);
  state.shopping.push(s);
  return s;
}

/* "−" / "+" on a list entry: weight in 50 g (ml) steps (also packed goods, 11.10.2026), pieces one by one. Below the first step the amount is removed
   ("nur merken"). Returns the new amount. */
export function stepShopping(s, dir) {
  const c = s.ingredient ? catalogFor(s.ingredient) : null;
  if (s.amount == null) {
    const unit = c && !pieceWeight(c.name, s.variety) ? c.unit : 'Stück';
    if (dir < 0) return null;
    s.unit = unit; s.amount = WEIGHT.includes(unit) ? (c && c.pack && !c.loose ? c.pack : 50) : 1;
    return s.amount;
  }
  if (['EL', 'TL', 'Prise'].includes(s.unit) && c) { const w = convert(s.amount, s.unit, c.unit, c); if (w != null) { s.amount = w; s.unit = c.unit; } }
  const step = WEIGHT.includes(s.unit) ? 50 : 1;
  const base = WEIGHT.includes(s.unit) ? Math.round(s.amount / step) * step : Math.ceil(s.amount - 1e-9);
  const next = dir > 0 ? (base > s.amount + 1e-9 ? base : base + step) : (base < s.amount - 1e-9 ? base : base - step);
  if (next <= 0) { s.amount = null; s.unit = null; return null; }
  s.amount = next;
  return next;
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
    if (!c || !c.pack || c.loose) return null;
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

/* Cross-check against the pantry (11.10.2026): what of this is still at home, by place ("400 g im Kühlschrank,
   1 Pck. im Tiefkühler"); '' if nothing. Staples (Salz) are not checked. */
export function stockNote(items, name) {
  const c = catalogFor(name);
  if (!c || c.staple) return '';
  const packs = stockFor(items, name);
  if (!packs.length) return '';
  const byArea = new Map();
  for (const i of packs) { if (!byArea.has(i.area)) byArea.set(i.area, []); byArea.get(i.area).push(i); }
  const parts = [];
  for (const [area, list] of byArea) {
    const exact = list.filter(i => i.tracking === 'exact' && i.amount != null);
    const what = [];
    if (exact.length) {
      const unit = exact[0].unit;
      const sum = exact.reduce((t, i) => t + (convert(i.amount, i.unit, unit, c) ?? 0), 0);
      what.push(fmt(+sum.toFixed(2), unit));
    }
    const rough = list.filter(i => i.tracking === 'rough');
    if (rough.length) what.push(levelText(Math.max(...rough.map(i => i.level))));
    if (!what.length) what.push('da');
    const vs = [...new Set(list.map(i => i.variety).filter(Boolean))];
    const over = list.some(i => packStatus(i).phase === 'over');
    parts.push(`${what.join(' + ')}${vs.length ? ` (${vs.join('/')})` : ''} im ${AREAS[area] || area}${over ? ' (MHD drüber)' : ''}`);
  }
  return parts.join(', ');
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
  const lines = groupShopping(open).flatMap(g => g.entries.map(s => { const a = shoppingAmountText(s); return `– ${shopLabel(s)}${a ? `, ${a}` : ''}`; }));
  return ['Einkauf (Speckzettel)', ...lines].join('\n');
}

/* Proposal for "In den Vorrat" (spec 12.2): one row per ticked ingredient, editable before anything changes.
   kind packs: count × size (usual pack), amount: a total in the catalog unit, pieces: loose produce counted in pieces
   (stored as pieces × per), level: rough/"nur da" (refilled).
   Free-text entries are only reminders and are listed separately. */
export function stockPlan(state) {
  const done = state.shopping.filter(s => s.done);
  const rows = [], reminders = [];
  for (const s of done) {
    if (!s.ingredient) { reminders.push(s); continue; }
    const c = catalogFor(s.ingredient) || {};
    const base = {id: s.id, ingredient: c.name || s.ingredient, variety: s.variety || null, take: true};
    if (c.tracking && c.tracking !== 'exact') { rows.push({...base, kind: 'level'}); continue; }
    const unit = c.unit || s.unit || 'Stück';
    const inCat = s.amount != null ? convert(s.amount, s.unit, unit, c) : null;
    const per = pieceWeight(base.ingredient, s.variety);
    if (per && (s.amount == null || s.unit === 'Stück')) {
      /* loose produce in pieces; into the pantry as weight (pieces × average) */
      rows.push({...base, kind: 'pieces', amount: s.amount != null ? Math.max(1, Math.ceil(s.amount - 1e-9)) : 1, unit: 'Stück', per, storeUnit: unit});
      continue;
    }
    if (c.pack && !COUNT_UNITS.includes(unit) && !c.loose) {
      const count = inCat != null ? Math.max(1, Math.ceil(inCat / c.pack - 1e-9)) : 1;
      rows.push({...base, kind: 'packs', count, size: c.pack, sizes: c.sizes || null, unit});
    } else {
      /* loose produce by weight: rounded up to 50 g, what you would put on the scale */
      const amount = inCat != null ? (COUNT_UNITS.includes(unit) ? Math.max(1, Math.ceil(inCat - 1e-9)) : c.loose ? Math.max(50, Math.ceil(inCat / 50 - 1e-9) * 50) : Math.round(inCat)) : (c.pack || 1);
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
    const v = r.variety || null;
    if (r.kind === 'packs') { for (let k = 0; k < r.count; k++) addItem(state, {name: r.ingredient, variety: v, amount: r.size, unit: r.unit, source: 'shopping'}); }
    else if (r.kind === 'pieces') { if (r.amount > 0) addItem(state, {name: r.ingredient, variety: v, amount: +(r.amount * r.per).toFixed(1), unit: r.storeUnit, source: 'shopping'}); else continue; }
    else if (r.kind === 'amount') { if (r.amount > 0) addItem(state, {name: r.ingredient, variety: v, amount: r.amount, unit: r.unit, source: 'shopping'}); else continue; }
    else addItem(state, {name: r.ingredient, variety: v, source: 'shopping'});
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
