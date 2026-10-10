/* Rule-based parsing of ingredient lines and free recipe text (e.g. an Instagram caption). No AI. */
import {UNIT, toBase, parseAmountStr, fmt} from './units.js';
import {resolveFuzzy, varietiesOf} from './catalog.js';
import {nf} from './text.js';

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}️‍]/gu;

const OPTIONAL = /\b(optional|nach belieben|wer mag|evtl\.?|zum garnieren|zum bestreuen|zum servieren|zur deko)\b/i;

const AMOUNT = String.raw`(?:\d+(?:[.,]\d+)?|\d+\/\d+|[½¼¾])(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?`;
const LEAD = new RegExp(`^(${AMOUNT})\\s*(.*)$`);
const unitWord = w => UNIT[(w || '').toLowerCase().replace(/\.$/, '')];
const COLOURS = ['rot', 'gelb', 'grün', 'weiß', 'schwarz', 'braun', 'bunt'];

/* One ingredient line -> {name, amount, unit, variety, optional?}. Understands "200 g Linsen (rot)", "200g Linsen",
   "Linsen 200 g", "Zwiebel, rot", "3 Knoblauchzehen", small typos of known names. */
export function parseIngredientLine(raw) {
  const optional = OPTIONAL.test(raw || '');
  let line = (raw || '').replace(EMOJI, '').replace(/^[\s\-–•*·▪→>]+/, '').trim();
  line = line.replace(/^(evtl\.?|optional:?|wer mag:?)\s+/i, '');
  if (!line) return null;
  let amount = null, unit = null;
  const m = line.match(LEAD);
  if (m) {
    amount = parseAmountStr(m[1]); line = m[2];
    const w = line.split(/\s+/)[0];
    if (unitWord(w)) { unit = unitWord(w); line = line.slice(w.length).trim(); }
  } else {
    /* amount at the end: "Tomaten 200 g", "Tomaten: 200g", "Salz, 1 Prise" */
    const t = line.match(new RegExp(`^(.*?)[\\s:,]+(${AMOUNT})\\s*([A-Za-zäöüÄÖÜ.]+)?$`));
    if (t && t[1] && (!t[3] || unitWord(t[3]))) { line = t[1]; amount = parseAmountStr(t[2]); unit = t[3] ? unitWord(t[3]) : null; }
  }
  const paren = (line.match(/\(([^()]{1,20})\)/) || [])[1];
  const afterComma = (line.match(/,\s*([^,]{1,25})$/) || [])[1];
  let name = line.replace(/\(.*?\)/g, '').replace(/,.*$/, '').replace(/\b(nach geschmack|nach belieben|wer mag|etwas|optional|evtl\.?|zum garnieren|zum bestreuen|zum servieren|zur deko)\b/gi, '').replace(/\s+/g, ' ').trim();
  if (!name) return null;
  name = name.charAt(0).toUpperCase() + name.slice(1);
  if (amount != null && !unit) unit = 'Stück';
  if (unit === 'kg' || unit === 'l') [amount, unit] = toBase(amount, unit);
  if (unit === 'Stück' && /zehen?$/i.test(name)) unit = 'Zehe';   /* "3 Knoblauchzehen" */
  const r = resolveFuzzy(name);
  /* variety: from the name ("rote Linsen"), from brackets ("Linsen (rot)") or after a comma, if the catalog knows it ("Zwiebel, rot") */
  const known = r ? varietiesOf(r.name) : [];
  const pick = txt => { if (!txt) return null; const t = txt.trim().toLowerCase(); const hit = known.find(v => v.toLowerCase() === t || t.startsWith(v.toLowerCase())); return hit || (COLOURS.includes(t) ? t : null); };
  const noteVariety = paren && !/\d/.test(paren) && !/vegan|optional|nach geschmack/i.test(paren) ? (pick(paren) || paren.trim()) : null;
  const variety = (r && r.variety) || noteVariety || pick(afterComma);
  return {name: r ? r.name : name, amount, unit: amount == null ? null : unit, variety, ...(optional ? {optional: true} : {})};
}

/* "500 g Tofu, 2 Zucchini" -> entries. Splits on line breaks, semicolons and comma+space (so "1,5 kg" stays whole). */
export const splitEntries = text => text.split(/\n|;|,\s+/).map(x => x.trim()).filter(Boolean);

const nameWithVariety = i => i.variety ? `${i.name} (${i.variety})` : i.name;
export const ingredientToLine = i => i.amount == null ? `${nameWithVariety(i)} nach Geschmack` : `${i.unit && i.unit !== 'Stück' ? fmt(i.amount, i.unit) : nf(i.amount)} ${nameWithVariety(i)}`;

/* Buttons and links that come along when a whole web page is copied. */
const NOISE = /^(portion(en)?\s+(abziehen|hinzuf(ü|ue)gen|erh(ö|oe)hen|verringern|reduzieren)|[-+–]|drucken|rezept drucken|merken|teilen|speichern|bewerten|pin it|jump to recipe|zur einkaufsliste( hinzuf(ü|ue)gen)?|auf die einkaufsliste|werbung|anzeige|video ansehen|kommentare?|\d+\s*(kommentare|bewertungen))$/i;
const AMOUNT_ONLY = new RegExp(`^(${AMOUNT})\\s*([A-Za-zäöüÄÖÜ.]+)?$`);

/* Free recipe text -> {title, servings, ingredients, steps}. Copes with Instagram captions and copied web pages,
   where amount and ingredient often land on separate lines ("400 g" / "Mini Knödel"). */
export function parseRecipeText(text) {
  const lines = text.split(/\r?\n/).map(l => l.replace(EMOJI, '').trim()).filter(l => l && !/^#\w/.test(l) && !NOISE.test(l));
  const ingHead = /^(zutaten|ingredients|du brauchst|das brauchst du|einkaufsliste)\b/i, stepHead = /^(zubereitung|anleitung|so geht'?s|schritte|method|zubereiten)\b/i;
  const servingsHead = /^(portionen|personen|anzahl|f(ü|ue)r)\s*:?$/i;
  let title = '', servings = 2, sec = null, pending = null, expectServings = false;
  const ings = [], steps = [];
  for (const l of lines) {
    const sv = l.match(/(\d+)\s*(portionen|personen|pers\.?|servings|st(ü|ue)ck)\b/i);
    if (sv && sec !== 'step') { servings = +sv[1]; continue; }
    if (servingsHead.test(l)) { expectServings = true; continue; }
    if (expectServings && /^\d+$/.test(l)) { servings = +l; expectServings = false; continue; }
    expectServings = false;
    if (ingHead.test(l)) { sec = 'ing'; continue; }
    if (stepHead.test(l)) { sec = 'step'; pending = null; continue; }
    const numbered = /^\d+[.)]\s+/.test(l);
    const amountOnly = !numbered && AMOUNT_ONLY.test(l) && (!l.match(AMOUNT_ONLY)[2] || unitWord(l.match(AMOUNT_ONLY)[2]));
    if (sec !== 'step' && amountOnly) { pending = l; sec = sec || 'ing'; continue; }   /* "400 g" – the ingredient follows on the next line */
    const startsWithAmount = /^[\s\-•*·]*(\d|½|¼|¾)/.test(l) && !numbered;
    if (!title && !sec && !pending && !startsWithAmount && !numbered && l.length < 80) { title = l.replace(/[:!]+$/, ''); continue; }
    if (sec === 'step' || numbered || (sec !== 'ing' && l.length > 50)) { steps.push(l.replace(/^\d+[.)]\s*/, '')); continue; }
    if (sec === 'ing' || startsWithAmount || pending) {
      const text = pending && !startsWithAmount ? `${pending} ${l}` : l;
      pending = null;
      /* "Salz & Pfeffer (nach Geschmack)" -> two ingredients, if both are known */
      const two = text.replace(/^[\s\-–•*·▪→>]+/, "").match(/^([A-Za-zÄÖÜäöüß]+)\s*(?:&|und|\+)\s*([A-Za-zÄÖÜäöüß]+)(.*)$/);
      if (two && resolveFuzzy(two[1]) && resolveFuzzy(two[2])) { for (const n of [two[1], two[2]]) { const q = parseIngredientLine(n + two[3]); if (q) ings.push(q); } continue; }
      const p = parseIngredientLine(text);
      if (p) ings.push(p);
    }
  }
  return {title: title || 'Neues Rezept', servings, ingredients: ings, steps};
}
