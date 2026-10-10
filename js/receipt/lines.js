/* Stage 2 of the receipt pipeline (spec 13.2): text pieces with positions (from pdf.js) -> lines of text.
   Pieces on the same height (± half a line) form one line, sorted left to right; a wide gap becomes several spaces,
   so "Champignon weiss 400g      3,38 B" keeps name and price apart like the printed receipt. No DOM, testable. */

/* items: [{str, x, y, w, h}] with y growing upwards (PDF coordinates). Returns an array of strings, top to bottom. */
export function itemsToLines(items) {
  const pieces = items.filter(i => i.str && i.str.trim()).map(i => ({...i, h: i.h || 8}));
  if (!pieces.length) return [];
  pieces.sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  for (const p of pieces) {
    const row = rows.find(r => Math.abs(r.y - p.y) <= Math.max(2.5, Math.min(r.h, p.h) / 2));
    if (row) { row.items.push(p); row.h = Math.max(row.h, p.h); }
    else rows.push({y: p.y, h: p.h, items: [p]});
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map(r => {
    r.items.sort((a, b) => a.x - b.x);
    let out = '', end = null;
    for (const it of r.items) {
      if (end != null) {
        const charW = it.str.length ? it.w / it.str.length : 5;
        const gap = it.x - end;
        out += gap > charW * 2 ? '    ' : gap > charW * .3 ? ' ' : '';
      }
      out += it.str;
      end = it.x + it.w;
    }
    return out.replace(/\s+$/, '');
  });
}
