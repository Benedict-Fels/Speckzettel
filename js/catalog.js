/* Product catalog (data/catalog.json) plus the household's own additions/overrides (state.catalogOverrides).
   Load once with setCatalog() before using anything else; setOverrides() whenever state is loaded.
   Names are matched through the catalog only: exact name, synonym ("text|Sorte"), plural, or a simple
   singular/plural variant of a known name. Unknown names are compared as written (normalized). */
import {norm} from './text.js';

let ingredients = {};
let overrides = {};
let rules = [];
let groups = [];
const byNorm = new Map();   /* norm(name or plural) -> name */
const bySyn = new Map();    /* norm(synonym) -> {name, variety} */

function rebuild() {
  byNorm.clear(); bySyn.clear();
  const all = {...ingredients, ...overrides};
  for (const [name, e] of Object.entries(all)) {
    byNorm.set(norm(name), name);
    if (e.plural) byNorm.set(norm(e.plural), name);
  }
  for (const [name, e] of Object.entries(all)) for (const s of e.synonyms || []) {
    const [text, variety] = s.split('|');
    if (!byNorm.has(norm(text))) bySyn.set(norm(text), {name, variety: variety || null});
  }
}

export function setCatalog(doc) {
  ingredients = doc.ingredients || {};
  groups = doc.groups || [];
  rules = (doc.receiptRules || []).map(([pattern, name]) => [new RegExp(pattern, 'i'), name]);
  rebuild();
}
export function setOverrides(o) { overrides = o || {}; rebuild(); }

const lookup = x => byNorm.has(x) ? {name: byNorm.get(x), variety: null} : bySyn.get(x) || null;
const ENDINGS = ['n', 'en', 'e', 's', 'er'];

/* Name as written -> {name, variety} of a known ingredient, or null. */
export function resolve(n) {
  const x = norm(n);
  if (!x) return null;
  const hit = lookup(x);
  if (hit) return hit;
  for (const end of ENDINGS) {
    const shorter = x.endsWith(end) ? lookup(x.slice(0, -end.length)) : null;
    if (shorter) return shorter;
    const longer = lookup(x + end);
    if (longer) return longer;
  }
  return null;
}

/* Comparison key: two names mean the same ingredient if their keys are equal. */
export const key = n => { const r = resolve(n); return r ? norm(r.name) : norm(n); };

/* Defaults for an ingredient: built-in entry merged with the household's override. null if unknown. */
export function catalogFor(name) {
  const r = resolve(name);
  if (!r) return null;
  return {...(ingredients[r.name] || {}), ...(overrides[r.name] || {}), name: r.name};
}
export const isBuiltIn = name => Object.prototype.hasOwnProperty.call(ingredients, name);
export const catalogNames = () => [...new Set([...Object.keys(ingredients), ...Object.keys(overrides)])].sort((a, b) => a.localeCompare(b, 'de'));
export const groupList = () => groups;
export const groupOf = name => { const c = catalogFor(name); const k = c && c.group || 'other'; return groups.find(g => g.key === k) || {key: 'other', label: 'Sonstiges', icon: '📦'}; };

const fold = s => norm(s).replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');

/* Receipt text -> {name, variety} or null. The rule matching earliest in the text wins (receipts name the product first);
   among rules matching at the same place, the more specific one (listed first) wins. */
export function ruleFor(text) {
  let best = null;
  for (const [re, name] of rules) {
    const m = re.exec(text);
    if (m && (!best || m.index < best.index)) best = {index: m.index, name};
    if (best && best.index === 0) break;
  }
  if (!best) return null;
  const e = {...(ingredients[best.name] || {}), ...(overrides[best.name] || {})};
  const t = fold(text);
  let variety = null;
  for (const s of e.synonyms || []) {
    const [syn, v] = s.split('|');
    if (v && t.includes(fold(syn))) { variety = v; break; }
  }
  return {name: best.name, variety};
}
