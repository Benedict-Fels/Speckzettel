/* Recipe form (spec 9.1): the draft the form edits, and turning it back into a recipe. No DOM here. */
import {parseIngredientLine, ingredientToLine} from './recipe-text.js';
import {catalogFor, key} from './catalog.js';
import {normalizeRecipe, recipeId} from './recipe-model.js';
import {suggestIcon} from './recipe-icons.js';
import {starterById} from './starter-recipes.js';
import {now} from './clock.js';

const line = (text = '', optional = false, raw = false) => ({text, optional, raw, rawTouched: false});

export function newDraft() {
  return {id: null, title: '', summary: '', servings: 2, prepTime: '', cookTime: '', restTime: '', diet: null, icon: null,
    lines: [line()], steps: [''], sourceName: '', sourceUrl: ''};
}

export function draftFromRecipe(r) {
  return {id: r.id, title: r.title, summary: r.summary || '', servings: r.servings,
    prepTime: r.prepTime || '', cookTime: r.cookTime || '', restTime: r.restTime || '', diet: r.diet || null, icon: r.icon || null,
    lines: r.ingredients.map(i => ({...line(ingredientToLine(i), i.optional, i.raw), rawTouched: true})).concat(r.ingredients.length ? [] : [line()]),
    steps: r.steps.length ? [...r.steps] : [''], sourceName: r.source ? r.source.name : '', sourceUrl: r.source && r.source.url ? r.source.url : ''};
}

/* Result of "Text einfügen" goes into the form; title, servings, lines and steps are replaced, the rest stays. */
export function draftFromParsed(d, parsed) {
  const out = {...d, title: parsed.title || d.title, servings: parsed.servings || d.servings,
    lines: parsed.ingredients.map(i => line(ingredientToLine(i), !!i.optional)).concat([line()]),
    steps: parsed.steps.length ? parsed.steps : d.steps};
  suggestRawAll(out);
  return out;
}

/* What the app understood from one line, for the hint under it. */
export function lineInfo(text) {
  const p = parseIngredientLine(text || '');
  if (!p) return null;
  return {...p, known: !!catalogFor(p.name)};
}

/* Eggs in recipes that are not cooked through (spec 10.1): proposed by the title, can be switched off. */
const RAW_TITLE = /tiramisu|mayo|mousse|aioli|zabaione|eischnee|eierlik|eiscreme|tatar|mett\b|carbonara/i;
export const rawSuggested = (title, name) => RAW_TITLE.test(title || '') && key(name) === key('Ei');
export function suggestRawAll(d) {
  for (const l of d.lines) {
    if (l.rawTouched) continue;
    const info = lineInfo(l.text);
    l.raw = !!(info && rawSuggested(d.title, info.name));
  }
}

/* The draft as a recipe. Editing a starter makes it the household's own recipe (it keeps its id and remembers the original). */
export function recipeFromDraft(d, existing, recipes, t = now()) {
  const ingredients = d.lines.map(l => {
    const p = parseIngredientLine(l.text || '');
    return p ? {...p, optional: !!(l.optional || p.optional), raw: !!l.raw} : null;
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
