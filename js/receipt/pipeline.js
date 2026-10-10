/* Receipt parsing: AI answer in pipe format, or raw eBon text. Rule based, no AI.
   (2.0 replaces parseRaw with chain templates, line classification and sum checks, spec 13.2.) */
import {uid, norm} from '../text.js';
import {UNIT, toBase, convert, COUNT_UNITS} from '../units.js';
import {catalogFor, ruleFor, resolve} from '../catalog.js';
import {areaFromText} from '../areas.js';

/* Where a row's product came from. Codes are technical, labels are shown. */
export const SOURCE_LABELS = {ai: 'KI', rule: 'Regel', learned: 'gelernt', unknown: 'unbekannt'};

/* opts.trackSnacks: snacks are taken over like everything else (household setting). */
export function parseReceipt(text, aliases, opts = {}) {
  const lines = text.split(/\r?\n/);
  const piped = lines.filter(l => l.includes('|'));
  const rows = piped.length ? parsePiped(piped) : parseRaw(lines, aliases);
  for (const r of rows) r.skip = shouldSkip(r.name, opts);
  return rows;
}

/* Snacks (unless tracked), drinks, household goods: shown greyed out, not taken over unless the user taps. */
export function shouldSkip(name, opts = {}) {
  const c = catalogFor(name);
  return !!(c && (c.ignore || (c.snack && !opts.trackSnacks)));
}
const CONTAINERS = ['Dose', 'Glas', 'Packung', 'Becher'];
const FROZEN = /\btk\b|tiefk|tiefgefr|gefroren/i;

export function parsePiped(lines) {
  const rows = [];
  for (let l of lines) {
    l = l.trim().replace(/^\|/, '').replace(/\|$/, '');
    if (/^[\s|:\-]+$/.test(l)) continue;
    const p = l.split('|').map(x => x.trim());
    if (p.length < 3 || /produktname|bon-?text/i.test(p[1] + p[0])) continue;
    let amount = parseFloat((p[2] || '').replace(',', '.'));
    let unit = UNIT[(p[3] || '').toLowerCase()] || p[3] || 'Stück';
    if (isNaN(amount)) amount = 1;
    [amount, unit] = toBase(amount, unit);
    const c = catalogFor(p[1]), r = resolve(p[1]);
    rows.push({id: uid(), text: p[0], name: c ? c.name : p[1], variety: r ? r.variety : null, amount, unit, area: p[4] ? areaFromText(p[4]) : (c?.area || 'pantry'), src: 'ai'});
  }
  return rows;
}

const SKIP = /summe|mwst|\bbar\b|ec-?cash|girocard|karte|rückgeld|rueckgeld|gegeben|steuer|netto|brutto|pfand|leergut|rabatt|bonus|payback|zwischensumme|\bkasse\b|bon-?nr|beleg|vielen dank|uhrzeit|datum|^eur\b|gmbh|str\.|strasse|straße|tel\.|www\.|ust-?id/i;

/* Receipt text without pack size and store brands: the key for learned aliases. */
export const cleanReceiptText = t => t.replace(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i, '').replace(/\b(bio|ja!?|gut&günstig|k-classic)\b/ig, '').replace(/\s+/g, ' ').trim();
export const aliasKey = t => norm(cleanReceiptText(t));

export function makeReceiptRow(text, qty, aliases) {
  const size = text.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i);
  const sz = size ? toBase(parseFloat(size[1].replace(',', '.')), size[2].toLowerCase()) : null;
  const clean = cleanReceiptText(text);
  const learned = aliases[norm(clean)];
  let name, src, variety = null;
  if (learned) { name = learned.ingredient; variety = learned.variety || null; src = 'learned'; }
  else {
    const r = ruleFor(clean);
    if (r) { name = r.name; variety = r.variety; src = 'rule'; }
    else { name = clean.toLowerCase().replace(/(^|\s)\S/g, s => s.toUpperCase()); src = 'unknown'; }
  }
  const c = catalogFor(name);
  const unit = learned?.unit || c?.unit || (sz ? sz[1] : 'Stück');
  const area = FROZEN.test(text) ? 'freezer' : learned?.area || c?.area || 'pantry';
  return {id: uid(), text, name, variety, amount: receiptAmount(sz, qty, unit, c), unit, area, src, qty, sz};
}

/* Amount for a receipt line: pack size from the text ("1KG") in the ingredient's unit; whole pieces are rounded ("1 kg Zwiebeln" -> 7 Stück). */
export function receiptAmount(sz, qty, unit, c) {
  if (!sz) return c && c.pack && !COUNT_UNITS.includes(unit) ? qty * c.pack : qty;   /* no size printed: usual pack */
  if (CONTAINERS.includes(unit)) return qty;   /* "Kichererbsen 400 g" is one can, whatever it weighs */
  const v = convert(sz[0] * qty, sz[1], unit, c);
  if (v == null) return qty;
  return COUNT_UNITS.includes(unit) ? Math.max(1, Math.round(v)) : +v.toFixed(1);
}

/* Quantity lines ("2 Stk x 0,79") belong to the previous article (REWE layout; wrong for Netto, fixed in 2.0). */
export function parseRaw(lines, aliases) {
  const rows = [];
  for (const l of lines) {
    const t = l.trim();
    if (!t) continue;
    const q = t.match(/^(\d+)\s*(stk|st)?\.?\s*x\s*\d+,\d{2}/i);
    if (q && rows.length) { const last = rows[rows.length - 1]; const nr = makeReceiptRow(last.text, +q[1], aliases); rows[rows.length - 1] = {...nr, id: last.id}; continue; }
    if (SKIP.test(t)) continue;
    const m = t.match(/^(.*?[a-zäöü].*?)\s+(-?\d+,\d{2})\s*[a-z*]?\s*$/i);
    if (!m || m[2].startsWith('-')) continue;
    rows.push(makeReceiptRow(m[1].trim(), 1, aliases));
  }
  return rows;
}
