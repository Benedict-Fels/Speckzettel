/* Recipe form (spec 9.1): the draft the form edits, and turning it back into a recipe. No DOM here.
   Since 2.3.0 every ingredient line has fixed fields (Zutat, Menge, Einheit, Sorte); free text still works through
   "Text einfügen" and the quick line, which are parsed into those fields. */
import {parseIngredientLine} from './recipe-text.js';
import {catalogFor, key} from './catalog.js';
import {normalizeRecipe, recipeId} from './recipe-model.js';
import {suggestIcon} from './recipe-icons.js';
import {starterById} from './starter-recipes.js';
import {now} from './clock.js';

/* Draft line: fields as typed (amount is text, "1,5"); unit '' = Stück with an amount, nach Geschmack without. */
export const line = (f = {}) => ({name: '', amount: '', unit: '', variety: '', optional: false, raw: false, rawTouched: false, swapOk: false, ...f});
const amountText = a => a == null ? '' : String(+(+a).toFixed(3)).replace('.', ',');
export const lineFromIngredient = i => line({name: i.name, amount: amountText(i.amount), unit: i.amount == null ? '' : (i.unit || ''),
  variety: i.variety || '', optional: !!i.optional, raw: !!i.raw, swapOk: !!i.swapOk});
/* "200 g Tomaten" (quick line, pasted rows) -> a draft line; null if nothing usable. */
export function lineFromText(text) {
  const p = parseIngredientLine(text || '');
  return p ? lineFromIngredient(p) : null;
}
/* The line as one text ("200 g Linsen (rot)"), which is also how it is read back. */
export const lineText = l => `${[l.amount, l.amount !== '' && l.amount != null ? l.unit : '', l.name].map(x => String(x || '').trim()).filter(Boolean).join(' ')}${l.variety ? ` (${l.variety})` : ''}`;

export function newDraft() {
  return {id: null, title: '', summary: '', servings: 2, prepTime: '', cookTime: '', restTime: '', diet: null, icon: null,
    lines: [line()], steps: [''], sourceName: '', sourceUrl: ''};
}

export function draftFromRecipe(r) {
  return {id: r.id, title: r.title, summary: r.summary || '', servings: r.servings,
    prepTime: r.prepTime || '', cookTime: r.cookTime || '', restTime: r.restTime || '', diet: r.diet || null, icon: r.icon || null,
    lines: r.ingredients.map(i => ({...lineFromIngredient(i), rawTouched: true})).concat([line()]),
    steps: r.steps.length ? [...r.steps] : [''], sourceName: r.source ? r.source.name : '', sourceUrl: r.source && r.source.url ? r.source.url : ''};
}

/* Result of "Text einfügen" goes into the form; title, servings, lines and steps are replaced, the rest stays. */
export function draftFromParsed(d, parsed) {
  const out = {...d, title: parsed.title || d.title, servings: parsed.servings || d.servings,
    lines: parsed.ingredients.map(lineFromIngredient).concat([line()]),
    steps: parsed.steps.length ? parsed.steps : d.steps};
  suggestRawAll(out);
  return out;
}

/* The line as a recipe ingredient (null if the name is empty). The name field may also hold a whole line
   ("200 g Tomaten"), so it goes through the same parser as pasted text; a chosen variety wins. */
export function lineToIngredient(l) {
  if (!String(l.name || '').trim()) return null;
  const p = parseIngredientLine(lineText({...l, variety: ''}));
  if (!p) return null;
  return {...p, variety: (l.variety || '').trim() || p.variety || null, optional: !!(l.optional || p.optional)};
}

/* What the app understood from one line, for the hint under it. */
export function lineInfo(l) {
  const p = lineToIngredient(l);
  return p ? {...p, known: !!catalogFor(p.name)} : null;
}

/* Eggs in recipes that are not cooked through (spec 10.1): proposed by the title, can be switched off. */
const RAW_TITLE = /tiramisu|mayo|mousse|aioli|zabaione|eischnee|eierlik|eiscreme|tatar|mett\b|carbonara/i;
export const rawSuggested = (title, name) => RAW_TITLE.test(title || '') && key(name) === key('Ei');
export function suggestRawAll(d) {
  for (const l of d.lines) {
    if (l.rawTouched) continue;
    const info = lineInfo(l);
    l.raw = !!(info && rawSuggested(d.title, info.name));
  }
}

/* The draft as a recipe. Editing a starter makes it the household's own recipe (it keeps its id and remembers the original). */
export function recipeFromDraft(d, existing, recipes, t = now()) {
  const ingredients = d.lines.map(l => {
    const p = lineToIngredient(l);
    return p ? {...p, raw: !!l.raw && p.name === 'Ei', swapOk: !!l.swapOk} : null;
  }).filter(Boolean);
  const title = (d.title || '').trim() || 'Neues Rezept';
  const fromStarter = existing && existing.origin === 'starter';
  return normalizeRecipe({
    ...(existing || {}),
    id: existing ? existing.id : recipeId(title, recipes.map(r => r.id)),
    title, summary: (d.summary || '').trim(), diet: d.diet || null,
    servings: d.servings, prepTime: d.prepTime, cookTime: d.cookTime, restTime: d.restTime,
    ingredients, steps: d.steps,
    icon: d.icon || suggestIcon(title, ingredients.map(i => i.name)),
    source: d.sourceName || d.sourceUrl ? {name: (d.sourceName || '').trim(), url: (d.sourceUrl || '').trim() || null} : null,
    origin: fromStarter ? 'own' : existing ? existing.origin : 'own',
    basedOn: fromStarter ? existing.id : existing ? existing.basedOn : undefined,
    createdAt: existing ? existing.createdAt ?? null : t,
    cookedAt: existing ? existing.cookedAt : [],
  });
}

/* "Original wiederherstellen" for an edited starter: the shipped version, with the household's cooking history. */
export function restoreStarter(r) {
  const orig = r.basedOn ? starterById(r.basedOn) : null;
  return orig ? {...orig, cookedAt: r.cookedAt || []} : null;
}
