/* Stage 3 of the receipt pipeline (spec 13.2): which chain printed the receipt, and how that chain lays out its lines.
   A template is a small description, not logic of its own. Unknown chains use "generic", which works for most layouts
   because quantity lines are matched by arithmetic first (stage 5). */
export const TEMPLATES = {
  netto: {label: 'Netto', header: /netto/i, qtyLine: 'before', countInTotal: true},
  rewe: {label: 'REWE', header: /\brewe\b/i, qtyLine: 'after', countInTotal: false},
  lidl: {label: 'Lidl', header: /\blidl\b/i, qtyLine: 'after', countInTotal: false},
  aldi: {label: 'Aldi', header: /\baldi\b/i, qtyLine: 'after', countInTotal: false},
  edeka: {label: 'Edeka', header: /\bedeka\b/i, qtyLine: 'after', countInTotal: false},
  kaufland: {label: 'Kaufland', header: /kaufland/i, qtyLine: 'after', countInTotal: false},
  penny: {label: 'Penny', header: /\bpenny\b/i, qtyLine: 'before', countInTotal: false},
  dm: {label: 'dm', header: /\bdm-?drogerie|\bdm\b markt/i, qtyLine: 'after', countInTotal: false},
  generic: {label: 'Bon', header: null, qtyLine: 'after', countInTotal: false},
};

/* Looks at the first lines (the head of the receipt). */
export function detectChain(lines) {
  const head = lines.slice(0, 10).join('\n');
  for (const [k, t] of Object.entries(TEMPLATES)) if (t.header && t.header.test(head)) return k;
  return 'generic';
}
export const chainLabel = k => (TEMPLATES[k] || TEMPLATES.generic).label;
