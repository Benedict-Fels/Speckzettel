/* Recipe logic: scaling, check against the pantry (spec 10), ranking and filters (8.1), cooking with preview (11). */
import {now, daysBetween} from './clock.js';
import {fmt, convert, COUNT_UNITS} from './units.js';
import {catalogFor} from './catalog.js';
import {norm} from './text.js';
import {stockFor, isShaky, packStatus, expiryOf, levelText, inSoonBox} from './pantry.js';
import {activeTime} from './recipe-model.js';

export function scaleAmount(a, u, f) {
  const x = a * f;
  return COUNT_UNITS.includes(u) ? Math.ceil(x * 2) / 2 : Math.round(x * 10) / 10;
}

const isOver = i => packStatus(i).phase === 'over';
const dayText = n => `${n} ${n === 1 ? 'Tag' : 'Tagen'}`;
export const ingredientLabel = ing => ing.variety ? `${ing.name} (${ing.variety})` : ing.name;

/* Packs a recipe line may use. Raw use (Tiramisu, Mayo): packs past their date are left out (spec 10.1). */
function usableStock(items, ing) {
  const all = stockFor(items, ing.name);
  if (!ing.raw) return {stock: all, tooOld: []};
  return {stock: all.filter(i => !isOver(i)), tooOld: all.filter(isOver)};
}

/* Why a "schau nach": past the date (with how long) or not seen for a while. */
function shakyNote(stock) {
  const over = Math.max(0, ...stock.map(i => { const s = packStatus(i); return s.phase === 'over' && !s.confirmed ? s.overDays : 0; }));
  return over ? {over: true, note: `MHD seit ${dayText(over)} drüber – riech mal`} : {over: false, note: 'länger nicht gesehen – schau lieber nach'};
}

/* Status of one line from the usable stock: ok / check / buy with an explanation. */
function judge(base, c, need, unit) {
  const {stock} = base;
  if (!stock.length) return {...base, status: 'buy', note: 'nicht im Vorrat', missing: need, missingUnit: unit};
  const shaky = stock.some(isShaky);
  const sn = shaky ? shakyNote(stock) : null;
  const nonExact = stock.filter(i => i.tracking !== 'exact');
  if (nonExact.length) {
    const lvl = Math.max(...nonExact.map(i => i.tracking === 'rough' ? i.level : 1));
    if (lvl <= 0) return {...base, status: 'buy', note: 'leer', missing: null};
    if (lvl <= .25) return {...base, status: 'check', fix: 'low', note: 'fast leer – schau lieber nach'};
    if (shaky) return {...base, status: 'check', fix: 'shaky', ...sn};
    return {...base, status: 'ok', note: nonExact[0].tracking === 'rough' ? levelText(lvl) : 'da'};
  }
  if (need == null) return shaky ? {...base, status: 'check', fix: 'shaky', ...sn} : {...base, status: 'ok', note: 'da'};
  const inNeedUnit = i => convert(i.amount, i.unit, unit, c);
  const comparable = stock.filter(i => inNeedUnit(i) != null);
  if (!comparable.length) return {...base, status: 'check', note: `im Vorrat als ${stock.map(i => fmt(i.amount, i.unit)).join(', ')} – passt das?`};
  const have = +comparable.reduce((s, i) => s + inNeedUnit(i), 0).toFixed(2);
  const haveText = fmt(have, unit);
  if (have >= need - 1e-9) return shaky ? {...base, status: 'check', fix: 'shaky', over: sn.over, note: `${haveText} da – ${sn.note}`} : {...base, status: 'ok', note: `${haveText} da`};
  if (have > 0) return {...base, status: 'buy', note: `nur ${haveText} da`, missing: +(need - have).toFixed(2), missingUnit: unit};
  return {...base, status: 'buy', note: 'aufgebraucht', missing: need, missingUnit: unit};
}

/* One recipe line against the pantry. Status ok / check / buy, or "optional" for an optional line that is missing
   (it never counts as missing and never goes to the shopping list on its own). */
export function checkIngredient(items, ing, factor) {
  const unit = ing.unit || 'Stück';
  const need = ing.amount != null ? scaleAmount(ing.amount, unit, factor) : null;
  const c = catalogFor(ing.name);
  const label = need != null ? fmt(need, unit) : 'nach Geschmack';
  const head = {ing, need, unit, label, optional: !!ing.optional, raw: !!ing.raw};
  if (c && c.staple) return {...head, stock: [], staple: true, status: 'ok', note: 'gehört zur Grundausstattung'};
  const {stock, tooOld} = usableStock(items, ing);
  let row = judge({...head, stock}, c, need, unit);
  if (tooOld.length && row.status === 'buy') {
    const plural = c && c.plural && c.name === ing.name ? c.plural : null;
    const subject = plural ? `${plural} sind` : `${ingredientLabel(ing)} ist`;
    row = {...row, rawOver: true, note: stock.length ? `${row.note}, der Rest ist drüber – nicht roh verwenden` : `${subject} drüber – für dieses Rezept nicht roh verwenden`};
  }
  if (row.optional && row.status === 'buy') return {...row, status: 'optional', note: `${row.note} – geht auch ohne`, missing: null};
  return row;
}

export function recipeCheck(items, r, persons) {
  const f = persons / r.servings;
  return r.ingredients.map(ing => checkIngredient(items, ing, f));
}

const lastCooked = r => (r.cookedAt && r.cookedAt.length ? Math.max(...r.cookedAt) : null);
const soonText = s => s.phase === 'over' ? 'drüber' : s.daysLeft <= 0 ? 'heute' : s.daysLeft === 1 ? 'morgen' : `${s.daysLeft} T.`;

/* Overview numbers for a card, at the recipe's own servings. Staples and optional lines do not count.
   score (spec 8.1) = coverage + 0.15 per ingredient that should be used up soon (max 2) − 0.05 if cooked in the last 3 days. */
export function recipeScore(items, r, t = now()) {
  const rows = recipeCheck(items, r, r.servings).filter(x => !x.staple && !x.optional);
  const ok = rows.filter(x => x.status === 'ok').length, ch = rows.filter(x => x.status === 'check').length;
  const missing = rows.filter(x => x.status === 'buy');
  const over = rows.filter(x => x.over || x.rawOver).length;
  const soonMap = new Map();
  for (const x of rows) for (const i of x.stock) {
    const s = packStatus(i, t);
    if (!inSoonBox(s) || soonMap.has(x.ing.name)) continue;
    soonMap.set(x.ing.name, {name: x.ing.name, when: soonText(s), daysLeft: s.daysLeft});
  }
  const soon = [...soonMap.values()].sort((a, b) => a.daysLeft - b.daysLeft);
  const pct = rows.length ? (ok + ch * .6) / rows.length : 1;
  const last = lastCooked(r);
  const recent = last != null && daysBetween(last, t) <= 3;
  return {rows, ok, ch, over, total: rows.length, pct, soon, missing: missing.map(x => ingredientLabel(x.ing)), buy: missing.length,
    score: pct + .15 * Math.min(soon.length, 2) - (recent ? .05 : 0), lastCooked: last};
}

/* Filters of the overview (spec 8.1). Several can be on at once; all must match. */
export const RECIPE_FILTERS = {cookable: 'Kochbar', quick: '≤ 30 Min', longAgo: 'Lange nicht gekocht'};
export const LONG_AGO_DAYS = 30;
export function matchesFilters(r, s, filters = [], query = '', t = now()) {
  if (filters.includes('cookable') && s.buy > 0) return false;
  if (filters.includes('quick') && !(activeTime(r) > 0 && activeTime(r) <= 30)) return false;
  if (filters.includes('longAgo') && s.lastCooked != null && daysBetween(s.lastCooked, t) <= LONG_AGO_DAYS) return false;
  const q = norm(query);
  if (q && !norm([r.title, r.summary, ...r.ingredients.map(x => `${x.name} ${x.variety || ''}`)].join(' ')).includes(q)) return false;
  return true;
}

/* Strictest diet a recipe fits: vegan < vegetarian < all, from the catalog entries of its ingredients. */
const DIET_RANK = {vegan: 0, vegetarian: 1, all: 2};
export function suggestedDiet(r) {
  let rank = 0;
  for (const ing of r.ingredients) { const c = catalogFor(ing.name); if (c && DIET_RANK[c.diet] > rank) rank = DIET_RANK[c.diet]; }
  return Object.keys(DIET_RANK)[rank];
}
/* The recipe's own setting wins over the suggestion. */
export const recipeDiet = r => (r.diet && DIET_RANK[r.diet] != null ? r.diet : suggestedDiet(r));
export const fitsDiet = (r, diet) => !diet || diet === 'all' || diet === 'none' || DIET_RANK[recipeDiet(r)] <= DIET_RANK[diet];

/* ---- "Gekocht" (spec 11): first a plan the user can correct, then apply it ---- */

/* Order for deducting: the pack that expires first goes first; packs without a clock: oldest first. */
const expiresAt = i => { const e = packStatus(i).profile === 'perishable' ? expiryOf(i) : null; return e ? e.expiry : Infinity; };
const fifo = (a, b) => expiresAt(a) - expiresAt(b) || a.boughtAt - b.boughtAt;

/* One row per recipe line:
   kind staple (nothing happens), none (nothing in stock), rough (level before/after), flag (used up? default no),
   exact (amount to take in `unit`, from packs `packIds` in that order; have = what is there). */
export function planCook(items, r, persons) {
  const f = persons / r.servings;
  return r.ingredients.map((ing, n) => {
    const name = ingredientLabel(ing);
    const c = catalogFor(ing.name);
    const base = {n, name, ingredient: ing.name, optional: !!ing.optional};
    if (c && c.staple) return {...base, kind: 'staple'};
    const {stock} = usableStock(items, ing);
    if (!stock.length) return {...base, kind: 'none'};
    const seen = stock.map(i => i.id);
    const rough = stock.find(i => i.tracking === 'rough');
    if (rough) {
      const step = ['EL', 'TL', 'Prise'].includes(ing.unit) || ing.amount == null ? .1 : .25;
      return {...base, kind: 'rough', seen, itemId: rough.id, before: rough.level, after: Math.max(0, +(rough.level - step).toFixed(2))};
    }
    const exact = stock.filter(i => i.tracking === 'exact');
    if (!exact.length) return {...base, kind: 'flag', seen, itemIds: stock.map(i => i.id), gone: false};
    const unit = (c && exact.some(i => i.unit === c.unit) ? c.unit : exact[0].unit);
    const pool = exact.filter(i => convert(i.amount, i.unit, unit, c) != null).sort(fifo);
    const have = +pool.reduce((s, i) => s + convert(i.amount, i.unit, unit, c), 0).toFixed(2);
    const recipeUnit = ing.unit || 'Stück';
    const need = ing.amount != null ? scaleAmount(ing.amount, recipeUnit, f) : null;
    const needHere = need != null ? convert(need, recipeUnit, unit, c) : null;
    const use = needHere != null ? +Math.min(have, needHere).toFixed(2) : 0;
    const hint = need == null ? 'nach Geschmack – trag ein, wie viel weg ist' : needHere == null ? `Rezept: ${fmt(need, recipeUnit)} – wie viel ist weg?` : null;
    return {...base, kind: 'exact', seen, unit, have, use, packIds: pool.map(i => i.id), hint};
  });
}

/* Applies a (possibly corrected) plan. Partly used packs count as opened; empty packs disappear.
   Returns {changed: names, emptied: ingredients with nothing left}. */
export function applyCook(state, r, plan, t = now()) {
  const byId = id => state.items.find(i => i.id === id);
  const changed = [], emptied = [], drop = new Set();
  for (const row of plan) {
    (row.seen || []).forEach(id => { const i = byId(id); if (i) i.seenAt = t; });
    if (row.kind === 'rough') {
      const i = byId(row.itemId); if (!i) continue;
      if (Math.abs(i.level - row.after) > 1e-9) changed.push(row.name);
      i.level = row.after;
      if (i.level <= 0) drop.add(i.id);
    } else if (row.kind === 'flag' && row.gone) {
      row.itemIds.forEach(id => drop.add(id)); changed.push(row.name);
    } else if (row.kind === 'exact' && row.use > 0) {
      const c = catalogFor(row.ingredient);
      let left = row.use;
      for (const id of row.packIds) {
        const i = byId(id);
        if (!i || left <= 1e-9) continue;
        const have = convert(i.amount, i.unit, row.unit, c);
        const take = Math.min(have, left);
        left -= take;
        i.amount = +Math.max(0, i.amount - convert(take, row.unit, i.unit, c)).toFixed(2);
        if (i.amount <= .001) drop.add(i.id);
        else if (take > 0 && !i.openedAt && i.area !== 'freezer') i.openedAt = t;
      }
      changed.push(row.name);
    }
  }
  state.items = state.items.filter(i => !drop.has(i.id) && (i.tracking !== 'exact' || i.amount > .001));
  for (const row of plan) {
    if (!['rough', 'flag', 'exact'].includes(row.kind)) continue;
    if (!stockFor(state.items, row.ingredient).length && !emptied.includes(row.ingredient)) emptied.push(row.ingredient);
  }
  if (Array.isArray(r.cookedAt)) r.cookedAt.push(t); else r.cookedAt = [t];
  return {changed, emptied};
}

/* "Gekocht" in one go, without corrections. Returns the names that changed. */
export function cook(state, r, persons) {
  return applyCook(state, r, planCook(state.items, r, persons)).changed;
}

/* What "Auf den Einkaufszettel" offers (spec 8.2): missing lines pre-ticked, missing optional lines not ticked,
   nothing that is already open on the list. n = index of the recipe line. */
export function shoppingCandidates(rows, isListed = () => false) {
  return rows.map((x, n) => ({x, n})).filter(({x}) => (x.status === 'buy' || x.status === 'optional') && !isListed(x.ing.name))
    .map(({x, n}) => {
      const optional = x.status === 'optional';
      const amount = optional ? x.need : x.missing;
      return {n, name: x.ing.name, label: ingredientLabel(x.ing), amount: amount ?? null, unit: amount != null ? (optional ? x.unit : x.missingUnit) : null, optional, checked: !optional};
    });
}
