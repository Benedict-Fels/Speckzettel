/* Data format versions. Every stored state carries `schema`; older states are upgraded step by step.
   1 (no field): app 1.0.0, German codes (kuehl/vorrat/tk, Stk), fields name/ing/cat/mode/bought/seen/shelf, shop, learned.
   2: app 1.1.0, English codes and field names (spec section 2).
   3: app 1.2.0, one entry per pack: pack clocks (openedAt, bestBefore, confirmedAt, frozenAt, probablyGoneAt, profile),
      shelfDays null = catalog default, no snack field; catalogOverrides for own ingredients.
   4: app 1.3.0, big catalog: some ingredients renamed (singular, variety instead of own name), household + settings.
   5: app 1.4.0, recipe model (spec 2.3): summary, diet (null = from ingredients), times, icon, source, tags, createdAt,
      cookedAt; ingredients with optional/raw. Unedited starter recipes are replaced by their new version.
   6: app 1.5.0, shopping entries (spec 2.4): ingredient (known) or text (free reminder), doneAt, addedAt, reason.
   7: app 2.1.0, oils are one ingredient "Öl" with varieties (Oliven, Raps, Sonnenblumen); Zucchini, Aubergine, Kürbis
      are counted by weight; shopping entries carry a variety. Unedited starter recipes take the new version.
   8: app 2.3.0, loose produce on the shopping list in pieces (average weight from the catalog). */
export const SCHEMA = 8;

import {normalizeRecipe} from './recipe-model.js';
import {catalogFor, pieceWeight} from './catalog.js';
import {starterById, addNewStarters} from './starter-recipes.js';

const AREA = {kuehl: 'fridge', vorrat: 'pantry', tk: 'freezer'};
const unit1to2 = u => u === 'Stk' ? 'Stück' : u;

function v1to2(s) {
  return {
    schema: 2,
    demo: !!s.demo,
    items: (s.items || []).map(i => {
      const ingredient = i.ing || i.name;
      return {
        id: i.id, ingredient, variety: null, label: i.name && i.name !== ingredient ? i.name : null,
        area: AREA[i.cat] || 'pantry', tracking: i.mode || 'exact', amount: i.amount ?? 1, unit: unit1to2(i.unit || 'Stk'), level: i.level ?? 1,
        boughtAt: i.bought, seenAt: i.seen ?? i.bought, shelfDays: i.shelf ?? 14, snack: !!i.snack, source: 'manual',
      };
    }),
    recipes: (s.recipes || []).map(r => ({
      id: r.id, title: r.name, servings: r.servings || 2, origin: r.own ? 'own' : 'starter',
      ingredients: (r.ingredients || []).map(x => ({amount: x.amount ?? null, unit: x.unit ? unit1to2(x.unit) : null, name: x.name, variety: null})),
      steps: r.steps || [],
    })),
    shopping: (s.shop || []).map(x => ({id: x.id, name: x.name, amount: x.amount ?? null, unit: x.unit ? unit1to2(x.unit) : null, done: !!x.done})),
    aliases: Object.fromEntries(Object.entries(s.learned || {}).map(([k, v]) => [k, {ingredient: v.name, area: AREA[v.cat] || 'pantry', unit: unit1to2(v.unit || 'Stk')}])),
  };
}

function v2to3(s) {
  return {
    ...s, schema: 3,
    items: s.items.map(({snack, ...i}) => ({
      ...i, profile: null, bestBefore: null, openedAt: null, confirmedAt: null,
      frozenAt: i.area === 'freezer' ? i.boughtAt : null, probablyGoneAt: null,
    })),
    catalogOverrides: {},
  };
}

/* Catalog names changed in 1.3: old name -> [new name, variety]. */
export const RENAMED_1_3 = {'Zwiebeln': ['Zwiebel', null], 'Rote Linsen': ['Linsen', 'rot'], 'Gehackte Tomaten': ['Dosentomaten', null], 'Haferdrink': ['Pflanzendrink', 'Hafer']};
function v3to4(s) {
  const ren = (name, variety) => { const r = RENAMED_1_3[name]; return r ? [r[0], variety ?? r[1]] : [name, variety ?? null]; };
  return {
    ...s, schema: 4,
    household: {diet: null, onboarded: true},
    settings: {hintSoon: true, hintCheck: true, trackSnacks: false, installHintDismissed: false},
    items: s.items.map(i => { const [ingredient, variety] = ren(i.ingredient, i.variety); return {...i, ingredient, variety}; }),
    recipes: s.recipes.map(r => ({...r, ingredients: r.ingredients.map(x => { const [name, variety] = ren(x.name, x.variety); return {...x, name, variety}; })})),
    shopping: s.shopping.map(x => ({...x, name: ren(x.name)[0]})),
    aliases: Object.fromEntries(Object.entries(s.aliases || {}).map(([k, v]) => { const [ingredient, variety] = ren(v.ingredient, v.variety); return [k, {...v, ingredient, variety}]; })),
    catalogOverrides: Object.fromEntries(Object.entries(s.catalogOverrides || {}).map(([k, v]) => [ren(k)[0], v])),
  };
}

/* Starters could not be edited before 1.4, so a starter in the data is the old shipped version: take the new one, keep the history. */
function v4to5(s) {
  return {
    ...s, schema: 5,
    recipes: s.recipes.map(r => {
      const fresh = r.origin === 'starter' ? starterById(r.id) : null;
      return fresh ? {...fresh, cookedAt: r.cookedAt || []} : normalizeRecipe(r);
    }),
  };
}

/* Needs the catalog loaded (setCatalog) to tell ingredients from free text. */
function v5to6(s) {
  return {...s, schema: 6, shopping: (s.shopping || []).map(normalizeShopping)};
}
export function normalizeShopping(x) {
  const name = x.ingredient || x.text || x.name || '';
  const c = x.text ? null : catalogFor(name);
  return {id: x.id, ingredient: c ? c.name : null, variety: c ? (x.variety ?? null) : null, text: c ? null : name, amount: x.amount ?? null, unit: x.amount != null ? (x.unit || 'Stück') : null,
    done: !!x.done, doneAt: x.doneAt ?? null, addedAt: x.addedAt ?? null, reason: x.reason ?? null};
}

export const RENAMED_2_1 = {'Olivenöl': ['Öl', 'Oliven'], 'Rapsöl': ['Öl', 'Raps'], 'Sonnenblumenöl': ['Öl', 'Sonnenblumen']};
const BY_WEIGHT_2_1 = {Zucchini: 250, Aubergine: 300, 'Kürbis': 1200};
function v6to7(s) {
  const ren = (name, variety) => { const r = RENAMED_2_1[name]; return r ? [r[0], variety ?? r[1]] : [name, variety ?? null]; };
  return {
    ...s, schema: 7,
    items: s.items.map(i => {
      const [ingredient, variety] = ren(i.ingredient, i.variety);
      const out = {...i, ingredient, variety};
      const g = BY_WEIGHT_2_1[ingredient];
      if (g && i.tracking === 'exact' && i.unit === 'Stück') { out.amount = +(i.amount * g).toFixed(1); out.unit = 'g'; }
      return out;
    }),
    recipes: s.recipes.map(r => {
      const fresh = r.origin === 'starter' ? starterById(r.id) : null;
      if (fresh) return {...fresh, cookedAt: r.cookedAt || []};
      return {...r, ingredients: r.ingredients.map(x => { const [name, variety] = ren(x.name, x.variety); return {...x, name, variety}; })};
    }),
    shopping: (s.shopping || []).map(x => { const [ingredient, variety] = x.ingredient ? ren(x.ingredient, x.variety) : [null, null]; return {...x, ingredient, variety: variety ?? null}; }),
    aliases: Object.fromEntries(Object.entries(s.aliases || {}).map(([k, v]) => { const [ingredient, variety] = v.ingredient ? ren(v.ingredient, v.variety) : [v.ingredient, v.variety]; return [k, {...v, ingredient, variety}]; })),
    catalogOverrides: Object.fromEntries(Object.entries(s.catalogOverrides || {}).map(([k, v]) => [ren(k)[0], v])),
    receipts: (s.receipts || []).map(rc => ({...rc, lines: (rc.lines || []).map(l => { const [ingredient, variety] = l.ingredient ? ren(l.ingredient, l.variety) : [null, l.variety]; return {...l, ingredient, variety}; })})),
  };
}

function v7to8(s) {
  return {...s, schema: 8, shopping: (s.shopping || []).map(x => {
    const per = x.ingredient && !x.done ? pieceWeight(x.ingredient, x.variety) : null;
    return per && x.amount != null && (x.unit === 'g' || x.unit === 'ml') ? {...x, amount: +(x.amount / per).toFixed(2), unit: 'Stück'} : x;
  })};
}

/* Variety names that changed without a new data format (idempotent, runs on every load). 2.3.1: Paprikapulver "scharf" -> "rosenscharf". */
const VARIETY_RENAMES = {Paprikapulver: {scharf: 'rosenscharf'}};
function renameVarieties(s) {
  const fix = (name, x) => { const m = VARIETY_RENAMES[name]; if (m && x.variety && m[x.variety]) x.variety = m[x.variety]; };
  s.items.forEach(i => fix(i.ingredient, i));
  s.recipes.forEach(r => r.ingredients.forEach(i => fix(i.name, i)));
  s.shopping.forEach(x => fix(x.ingredient, x));
  Object.values(s.aliases).forEach(a => fix(a.ingredient, a));
}

const STEPS = {1: v1to2, 2: v2to3, 3: v3to4, 4: v4to5, 5: v5to6, 6: v6to7, 7: v7to8};

export const schemaOf = s => s.schema || 1;
export const looksLikeState = s => !!s && Array.isArray(s.items) && Array.isArray(s.recipes);

/* Returns a state in the current schema. Throws if the data is newer than this app. */
export function migrate(s) {
  let v = schemaOf(s);
  if (v > SCHEMA) throw new Error('newer');
  while (v < SCHEMA) { s = STEPS[v](s); v = schemaOf(s); }
  s.recipes = s.recipes.map(normalizeRecipe);
  s.receipts = Array.isArray(s.receipts) ? s.receipts : [];
  s.shopping = Array.isArray(s.shopping) ? s.shopping : [];
  s.aliases = s.aliases && typeof s.aliases === 'object' ? s.aliases : {};
  s.catalogOverrides = s.catalogOverrides && typeof s.catalogOverrides === 'object' ? s.catalogOverrides : {};
  s.household = {diet: null, onboarded: true, ...(s.household || {})};
  addNewStarters(s);   /* starters added in later versions; starterIds keeps deleted ones deleted */
  s.settings = {hintSoon: true, hintCheck: true, trackSnacks: false, installHintDismissed: false, theme: 'system', ...(s.settings || {})};
  renameVarieties(s);
  return s;
}
