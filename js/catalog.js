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

/* Small typing errors ("Tomatn", "Zuchini"): the closest known name, if it is close enough. Used by the recipe parser only;
   the hint under the line shows what was understood, so a wrong guess is visible. */
function distance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  let prev = Array.from({length: b.length + 1}, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
export function resolveFuzzy(n) {
  const exact = resolve(n);
  if (exact) return exact;
  const x = norm(n);
  if (x.length < 5) return null;
  const max = x.length >= 9 ? 2 : 1;
  let best = null, bestD = max + 1;
  for (const k of [...byNorm.keys(), ...bySyn.keys()]) {
    const d = distance(x, k);
    if (d < bestD) { bestD = d; best = k; }
  }
  return best ? lookup(best) : null;
}

/* Suggestions while typing on the shopping list (11.10.2026): known ingredients whose name or other name starts with
   (or contains) the text. Other names that carry a variety suggest that variety ("oliv" -> Öl (Oliven)). */
export function searchCatalog(q, limit = 8) {
  const x = norm(q);
  if (x.length < 2) return [];
  const all = {...ingredients, ...overrides};
  const hits = [];
  for (const [name, e] of Object.entries(all)) {
    if (e.ignore && !norm(name).startsWith(x)) continue;
    const n = norm(name), pl = e.plural ? norm(e.plural) : '';
    if (n.startsWith(x) || pl.startsWith(x)) hits.push({name, variety: null, score: 0, len: n.length});
    else if (x.length >= 3 && n.includes(x)) hits.push({name, variety: null, score: 2, len: n.length});
    for (const syn of e.synonyms || []) {
      const [t, v] = syn.split('|');
      const ns = norm(t);
      if (ns.startsWith(x)) hits.push({name, variety: v || null, score: 1, len: ns.length});
      else if (x.length >= 3 && ns.includes(x) && v) hits.push({name, variety: v, score: 3, len: ns.length});
    }
  }
  hits.sort((a, b) => a.score - b.score || a.len - b.len || a.name.localeCompare(b.name, 'de'));
  const seen = new Set(), out = [];
  for (const h of hits) {
    const k = `${h.name}|${h.variety || ''}`;
    if (seen.has(k) || (h.variety == null && seen.has(`${h.name}|`))) continue;
    seen.add(k); out.push({name: h.name, variety: h.variety});
    if (out.length >= limit) break;
  }
  return out;
}

/* Varieties a known ingredient has in the catalog (from "text|Sorte" synonyms), for reading "Zwiebel, rot". */
export function varietiesOf(name) {
  const r = resolve(name);
  if (!r) return [];
  const e = {...(ingredients[r.name] || {}), ...(overrides[r.name] || {})};
  return [...new Set((e.synonyms || []).map(s => s.split('|')[1]).filter(Boolean))];
}

/* Comparison key: two names mean the same ingredient if their keys are equal. */
export const key = n => { const r = resolve(n); return r ? norm(r.name) : norm(n); };

/* Defaults for an ingredient: built-in entry merged with the household's override. null if unknown. */
export function catalogFor(name) {
  const r = resolve(name);
  if (!r) return null;
  return {...(ingredients[r.name] || {}), ...(overrides[r.name] || {}), name: r.name};
}
/* Other entries that stand in for this one in recipes (catalog "family", 11.10.2026): only those at least as strict in diet,
   so Milch is served by Pflanzendrink, but Pflanzendrink never by Milch. */
const DIET_RANK = {vegan: 0, vegetarian: 1, all: 2};
export function familyOf(name) {
  const c = catalogFor(name);
  if (!c || !c.family) return [];
  const rank = DIET_RANK[c.diet] ?? 2;
  return Object.keys(ingredients).filter(n => n !== c.name && ingredients[n].family === c.family && (DIET_RANK[ingredients[n].diet] ?? 2) <= rank);
}

/* Is having `have` instead of `want` a different product (offered as "Ersatz") rather than just another description?
   strictVariety true: any two named varieties differ; a list: only those varieties are kept apart (Joghurt: Frucht). */
export function varietyDiffers(name, want, have) {
  const c = catalogFor(name), s = c && c.strictVariety;
  if (!s) return false;
  const a = norm(want || ''), b = norm(have || '');
  if (a === b) return false;
  if (s === true) return !!a && !!b;
  /* group variety: "Frucht" asked for, "Mango" there -> fits (not the other way round) */
  const groups = c.varietyGroups || {};
  for (const [g, members] of Object.entries(groups)) if (norm(g) === a && members.some(m => norm(m) === b)) return false;
  const strict = s.map(norm);
  return strict.includes(a) || strict.includes(b);
}
/* Average weight of one piece if this goes on the shopping list in pieces (loose produce, 11.10.2026), else null.
   Packed varieties (Cherrytomaten) stay in grams. */
export function pieceWeight(name, variety) {
  const c = catalogFor(name);
  if (!c || !c.loose || !c.per || !c.per['Stück']) return null;
  if (variety && (c.packedVarieties || []).some(v => norm(v) === norm(variety))) return null;
  return c.per['Stück'];
}
export const isBuiltIn = name => Object.prototype.hasOwnProperty.call(ingredients, name);
export const catalogNames = () => [...new Set([...Object.keys(ingredients), ...Object.keys(overrides)])].sort((a, b) => a.localeCompare(b, 'de'));
export const groupList = () => groups;
/* Symbol for a list row: the ingredient's own (11.10.2026), else its group's. */
export const iconFor = name => { const c = catalogFor(name); return (c && c.icon) || groupOf(name).icon; };
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
