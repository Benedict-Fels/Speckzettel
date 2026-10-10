/* "Gekocht" preview (spec 11.1): what will be taken from the pantry, each line correctable before anything changes. */
import {app} from '../app.js';
import {esc} from '../text.js';
import {fmt} from '../units.js';
import {levelText} from '../pantry.js';

const LEVELS = [[1, 'voll'], [.5, 'halb'], [.25, 'fast leer'], [0, 'leer']];
const bars = l => { const n = Math.round(l * 4); return `<span class="level" title="${levelText(l)}">${[1, 2, 3, 4].map(k => `<i class="${k <= n ? 'on' : ''}"></i>`).join('')}</span>`; };
const amountText = (a, u) => a <= 0.001 ? 'weg' : fmt(+a.toFixed(2), u);

function row(x) {
  const head = (change, cls = '') => `<div class="cook-head"><b>${esc(x.name)}</b><span class="cook-change num ${cls}">${change}</span></div>`;
  switch (x.kind) {
    case 'staple': return `<div class="cook-row muted">${head('bleibt')}</div>`;
    case 'none': return `<div class="cook-row muted">${head(x.optional ? 'optional, nicht da' : 'nicht im Vorrat')}</div>`;
    case 'flag': return `<div class="cook-row">${head(x.gone ? 'da → weg' : 'bleibt da')}
      <label class="check"><input type="checkbox" data-cook-flag="${x.n}" ${x.gone ? 'checked' : ''}> aufgebraucht</label></div>`;
    case 'rough': return `<div class="cook-row">${head(`${bars(x.before)} → ${bars(x.after)} ${x.after <= 0 ? '<b>leer?</b>' : ''}`)}
      <div class="seg" role="group" aria-label="Füllstand danach">${LEVELS.map(([v, l]) => `<button type="button" class="${Math.abs(x.after - v) < .13 ? 'on' : ''}" data-act="cookLevel" data-v="${x.n}" data-l="${v}">${l}</button>`).join('')}</div>
      ${x.after <= 0 ? '<p class="small muted">Wird aus dem Vorrat genommen. Noch ein Rest drin? Dann „fast leer“ antippen.</p>' : ''}</div>`;
    case 'exact': {
      const after = Math.max(0, x.have - x.use);
      return `<div class="cook-row">${head(`${amountText(x.have, x.unit)} → ${amountText(after, x.unit)}`, after <= 0.001 ? 'gone' : '')}
        <div class="pack-amount"><span class="small muted">verbraucht</span><div class="stepper"><button type="button" data-act="cookStep" data-v="${x.n}" data-d="-1" aria-label="weniger">−</button>
        <input type="number" id="cook-use-${x.n}" data-cook-use="${x.n}" value="${+x.use.toFixed(2)}" min="0" step="any" inputmode="decimal" aria-label="verbraucht in ${esc(x.unit)}">
        <button type="button" data-act="cookStep" data-v="${x.n}" data-d="1" aria-label="mehr">+</button></div><span class="muted">${esc(x.unit)}</span></div>
        ${x.hint ? `<p class="small muted">${esc(x.hint)}</p>` : ''}</div>`;
    }
    default: return '';
  }
}

export function cookSheet(sh) {
  const r = app.state.recipes.find(x => x.id === sh.recipeId);
  if (!r) return null;
  const rows = sh.plan;
  return `<div class="sheet-head"><div><h2 id="sheet-title">Gekocht: ${esc(r.title)}</h2><p class="muted small">für ${sh.persons} ${sh.persons === 1 ? 'Person' : 'Personen'} · so ändert sich der Vorrat</p></div>
      <button class="icon-btn" data-act="closeSheet" aria-label="Schließen">✕</button></div>
    <div class="cook-rows">${rows.map(row).join('')}</div>
    <div class="row"><button class="btn primary" data-act="cookApply">Passt, abziehen</button><button class="btn ghost" data-act="closeSheet">Abbrechen</button></div>`;
}
