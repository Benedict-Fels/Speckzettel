/* Small string helpers shared by logic and views. */
export const uid = () => Math.random().toString(36).slice(2, 9);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
export const nf = n => Number(n).toLocaleString('de-DE', {maximumFractionDigits: 1});
export const norm = s => (s || '').toLowerCase().replace(/[^a-zäöüß0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
