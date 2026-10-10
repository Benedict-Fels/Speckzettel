/* Tab "Bon" (spec 13.1 and 13.2 stage 8): start (eBon PDF first, then text, the AI route folded away),
   review drawn as the receipt itself with the app's reading under each line, checks on top. */
import {app} from '../app.js';
import {esc, nf} from '../text.js';
import {fmt, PICK_UNITS} from '../units.js';
import {AREAS} from '../areas.js';
import {catalogNames} from '../catalog.js';
import {AI_PROMPT} from '../samples.js';
import {SOURCE_LABELS} from '../receipt/pipeline.js';
import {chainLabel} from '../receipt/templates.js';
import {outcome, OUTCOME_LABELS} from '../receipt/history.js';
import {header} from './components.js';

const ROW_UNITS = [...new Set([...PICK_UNITS, 'Stück', 'Becher'])];
const euro = n => `${n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
const dateText = d => {
  if (!d) return '';
  const [day, time] = d.split('T');
  const [y, m, dd] = day.split('-');
  return `${+dd}.${+m}.${y}${time ? ` · ${time}` : ''}`;
};
const label = r => r.variety ? `${r.name} (${r.variety})` : r.name;

function checkLine(res) {
  const n = res.rows.length;
  const c = res.checks;
  const items = `${n} ${n === 1 ? 'Artikel' : 'Artikel'}`;
  if (c.sum === 'ok') return `<p class="check-ok">✓ Summe stimmt (${euro(res.total)} €) · ${items}${c.count === 'ok' ? ' · Anzahl stimmt' : ''}</p>`;
  if (c.sum === 'off') return `<p class="check-off">Summe weicht um ${euro(Math.abs(c.sumDiff))} € ab – fehlt eine Zeile oder ist ein Preis falsch gelesen? Gelesen: ${euro(c.sumFound)} €, Bon: ${euro(res.total)} €</p>`;
  return `<p class="check-none">Keine Summe gefunden, nicht nachgerechnet · ${items}</p>`;
}

function editForm(r) {
  return `<div class="receipt-edit">
    <label class="fld">Zutat<input type="text" id="receipt-name-${r.id}" list="catalog-names" value="${esc(r.name)}" data-row="${r.id}" data-f="name" autocomplete="off"></label>
    <div class="grid3">
      <label class="fld">Menge<input type="number" value="${r.amount}" step="any" min="0" inputmode="decimal" data-row="${r.id}" data-f="amount"></label>
      <label class="fld">Einheit<select data-row="${r.id}" data-f="unit">${ROW_UNITS.map(u => `<option ${u === r.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
      <label class="fld">Bereich<select data-row="${r.id}" data-f="area">${Object.entries(AREAS).map(([k, l]) => `<option value="${k}" ${k === r.area ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    </div>
    <label class="fld">Sorte (optional)<input type="text" value="${esc(r.variety || '')}" data-row="${r.id}" data-f="variety" placeholder="z. B. griechisch"></label>
    <div class="row"><button class="btn small primary" data-act="receiptRowEdit" data-v="${r.id}">Fertig</button><button class="btn small ghost" data-act="receiptRowSkip" data-v="${r.id}">Nicht übernehmen</button></div></div>`;
}

function rowBlock(r) {
  const editing = app.ui.receiptEdit === r.id;
  let h = `<div class="rc-line${r.skip ? ' skipped' : ''}">`;
  if (r.qty > 1 && r.unitPrice != null) h += `<div class="rc-paper rc-qty"><span>${nf(r.qty)} x ${euro(r.unitPrice)}</span>${r.lineCheck === 'off' ? '<span class="rc-warn">passt nicht</span>' : ''}</div>`;
  if (r.weightKg) h += `<div class="rc-paper rc-qty"><span>${nf(r.weightKg)} kg x ${euro(r.unitPrice)} €/kg</span></div>`;
  h += `<div class="rc-paper"><span class="rc-text">${esc(r.text)}</span><span class="num">${r.price != null ? euro(r.price) : ''}</span></div>`;
  if (r.discount) h += `<div class="rc-paper rc-minor"><span>Rabatt</span><span class="num">${euro(r.discount)}</span></div>`;
  if (r.skip) {
    const why = r.src === 'ignored' ? 'immer ignoriert' : r.userSkip ? 'wird nicht übernommen' : `${esc(label(r))} · wird nicht verfolgt`;
    h += `<div class="rc-read muted"><span>${why}</span>
      <span class="row">${r.userSkip ? `<label class="flag"><input type="checkbox" data-ignore-always="${r.id}" ${r.ignoreAlways ? 'checked' : ''}> immer ignorieren</label>` : ''}<button class="btn small ghost" data-act="receiptRowTake" data-v="${r.id}">Doch übernehmen</button></span></div>`;
  } else if (r.src === 'unknown' && !editing) {
    h += `<div class="rc-read"><span class="warn-text">⚠ unbekannt</span><span class="row"><button class="btn small" data-act="receiptRowEdit" data-v="${r.id}">Zutat wählen</button><button class="btn small ghost" data-act="receiptRowSkip" data-v="${r.id}">Nicht übernehmen</button></span></div>`;
  } else {
    h += `<div class="rc-read"><span>→ <b>${esc(label(r))}</b> <span class="num">${esc(fmt(r.amount, r.unit))}</span> · ${AREAS[r.area]}${r.odd ? ' <span class="warn-text">· ungewöhnlich viel – stimmt das?</span>' : ''}</span>
      <span class="row"><span class="chip ${r.edited ? 'ok' : 'plain'}">${r.edited ? 'korrigiert' : SOURCE_LABELS[r.src]}</span><button class="icon-btn small" data-act="receiptRowEdit" data-v="${r.id}" aria-label="${esc(r.text)} ändern" aria-expanded="${editing}">✎</button></span></div>`;
  }
  if (editing) h += editForm(r);
  return h + '</div>';
}

function review(res) {
  const rows = res.rows, take = rows.filter(r => !r.skip).length;
  const dup = app.ui.receiptDuplicate;
  let h = `<section class="stack" id="receipt-review" aria-label="Erkannter Bon"><div class="spread"><h2>${esc(chainLabel(res.chain))}${res.date ? ` · ${dateText(res.date)}` : ''}</h2><span class="small muted">${res.via === 'pdf' ? 'aus dem PDF' : res.via === 'ai' ? 'KI-Antwort' : 'eingefügter Text'}</span></div>`;
  h += checkLine(res);
  if (res.checks.count === 'off') h += `<p class="small warn-text">Auf dem Bon stehen ${res.count} Artikel, gelesen wurden ${rows.reduce((s, r) => s + (r.weightKg ? 1 : r.qty || 1), 0)}.</p>`;
  if (res.checks.lines === 'off') h += `<p class="small warn-text">Bei einer Zeile passt Menge × Preis nicht – bitte prüfen.</p>`;
  if (dup) h += `<div class="notice"><span>Diesen Bon hast du am ${new Date(dup.importedAt).toLocaleDateString('de-DE')} schon eingelesen. Trotzdem übernehmen?</span></div>`;
  if (!rows.length) h += `<div class="panel empty">Keine Artikel erkannt. Steht im Text eine Zeile mit Name und Preis, oder das KI-Format mit „|“?</div>`;
  else {
    h += `<div class="receipt rc">${rows.map(rowBlock).join('')}`;
    for (const d of res.deposits) h += `<div class="rc-line"><div class="rc-paper rc-minor"><span>${esc(d.text)}</span><span class="num">${euro(d.price)}</span></div></div>`;
    for (const d of res.discounts) h += `<div class="rc-line"><div class="rc-paper rc-minor"><span>${esc(d.text)}</span><span class="num">${euro(d.price)}</span></div></div>`;
    if (res.total != null) h += `<div class="rc-line rc-total"><div class="rc-paper"><span>SUMME${res.count ? ` [${res.count}]` : ''}</span><span class="num">${euro(res.total)}${res.checks.sum === 'ok' ? ' ✓' : res.checks.sum === 'off' ? ' ✗' : ''}</span></div></div>`;
    h += `</div><p class="small muted">Rabatt und Pfand zählen nur für die Summe. Grau: wird nicht in den Vorrat übernommen.</p>`;
  }
  h += `<div class="row"><button class="btn primary" data-act="receiptImport" ${take ? '' : 'disabled'}>${take} in den Vorrat übernehmen</button><button class="btn ghost" data-act="receiptDiscard">Verwerfen</button></div>`;
  if (app.ui.receiptEdit) h += `<datalist id="catalog-names">${catalogNames().map(n => `<option value="${esc(n)}">`).join('')}</datalist>`;
  return h + '</section>';
}

function recent(receipts) {
  if (!receipts.length) return '';
  const last = [...receipts].sort((a, b) => b.importedAt - a.importedAt).slice(0, 5);
  return `<div class="stack"><h3>Letzte Bons</h3><div class="items">${last.map(r => {
    const o = outcome(r), n = r.lines.filter(l => !l.skipped).length;
    return `<div class="shop-row"><span class="shop-name">${esc(chainLabel(r.chain))} · ${r.date ? dateText(r.date).split(' · ')[0] : new Date(r.importedAt).toLocaleDateString('de-DE')}</span>
      <span class="muted num small">${r.total != null ? `${euro(r.total)} € · ` : ''}${n} Artikel</span><span class="chip ${o === 'smooth' ? 'ok' : o === 'error' ? 'buy' : 'check'}">${OUTCOME_LABELS[o]}</span></div>`;
  }).join('')}</div></div>`;
}

export function renderReceipt() {
  const {state, ui} = app;
  let h = header('Bon einlesen', 'Kassenbon rein, Vorrat da – ohne eingebaute KI');
  if (ui.receipt) return h + review(ui.receipt);
  h += `<button class="start-card" data-act="pdfPick" ${ui.receiptBusy ? 'disabled' : ''}><span class="start-icon" aria-hidden="true">📄</span><span><b>${ui.receiptBusy ? 'PDF wird gelesen …' : 'eBon-PDF wählen'}</b><span class="small muted">In der Netto-, REWE- oder Lidl-App den eBon laden, dann hier auswählen.</span></span></button>
    <input type="file" id="receipt-file" accept="application/pdf,.pdf" hidden>`;
  h += `<div class="panel"><h3>📋 Text einfügen</h3><p class="small muted">Text eines digitalen Bons oder die Antwort deiner KI.</p>
    <div class="receipt"><label class="sr-only" for="receipt-text">Bon-Text</label><textarea id="receipt-text" placeholder="Hier einfügen…">${esc(ui.receiptText)}</textarea></div>
    <div class="row"><button class="btn primary" data-act="parseReceipt">Auslesen</button><button class="btn ghost small" data-act="sampleReceipt">Beispiel: eBon-Text</button><button class="btn ghost small" data-act="sampleAI">Beispiel: KI-Antwort</button></div></div>`;
  h += `<details class="panel how"${ui.receiptHow ? ' open' : ''}><summary data-act="toggleReceiptHow"><h3>📷 Papierbon? Mit deiner KI auslesen ${ui.receiptHow ? '▴' : '▾'}</h3></summary>
    <div class="steps-how"><div><b>1 · Auftrag</b>Kopieren und in ChatGPT, Gemini oder Claude einfügen, Foto vom Bon anhängen.</div><div><b>2 · Antwort</b>Die Antwort kopieren und oben bei „Text einfügen“ einfügen.</div><div><b>3 · Prüfen</b>Die App rechnet die Summe nach und merkt sich deine Korrekturen.</div></div>
    <div class="spread"><h3>Auftrag für die KI</h3><button class="btn small primary" data-act="copyPrompt">Auftrag kopieren</button></div><div class="prompt-box" id="prompt">${esc(AI_PROMPT)}</div></details>`;
  h += recent(state.receipts || []);
  const n = Object.keys(state.aliases).length;
  if (n) h += `<p class="small muted">Gelernte Bon-Texte: ${n}. Beim nächsten Bon erkennt die App sie von selbst.</p>`;
  return h;
}
