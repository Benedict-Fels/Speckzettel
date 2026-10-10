/* Tab "Bon": AI prompt to copy, paste field, review table, learned aliases. */
import {app} from '../app.js';
import {esc} from '../text.js';
import {PICK_UNITS} from '../units.js';
import {AREAS} from '../areas.js';
import {AI_PROMPT} from '../samples.js';
import {SOURCE_LABELS} from '../receipt/pipeline.js';
import {header} from './components.js';

const ROW_UNITS = PICK_UNITS.filter(u => u !== 'Bund');

export function renderReceipt() {
  const {state, ui} = app;
  let h = header('Bon einlesen', 'Ohne eingebaute KI');
  h += `<div class="steps-how"><div><b>1 · Foto</b>Auftrag kopieren, in ChatGPT oder Gemini einfügen, Foto vom Bon anhängen.</div><div><b>2 · Antwort</b>Die Antwort kopieren und unten einfügen. Oder direkt den Text eines digitalen Bons.</div><div><b>3 · Prüfen</b>Liste kurz kontrollieren. Die App merkt sich deine Korrekturen.</div></div>`;
  h += `<div class="panel"><div class="spread"><h3>Auftrag für die KI</h3><button class="btn small primary" data-act="copyPrompt">Auftrag kopieren</button></div><div class="prompt-box" id="prompt">${esc(AI_PROMPT)}</div></div>`;
  h += `<div class="receipt stack"><label class="small" for="receipt-text" style="font-weight:500">KI-Antwort oder Bon-Text einfügen</label><textarea id="receipt-text" placeholder="Hier einfügen…">${esc(ui.receiptText)}</textarea>
    <div class="row"><button class="btn primary" data-act="parseReceipt">Auslesen</button><button class="btn ghost small" data-act="sampleAI">Beispiel: KI-Antwort</button><button class="btn ghost small" data-act="sampleReceipt">Beispiel: eBon-Text</button></div></div>`;
  if (ui.receiptRows) {
    const rows = ui.receiptRows;
    h += `<div class="panel" style="margin-top:8px"><div class="spread"><h3>Erkannt: ${rows.length} Artikel</h3><span class="small muted">Quelle: KI · Regel · gelernt · unbekannt</span></div>`;
    if (!rows.length) h += `<p class="muted">Nichts erkannt. Prüfe, ob der Text Artikelzeilen mit Preis oder das Format mit „|“ enthält.</p>`;
    else h += `<div class="receipt-rows">${rows.map(r => r.skip ? `<div class="receipt-row skipped"><span class="receipt-src">${esc(r.text)}</span><span class="small muted">${esc(r.name)} · wird nicht verfolgt</span>
      <button class="btn small ghost" data-act="receiptRowTake" data-v="${r.id}">Doch übernehmen</button></div>` : `<div class="receipt-row"><span class="receipt-src">${esc(r.text)}<br><span class="chip ${r.src === 'unknown' ? 'check' : 'plain'}">${SOURCE_LABELS[r.src]}</span></span>
      <input type="text" value="${esc(r.name)}" data-row="${r.id}" data-f="name" aria-label="Produkt">
      <input type="number" value="${r.amount}" step="any" min="0" data-row="${r.id}" data-f="amount" aria-label="Menge">
      <select data-row="${r.id}" data-f="unit" aria-label="Einheit">${ROW_UNITS.map(u => `<option ${u === r.unit ? 'selected' : ''}>${u}</option>`).join('')}</select>
      <select data-row="${r.id}" data-f="area" aria-label="Bereich">${Object.entries(AREAS).map(([k, l]) => `<option value="${k}" ${k === r.area ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <button class="remove" data-act="receiptRowDelete" data-v="${r.id}" aria-label="Zeile entfernen">×</button></div>`).join('')}</div>
      <div class="row"><button class="btn primary" data-act="receiptImport">In den Vorrat übernehmen (${rows.filter(r => !r.skip).length})</button></div>`;
    h += `</div>`;
  }
  const n = Object.keys(state.aliases).length;
  if (n) h += `<p class="small muted">Gelernte Bon-Texte: ${n}. Beim nächsten Bon erkennt die App sie ohne KI.</p>`;
  return h;
}
