/* Receipt pipeline (spec 13.2), rule based, no AI. Every stage is its own function and testable without a browser:
   1 text (pdf.js in receipt/pdf.js, or pasted)  2 lines (receipt/lines.js)  3 chain (receipt/templates.js)
   4 classify lines  5 build articles (quantity lines matched by arithmetic)  6 checks (line, sum, count)
   7 match to ingredients (learned > rules > unknown)  -> result for the review screen.
   AI answers in the "|" format skip 2–5 and go straight to 6. */
import {uid, norm} from '../text.js';
import {UNIT, toBase, convert, COUNT_UNITS} from '../units.js';
import {catalogFor, ruleFor, resolve} from '../catalog.js';
import {areaFromText} from '../areas.js';
import {detectChain, TEMPLATES} from './templates.js';

/* Where a row's ingredient came from. Codes are technical, labels are shown. */
export const SOURCE_LABELS = {ai: 'KI', rule: 'Regel', learned: 'gelernt', unknown: 'unbekannt', ignored: 'ignoriert'};

const money = s => +String(s).replace(/\s/g, '').replace(',', '.');
const close = (a, b) => Math.abs(a - b) < 0.011;

/* ---- stage 4: what kind of line is this? ---- */
const PRICE_END = /(-?\d{1,4}[.,]\d{2})(?:\s*(?:€|EUR))?(?:\s+(?:[A-Z]{1,2}|\*|\d))?\s*$/;
const QTY = /^\s*(\d+(?:[.,]\d+)?)\s*(?:stk|st|stück)?\.?\s*[x×*]\s*(\d+[.,]\d{2})(?:\s*(?:€|eur))?\s*$/i;
const WEIGHT = /(\d+[.,]\d{1,3})\s*kg\s*[x×*]\s*(\d+[.,]\d{2})\s*(?:€|eur)?\s*\/\s*kg/i;
const TOTAL = /^\s*(summe|zu zahlen|gesamtsumme|endsumme|gesamt|total)\b/i;
const TAX = /^\s*[A-D]?\s*\d{1,2}(?:[.,]\d+)?\s*%|mwst|\bust\b|steuer|\bnetto\b.*\bbrutto\b/i;
const PAYMENT = /ec-?cash|girocard|kartenzahlung|\bbar\b|gegeben|r(ü|ue)ckgeld|visa|mastercard|maestro|kreditkarte|apple pay|google pay|zahlung|kundenbeleg/i;
const LOYALTY = /payback|punkte|deutschlandcard|treuepunkte|kartennr/i;
const DISCOUNT = /rabatt|preisvorteil|aktionsersparnis|nachlass|ersparnis|coupon|gutschein|reduziert/i;
const DEPOSIT = /pfand|leergut/i;
const TSE = /\btse\b|signatur|seriennr|transaktion|pr(ü|ue)fwert/i;

export function classifyLine(line) {
  const t = line.trim();
  if (!t || /^[-=*_\s]+$/.test(t)) return {kind: 'blank'};
  let m;
  if ((m = t.match(WEIGHT))) return {kind: 'weight', kg: money(m[1]), unitPrice: money(m[2]), text: t};
  if ((m = t.match(QTY))) return {kind: 'qty', qty: money(m[1]), unitPrice: money(m[2]), text: t};
  const p = t.match(PRICE_END);
  if (TOTAL.test(t) && p) { const c = t.match(/\[(\d+)\]/); return {kind: 'total', total: money(p[1]), count: c ? +c[1] : null, text: t}; }
  if (TSE.test(t)) return {kind: 'tse', text: t};
  if (!p) return {kind: 'text', text: t};
  const price = money(p[1]);
  const label = t.slice(0, p.index).trim();
  if (TAX.test(t)) return {kind: 'tax', text: t};
  if (PAYMENT.test(t)) return {kind: 'payment', text: t};
  if (DEPOSIT.test(label)) return {kind: 'deposit', price, text: label};
  if (price < 0 || DISCOUNT.test(label)) return {kind: 'discount', price: price < 0 ? price : -price, text: label};
  if (LOYALTY.test(t)) return {kind: 'loyalty', text: t};
  if (!/[a-zäöüß].*[a-zäöüß]/i.test(label)) return {kind: 'text', text: t};
  return {kind: 'article', price, text: label.replace(/\s{2,}/g, ' ')};
}

/* ---- stage 5: articles. Lines before the first article are the head, everything from the first total on is the foot. ---- */
export function buildArticles(lines, chain = 'generic') {
  const tpl = TEMPLATES[chain] || TEMPLATES.generic;
  const body = [];
  let total = null, count = null, started = false;
  for (const line of lines) {
    const c = classifyLine(line);
    if (c.kind === 'total') { if (started) { total = c.total; count = c.count; break; } continue; }
    if (c.kind === 'article' || c.kind === 'qty' || c.kind === 'weight') started = true;
    if (started) body.push(c);
  }
  const articles = [], discounts = [], deposits = [];
  body.forEach((c, i) => { if (c.kind === 'article') articles.push({...c, pos: i, qty: 1, unitPrice: null, weightKg: null, discount: 0, lineCheck: null}); });
  const near = (i, dir) => { for (let j = i + dir; j >= 0 && j < body.length; j += dir) { if (body[j].kind === 'article') return articles.find(a => a.pos === j); if (body[j].kind === 'qty' || body[j].kind === 'weight') return null; } return null; };
  body.forEach((c, i) => {
    if (c.kind === 'qty' || c.kind === 'weight') {
      const expect = c.kind === 'qty' ? c.qty * c.unitPrice : c.kg * c.unitPrice;
      const prev = near(i, -1), next = near(i, 1);
      const fits = a => a && close(a.price, expect);
      const preferred = tpl.qtyLine === 'before' ? [next, prev] : [prev, next];
      const target = preferred.find(fits) || preferred.find(Boolean);
      if (!target) return;
      if (c.kind === 'qty') { target.qty = c.qty; target.unitPrice = c.unitPrice; }
      else { target.weightKg = c.kg; target.unitPrice = c.unitPrice; }
      target.lineCheck = fits(target) ? 'ok' : 'off';
    } else if (c.kind === 'discount') {
      const prev = [...articles].reverse().find(a => a.pos < i);
      if (prev) prev.discount = +(prev.discount + c.price).toFixed(2); else discounts.push(c);
    } else if (c.kind === 'deposit') deposits.push(c);
  });
  return {articles, discounts, deposits, total, count};
}

/* ---- stage 6: checks ---- */
export function runChecks({articles, discounts = [], deposits = [], total, count}) {
  const sum = +(articles.reduce((s, a) => s + a.price + (a.discount || 0), 0) + discounts.reduce((s, d) => s + d.price, 0) + deposits.reduce((s, d) => s + d.price, 0)).toFixed(2);
  const pieces = articles.reduce((s, a) => s + (a.weightKg ? 1 : a.qty || 1), 0);
  return {
    sum: total == null ? 'none' : close(sum, total) ? 'ok' : 'off',
    sumFound: sum, sumDiff: total == null ? null : +(total - sum).toFixed(2),
    count: count == null ? 'none' : count === pieces ? 'ok' : 'off',
    lines: articles.some(a => a.lineCheck === 'off') ? 'off' : 'ok',
  };
}

/* Date and time printed on the receipt, as local "2026-10-09T14:56" (or null). */
export function receiptDate(text) {
  const m = text.match(/(\d{2})\.(\d{2})\.(\d{4}|\d{2})\s+(\d{1,2}):(\d{2})/) || text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!m) return null;
  const y = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${y}-${m[2]}-${m[1]}` + (m[4] ? `T${m[4].padStart(2, '0')}:${m[5]}` : '');
}

/* ---- stage 7: ingredient ---- */
const CONTAINERS = ['Dose', 'Glas', 'Packung', 'Becher'];
const FROZEN = /\btk\b|tiefk|tiefgefr|gefroren/i;

/* Receipt text without pack size and store brands: the key for learned aliases ("chain|text"; older ones without chain). */
export const cleanReceiptText = t => t.replace(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i, '').replace(/\b(bio|ja!?|gut&günstig|k-classic)\b/ig, '').replace(/\s+/g, ' ').trim();
export const aliasKey = (t, chain = null) => (chain ? `${chain}|` : '') + norm(cleanReceiptText(t));
export const findAlias = (aliases, text, chain) => aliases[aliasKey(text, chain)] || aliases[aliasKey(text)] || null;

/* Snacks (unless tracked), drinks, household goods: shown greyed out, not taken over unless the user taps. */
export function shouldSkip(name, opts = {}) {
  const c = catalogFor(name);
  return !!(c && (c.ignore || (c.snack && !opts.trackSnacks)));
}

/* Amount for a receipt line: pack size from the text ("1KG") in the ingredient's unit; whole pieces are rounded ("1 kg Zwiebeln" -> 7 Stück). */
export function receiptAmount(sz, qty, unit, c) {
  /* loose produce sold by the piece ("3 x 0,49 Tomaten"): pieces × average weight; one line without size: the usual pack */
  if (!sz && c && c.loose && qty > 1 && c.per && c.per['Stück']) return +(qty * c.per['Stück']).toFixed(1);
  if (!sz) return c && c.pack && !COUNT_UNITS.includes(unit) ? qty * c.pack : qty;   /* no size printed: usual pack */
  if (CONTAINERS.includes(unit)) return qty;   /* "Kichererbsen 400 g" is one can, whatever it weighs */
  const v = convert(sz[0] * qty, sz[1], unit, c);
  if (v == null) return qty;
  return COUNT_UNITS.includes(unit) ? Math.max(1, Math.round(v)) : +v.toFixed(1);
}

export function makeReceiptRow(text, qty, aliases, chain = null, weightKg = null) {
  const size = text.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i);
  let sz = size ? toBase(parseFloat(size[1].replace(',', '.')), size[2].toLowerCase()) : null;
  let n = qty;
  if (weightKg) { sz = [weightKg * 1000, 'g']; n = 1; }
  const clean = cleanReceiptText(text);
  const learned = findAlias(aliases, text, chain);
  let name, src, variety = null;
  if (learned && learned.ignore) { name = learned.ingredient || clean; src = 'ignored'; }
  else if (learned) { name = learned.ingredient; variety = learned.variety || null; src = 'learned'; }
  else {
    const r = ruleFor(clean);
    if (r) { name = r.name; variety = r.variety; src = 'rule'; }
    else { name = clean.toLowerCase().replace(/(^|\s)\S/g, s => s.toUpperCase()); src = 'unknown'; }
  }
  const c = catalogFor(name);
  const unit = learned?.unit || c?.unit || (sz ? sz[1] : 'Stück');
  const area = FROZEN.test(text) ? 'freezer' : learned?.area || c?.area || 'pantry';
  const amount = receiptAmount(sz, n, unit, c);
  /* "12 kg Champignons": more than five usual packs looks like a reading error */
  const odd = !!(c && c.pack && !COUNT_UNITS.includes(unit) && amount > 5 * c.pack * Math.max(1, n));
  return {id: uid(), text, name, variety, amount, unit, area, src, qty, sz, odd, ignored: src === 'ignored'};
}

/* ---- AI answer: "Bon-Text | Zutat | Sorte | Menge | Einheit | Bereich | Preis" (older: without Sorte and Preis) ---- */
export function parsePiped(lines) {
  const rows = [], deposits = [];
  let total = null;
  for (let l of lines) {
    l = l.trim().replace(/^\|/, '').replace(/\|$/, '');
    if (/^[\s|:\-]+$/.test(l)) continue;
    const p = l.split('|').map(x => x.trim());
    if (/^summe$/i.test(p[0]) && p[1]) { total = money(p[1]); continue; }
    if (p.length < 3 || /produktname|bon-?text|^zutat$/i.test(p[1] + p[0])) continue;
    const full = p.length >= 7;
    const [text, prod, variety, amountS, unitS, areaS, priceS] = full ? p : [p[0], p[1], null, p[2], p[3], p[4], null];
    let amount = parseFloat((amountS || '').replace(',', '.'));
    let unit = UNIT[(unitS || '').toLowerCase()] || unitS || 'Stück';
    if (isNaN(amount)) amount = 1;
    [amount, unit] = toBase(amount, unit);
    const c = catalogFor(prod), r = resolve(prod);
    const price = priceS ? money(priceS) : null;
    if (DEPOSIT.test(prod) || DEPOSIT.test(text)) { deposits.push({kind: 'deposit', price: price || 0, text}); continue; }
    rows.push({id: uid(), text, name: c ? c.name : prod, variety: variety || (r ? r.variety : null), amount, unit,
      area: areaS ? areaFromText(areaS) : (c?.area || 'pantry'), src: 'ai', qty: 1, price: isNaN(price) ? null : price, discount: 0});
  }
  return {rows, total, deposits};
}

/* The whole pipeline. Returns {chain, date, total, count, via, rows, discounts, deposits, checks}.
   via: pdf | text | ai. opts.trackSnacks: snacks are taken over like everything else. */
export function parseReceipt(text, aliases = {}, opts = {}) {
  const lines = text.split(/\r?\n/);
  const piped = lines.filter(l => l.includes('|'));
  let result;
  if (piped.length) {
    const {rows, total, deposits} = parsePiped(piped);
    const priced = rows.length && rows.every(r => r.price != null);
    const articles = rows.map(r => ({price: r.price || 0, discount: 0, qty: 1}));
    const checks = priced ? runChecks({articles, deposits, total}) : {sum: 'none', count: 'none', lines: 'ok', sumDiff: null};
    result = {chain: 'generic', date: null, total, count: null, via: 'ai', rows, discounts: [], deposits, checks};
  } else {
    const chain = detectChain(lines);
    const b = buildArticles(lines, chain);
    const rows = b.articles.map(a => ({...makeReceiptRow(a.text, a.qty, aliases, chain, a.weightKg),
      price: a.price, discount: a.discount, unitPrice: a.unitPrice, weightKg: a.weightKg, lineCheck: a.lineCheck}));
    result = {chain, date: receiptDate(text), total: b.total, count: b.count, via: opts.via || 'text', rows, discounts: b.discounts, deposits: b.deposits, checks: runChecks(b)};
  }
  for (const r of result.rows) r.skip = r.ignored || shouldSkip(r.name, opts);
  return result;
}

/* Identity for "schon eingelesen?" (spec 13.3): chain + date/time + total. null if the receipt has no date. */
export const receiptKey = (chain, date, total) => (date && total != null ? `${chain}|${date}|${total.toFixed(2)}` : null);
