/* Data format versions. Every stored state carries `schema`; older states are upgraded step by step.
   1 (no field): app 1.0.0, German codes (kuehl/vorrat/tk, Stk), fields name/ing/cat/mode/bought/seen/shelf, shop, learned.
   2: app 1.1.0, English codes and field names (spec section 2).
   3: app 1.2.0, one entry per pack: pack clocks (openedAt, bestBefore, confirmedAt, frozenAt, probablyGoneAt, profile),
      shelfDays null = catalog default, no snack field; catalogOverrides for own ingredients.
   4: app 1.3.0, big catalog: some ingredients renamed (singular, variety instead of own name), household + settings.
   5: app 1.4.0, recipe model (spec 2.3): summary, diet (null = from ingredients), times, icon, source, tags, createdAt,
      cookedAt; ingredients with optional/raw. Unedited starter recipes are replaced by their new version. */
export const SCHEMA = 5;

import {normalizeRecipe} from './recipe-model.js';
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

const STEPS = {1: v1to2, 2: v2to3, 3: v3to4, 4: v4to5};

export const schemaOf = s => s.schema || 1;
export const looksLikeState = s => !!s && Array.isArray(s.items) && Array.isArray(s.recipes);

/* Returns a state in the current schema. Throws if the data is newer than this app. */
export function migrate(s) {
  let v = schemaOf(s);
  if (v > SCHEMA) throw new Error('newer');
  while (v < SCHEMA) { s = STEPS[v](s); v = schemaOf(s); }
  s.recipes = s.recipes.map(normalizeRecipe);
  s.shopping = Array.isArray(s.shopping) ? s.shopping : [];
  s.aliases = s.aliases && typeof s.aliases === 'object' ? s.aliases : {};
  s.catalogOverrides = s.catalogOverrides && typeof s.catalogOverrides === 'object' ? s.catalogOverrides : {};
  s.household = {diet: null, onboarded: true, ...(s.household || {})};
  addNewStarters(s);   /* starters added in later versions; starterIds keeps deleted ones deleted */
  s.settings = {hintSoon: true, hintCheck: true, trackSnacks: false, installHintDismissed: false, ...(s.settings || {})};
  return s;
}
