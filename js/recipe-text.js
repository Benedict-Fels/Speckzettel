/* Rule-based parsing of ingredient lines and free recipe text (e.g. an Instagram caption). No AI. */
import {UNIT, toBase, parseAmountStr, fmt} from './units.js';
import {resolve} from './catalog.js';
import {nf} from './text.js';

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}️‍]/gu;

const OPTIONAL = /\b(optional|nach belieben|wer mag|evtl\.?|zum garnieren|zum bestreuen|zum servieren|zur deko)\b/i;

export function parseIngredientLine(raw) {
  const optional = OPTIONAL.test(raw || '');
  let line = raw.replace(EMOJI, '').replace(/^[\s\-–•*·▪→>]+/, '').trim();
  line = line.replace(/^(evtl\.?|optional:?|wer mag:?)\s+/i, '');
  if (!line) return null;
  let amount = null, unit = null;
  const m = line.match(/^((?:\d+(?:[.,]\d+)?|\d+\/\d+|[½¼¾])(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?)\s*(.*)$/);
  if (m) { amount = parseAmountStr(m[1]); line = m[2]; }
  const w = (line.split(/\s+/)[0] || '').toLowerCase().replace(/\.$/, '');
  if (UNIT[w]) { unit = UNIT[w]; line = line.slice(line.split(/\s+/)[0].length).trim(); }
  const paren = (line.match(/\(([^()]{1,20})\)/) || [])[1];
  let name = line.replace(/\(.*?\)/g, '').replace(/,.*$/, '').replace(/\b(nach geschmack|nach belieben|wer mag|etwas|optional|evtl\.?|zum garnieren|zum bestreuen|zum servieren|zur deko)\b/gi, '').replace(/\s+/g, ' ').trim();
  if (!name) return null;
  name = name.charAt(0).toUpperCase() + name.slice(1);
  if (amount != null && !unit) unit = 'Stück';
  if (unit === 'kg' || unit === 'l') [amount, unit] = toBase(amount, unit);
  const r = resolve(name);
  /* "Linsen (rot)": a short note in brackets without digits becomes the variety */
  const noteVariety = paren && !/\d/.test(paren) && !/vegan|optional|nach geschmack/i.test(paren) ? paren.trim() : null;
  return {name: r ? r.name : name, amount, unit: amount == null ? null : unit, variety: (r && r.variety) || noteVariety, ...(optional ? {optional: true} : {})};
}

/* "500 g Tofu, 2 Zucchini" -> entries. Splits on line breaks, semicolons and comma+space (so "1,5 kg" stays whole). */
export const splitEntries = text => text.split(/\n|;|,\s+/).map(x => x.trim()).filter(Boolean);

const nameWithVariety = i => i.variety ? `${i.name} (${i.variety})` : i.name;
export const ingredientToLine = i => i.amount == null ? `${nameWithVariety(i)} nach Geschmack` : `${i.unit && i.unit !== 'Stück' ? fmt(i.amount, i.unit) : nf(i.amount)} ${nameWithVariety(i)}`;

export function parseRecipeText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !/^#\w/.test(l.replace(EMOJI, '').trim()));
  const ingHead = /^(zutaten|ingredients|du brauchst|das brauchst du|einkaufsliste)\b/i, stepHead = /^(zubereitung|anleitung|so geht'?s|schritte|method|zubereiten)\b/i;
  let title = '', servings = 2, sec = null;
  const ings = [], steps = [];
  for (const raw of lines) {
    const l = raw.replace(EMOJI, '').trim();
    const sv = l.match(/(\d+)\s*(portionen|personen|pers\.?|servings)/i);
    if (sv) servings = +sv[1];
    if (ingHead.test(l)) { sec = 'ing'; continue; }
    if (stepHead.test(l)) { sec = 'step'; continue; }
    const startsWithAmount = /^[\s\-•*·]*(\d|½|¼|¾)/.test(l) && !/^\d+[.)]\s/.test(l);
    const numbered = /^\d+[.)]\s+/.test(l);
    if (!title && !startsWithAmount && !numbered && l.length < 80 && !sv) { title = l.replace(/[:!]+$/, ''); continue; }
    if (sec === 'step' || numbered || (sec !== 'ing' && l.length > 50)) { steps.push(l.replace(/^\d+[.)]\s*/, '')); continue; }
    if (sec === 'ing' || startsWithAmount) { const p = parseIngredientLine(l); if (p) ings.push(p); }
  }
  return {title: title || 'Neues Rezept', servings, ingredients: ings, steps};
}
