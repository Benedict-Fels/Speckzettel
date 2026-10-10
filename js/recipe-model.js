/* Recipe data model (spec 2.3): one place that knows every field and its default, used by the form,
   the data upgrade and backups from older versions. */
import {suggestIcon, RECIPE_ICONS} from './recipe-icons.js';

const DIETS = ['vegan', 'vegetarian', 'all'];
const minutes = v => { const n = Math.round(+v); return Number.isFinite(n) && n > 0 ? n : 0; };

export function normalizeIngredient(x) {
  return {
    amount: x.amount == null || x.amount === '' || isNaN(+x.amount) ? null : +x.amount,
    unit: x.amount == null ? null : (x.unit || null),
    name: String(x.name || '').trim(),
    variety: x.variety || null,
    optional: !!x.optional,
    raw: !!x.raw,
    ...(x.swapOk ? {swapOk: true} : {}),
  };
}

/* Fills missing fields; keeps everything that is already there. diet null = worked out from the ingredients. */
export function normalizeRecipe(r) {
  const ingredients = (r.ingredients || []).map(normalizeIngredient).filter(x => x.name);
  return {
    ...r,
    id: r.id,
    title: String(r.title || 'Rezept').trim(),
    summary: r.summary || '',
    diet: DIETS.includes(r.diet) ? r.diet : null,
    servings: Math.max(1, Math.round(+r.servings || 2)),
    prepTime: minutes(r.prepTime), cookTime: minutes(r.cookTime), restTime: minutes(r.restTime),
    ingredients,
    steps: (r.steps || []).map(s => String(s).trim()).filter(Boolean),
    source: r.source && (r.source.name || r.source.url) ? {name: r.source.name || '', url: r.source.url || null} : null,
    icon: RECIPE_ICONS[r.icon] ? r.icon : suggestIcon(r.title, ingredients.map(x => x.name)),
    tags: Array.isArray(r.tags) ? r.tags : [],
    origin: ['starter', 'own', 'import'].includes(r.origin) ? r.origin : 'own',
    createdAt: r.createdAt ?? null,
    cookedAt: Array.isArray(r.cookedAt) ? r.cookedAt.filter(Number.isFinite) : [],
  };
}

/* Stable id from the title: lower case, hyphens, umlauts spelled out; a number is added on collision. */
export function recipeId(title, taken = []) {
  const base = (title || 'rezept').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'rezept';
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}

/* Minutes of work + cooking (what the "≤ 30 Min" filter uses); 0 = unknown. */
export const activeTime = r => (r.prepTime || 0) + (r.cookTime || 0);
