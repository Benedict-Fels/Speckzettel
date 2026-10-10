/* Receipts that were taken over (spec 2.5, 13.3, 13.4). Only chain, date, total and article lines are kept:
   no branch, no loyalty card, no payment or TSE data. Used for "schon eingelesen?", the receipt statistics
   and later for spending. */
import {now} from '../clock.js';
import {uid} from '../text.js';
import {receiptKey} from './pipeline.js';
import {chainLabel} from './templates.js';

/* rows: the reviewed rows (after corrections). */
export function receiptRecord(result, rows, t = now()) {
  const key = receiptKey(result.chain, result.date, result.total);
  return {
    id: `r_${uid()}`, key, chain: result.chain, date: result.date, total: result.total, importedAt: t, via: result.via,
    checks: {sum: result.checks.sum, count: result.checks.count, lines: result.checks.lines},
    corrected: rows.some(r => r.edited || (r.src === 'unknown' && !r.skip)),
    lines: rows.map(r => ({text: r.text, qty: r.qty ?? 1, unitPrice: r.unitPrice ?? null, price: r.price ?? null, discount: r.discount || 0,
      ingredient: r.skip ? null : r.name, variety: r.variety || null, amount: r.amount, unit: r.unit, match: r.src, edited: !!r.edited, skipped: !!r.skip})),
  };
}

/* An earlier receipt with the same chain, date/time and total, or null. */
export const findDuplicate = (receipts, result) => {
  const key = receiptKey(result.chain, result.date, result.total);
  return key ? (receipts || []).find(r => r.key === key) || null : null;
};

/* Outcome for the statistics (spec 13.4): smooth = all checks fine and nothing corrected, corrected, error = sum did not match. */
export function outcome(rec) {
  if (rec.checks.sum === 'off' || rec.checks.lines === 'off') return 'error';
  if (rec.corrected) return 'corrected';
  return rec.checks.sum === 'ok' ? 'smooth' : 'corrected';
}
export const OUTCOME_LABELS = {smooth: 'glatt', corrected: 'korrigiert', error: 'Fehler'};

export function receiptStats(receipts) {
  const out = {total: receipts.length, smooth: 0, corrected: 0, error: 0};
  for (const r of receipts) out[outcome(r)]++;
  return out;
}

/* Article lines of all receipts as text, to sharpen the templates on a computer. Nothing personal is in there. */
export function receiptsExport(receipts) {
  return receipts.map(r => [`# ${chainLabel(r.chain)} ${r.date || ''} Summe ${r.total ?? '?'} (${OUTCOME_LABELS[outcome(r)]})`,
    ...r.lines.map(l => `${l.qty > 1 ? `${l.qty} x ${l.unitPrice ?? ''} | ` : ''}${l.text} | ${l.price ?? ''}${l.discount ? ` | Rabatt ${l.discount}` : ''} -> ${l.skipped ? '(nicht übernommen)' : `${l.ingredient}${l.variety ? ` (${l.variety})` : ''} ${l.amount} ${l.unit}`} [${l.match}${l.edited ? ', korrigiert' : ''}]`)].join('\n')).join('\n\n');
}
