/* Units: parsing, conversion to base units (g, ml) and display. Unit names are German display text. */
import {nf} from './text.js';

export const UNIT = {
  g: 'g', gr: 'g', gramm: 'g', kg: 'kg', ml: 'ml', l: 'l', liter: 'l',
  stk: 'Stück', 'stück': 'Stück', st: 'Stück',
  el: 'EL', tl: 'TL', prise: 'Prise', prisen: 'Prise', bund: 'Bund', dose: 'Dose', dosen: 'Dose',
  packung: 'Packung', packungen: 'Packung', pck: 'Packung', pkg: 'Packung', handvoll: 'Handvoll',
  zehe: 'Zehe', zehen: 'Zehe', becher: 'Becher', glas: 'Glas', 'gläser': 'Glas', scheibe: 'Scheibe', scheiben: 'Scheibe',
};
/* Units offered in pickers. */
export const PICK_UNITS = ['g', 'ml', 'Stück', 'Dose', 'Zehe', 'Packung', 'Bund', 'Glas'];
/* Countable units: scaled recipe amounts are rounded up to halves. */
export const COUNT_UNITS = ['Stück', 'Dose', 'Zehe', 'Packung', 'Bund', 'Glas'];
const PLURAL = {Dose: 'Dosen', Packung: 'Packungen', Zehe: 'Zehen', Glas: 'Gläser', Scheibe: 'Scheiben', Prise: 'Prisen'};

export const toBase = (a, u) => u === 'kg' ? [a * 1000, 'g'] : u === 'l' ? [a * 1000, 'ml'] : [a, u];

const SPOON = {EL: 15, TL: 5, Prise: 0.5};   /* in ml or g, rough kitchen values */
const sameWeight = (a, b) => (a === 'g' && b === 'ml') || (a === 'ml' && b === 'g');   /* 1 ml ≈ 1 g */

/* Converts an amount between units, using the ingredient's catalog entry (unit + per) when units differ.
   per: {unit: how much of the entry's unit one of that unit is}, e.g. Zwiebel (Stück) per {g: 1/150}.
   Returns null if there is no sensible conversion. */
export function convert(a, from, to, entry) {
  if (a == null) return null;
  const [x, fu] = toBase(a, from || 'Stück');
  const [, tu] = toBase(1, to || 'Stück');
  const out = v => to === 'kg' || to === 'l' ? v / 1000 : v;
  if (fu === tu) return out(x);
  const eu = entry && entry.unit ? toBase(1, entry.unit)[1] : null;
  const per = (entry && entry.per) || {};
  const liquid = eu === 'g' || eu === 'ml';
  let e;
  if (eu == null) e = null;
  else if (fu === eu) e = x;
  else if (per[fu] != null) e = x * per[fu];
  else if (SPOON[fu] && liquid) e = x * SPOON[fu];
  else if (sameWeight(fu, eu)) e = x;
  if (e == null) return SPOON[fu] && (tu === 'g' || tu === 'ml') ? out(x * SPOON[fu]) : null;
  if (tu === eu) return out(e);
  if (per[tu] != null) return out(e / per[tu]);
  if (SPOON[tu] && liquid) return out(e / SPOON[tu]);
  if (sameWeight(tu, eu)) return out(e);
  return null;
}

export function fmt(a, u) {
  if (a == null) return '';
  if (u === 'g' && a >= 1000) return nf(a / 1000) + ' kg';
  if (u === 'ml' && a >= 1000) return nf(a / 1000) + ' l';
  const unit = a > 1 && PLURAL[u] ? PLURAL[u] : u;
  return nf(a) + ' ' + unit;
}

/* "1,5", "½", "1/2", "2-3" -> number (ranges: the larger value, as in 1.0.0) */
export function parseAmountStr(s) {
  s = s.replace(',', '.').replace('½', '.5').replace('¼', '.25').replace('¾', '.75');
  const range = s.split(/[-–]/).map(x => x.trim()).filter(Boolean);
  const nums = range.map(x => x.includes('/') ? x.split('/').reduce((a, b) => +a / +b) : parseFloat(x)).filter(n => !isNaN(n));
  return nums.length ? Math.max(...nums) : null;
}
