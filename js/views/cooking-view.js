/* Tab "Kochen": overview with filters (spec 8.1), recipe page with the pantry check (8.2), recipe form (9.1). */
import {app} from '../app.js';
import {esc} from '../text.js';
import {now, daysBetween} from '../clock.js';
import {recipeScore, recipeCheck, shoppingCandidates, fitsDiet, recipeDiet, suggestedDiet, matchesFilters, RECIPE_FILTERS, ingredientLabel} from '../recipes.js';
import {RECIPE_ICONS, iconOf, suggestIcon} from '../recipe-icons.js';
import {lineInfo} from '../recipe-edit.js';
import {activeTime} from '../recipe-model.js';
import {fmt} from '../units.js';
import {key} from '../catalog.js';
import {header} from './components.js';

const STATUS_LABELS = {ok: 'da', check: 'schau nach', buy: 'fehlt', optional: 'optional'};
export const DIET_TEXT = {vegan: 'vegan', vegetarian: 'vegetarisch', all: 'mit Fleisch/Fisch'};

const mins = m => m < 60 ? `${m} Min` : m % 60 ? `${Math.floor(m / 60)} Std ${m % 60} Min` : `${m / 60} Std`;
const timeText = r => {
  const parts = [];
  if (r.prepTime && r.cookTime) parts.push(`${r.prepTime} + ${r.cookTime} Min`);
  else if (activeTime(r)) parts.push(mins(activeTime(r)));
  if (r.restTime) parts.push(`+ ${mins(r.restTime)} Ruhezeit`);
  return parts.join(' ');
};
const lastCookedText = r => {
  if (!r.cookedAt || !r.cookedAt.length) return 'Noch nie gekocht';
  const d = daysBetween(Math.max(...r.cookedAt), now());
  return `Zuletzt gekocht ${d <= 0 ? 'heute' : d === 1 ? 'gestern' : `vor ${d} Tagen`}`;
};

/* ---- recipe page ---- */
/* Quick answers right in the line (spec 8.2, "Fragen statt Eintragen"): they change the pantry at once. */
function quickButtons(x, n) {
  if (x.status === 'check' && x.fix === 'shaky') return `<button class="btn small" data-act="quickHave" data-v="${n}">Ist da</button><button class="btn small ghost danger" data-act="quickGone" data-v="${n}">Weg</button>`;
  if (x.status === 'check' && x.fix === 'low') return `<button class="btn small" data-act="quickHave" data-v="${n}">Reicht noch</button><button class="btn small ghost danger" data-act="quickGone" data-v="${n}">Leer</button>`;
  return '';
}

function checkRow(x, n) {
  const tags = x.raw ? '<span class="tag">roh</span>' : '';
  const note = x.onList && (x.status === 'buy' || x.status === 'optional') ? `${x.note} · steht auf dem Zettel` : x.note;
  const quick = quickButtons(x, n);
  return `<div class="check-row${x.status === 'optional' ? ' is-optional' : ''}">
    <span class="chip ${x.status}">${STATUS_LABELS[x.status]}</span>
    <span class="check-name"><b>${esc(ingredientLabel(x.ing))}</b>${tags}${x.optional && x.status !== 'optional' ? ' <span class="muted small">optional</span>' : ''}</span>
    <span class="check-qty num">${esc(x.label)}</span>
    <span class="note">${esc(note)}</span>${quick ? `<span class="quick">${quick}</span>` : ''}</div>`;
}

/* "Auf den Einkaufszettel": first tap shows what would go on the list (untick what is there after all,
   tick optional extras), second tap adds the ticked ones. */
function shopBlock(rows, missingCount) {
  const pick = app.ui.shopPick && app.ui.shopPick.recipeId === app.ui.recipeId ? app.ui.shopPick : null;
  const cook = '<button class="btn primary" data-act="cookPreview">Gekocht – vom Vorrat abziehen</button>';
  if (!pick) {
    const cands = shoppingCandidates(rows, () => false).filter(c => !rows[c.n].onList);
    if (!cands.length) return `<div class="row">${cook}</div>`;
    const label = missingCount ? `Fehlendes auf den Einkaufszettel (${missingCount})` : `Optionales auf den Einkaufszettel …`;
    return `<div class="row"><button class="btn" data-act="shopPickOpen">${label}</button>${cook}</div>`;
  }
  const n = pick.items.filter(c => c.checked).length;
  return `<div class="shop-pick" role="group" aria-labelledby="shop-pick-title"><h3 id="shop-pick-title">Was soll auf den Zettel?</h3>
    <p class="small muted">Abwählen, was doch da ist.</p>
    ${pick.items.map((c, i) => `<label class="pick-row"><input type="checkbox" data-shop-pick="${i}" ${c.checked ? 'checked' : ''}>
      <span><b>${esc(c.label)}</b>${c.optional ? ' <span class="muted small">optional</span>' : ''}</span><span class="muted num">${c.amount != null ? esc(fmt(c.amount, c.unit)) : ''}</span></label>`).join('')}
    <div class="row"><button class="btn primary" data-act="shopPickConfirm" ${n ? '' : 'disabled'}>${n ? `${n} auf den Zettel` : 'Nichts ausgewählt'}</button><button class="btn ghost" data-act="shopPickCancel">Abbrechen</button></div></div>
    <div class="row">${cook}</div>`;
}

function renderRecipe(r) {
  const persons = app.ui.persons;
  const listed = new Set(app.state.shopping.filter(x => !x.done).map(x => key(x.name)));
  const rows = recipeCheck(app.state.items, r, persons).map(x => ({...x, onList: listed.has(key(x.ing.name))}));
  const buy = rows.filter(x => x.status === 'buy'), buyNew = buy.filter(x => !x.onList), chk = rows.filter(x => x.status === 'check');
  const diet = recipeDiet(r);
  const meta = [r.summary, timeText(r), app.state.household.diet !== 'vegan' && diet !== 'all' ? DIET_TEXT[diet] : null].filter(Boolean).map(esc).join(' · ');
  let h = `<div class="spread top-actions"><button class="btn ghost small" data-act="back">← Alle Rezepte</button><button class="btn small" data-act="editRecipe">Bearbeiten</button></div>`;
  h += header(`<span class="recipe-icon big" aria-hidden="true">${iconOf(r.icon)}</span>${esc(r.title)}`, meta);
  h += `<div class="panel"><div class="spread"><h3>Ich koche für</h3><div class="stepper"><button data-act="persons" data-v="-1" aria-label="weniger">−</button><span>${persons} ${persons === 1 ? 'Person' : 'Personen'}</span><button data-act="persons" data-v="1" aria-label="mehr">+</button></div></div>
    <p class="small muted">${buy.length ? `${buy.length} fehlt` : 'Alles da'}${chk.length ? ` · bei ${chk.length} lieber kurz nachschauen` : ''}</p>
    <div class="checklist">${rows.map(checkRow).join('')}</div>
    ${shopBlock(rows, buyNew.length)}</div>`;
  if (r.steps?.length) h += `<div class="panel"><h3>Zubereitung</h3><ol class="steps">${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>`;
  const src = r.source ? (r.source.url ? `<a href="${esc(r.source.url)}" target="_blank" rel="noopener">${esc(r.source.name || r.source.url)}</a>` : esc(r.source.name)) : '';
  h += `<div class="stack small muted recipe-foot">${src ? `<span>Quelle: ${src}</span>` : ''}<span>${lastCookedText(r)}${r.basedOn ? ' · von dir geändert (mitgeliefertes Rezept)' : ''}</span></div>`;
  h += `<div class="row">${r.basedOn ? '<button class="btn small" data-act="restoreRecipe">Original wiederherstellen</button>' : ''}<button class="btn small danger" data-act="deleteRecipe">Rezept löschen</button></div>`;
  return h;
}

/* ---- form ---- */
function hintFor(text) {
  const info = lineInfo(text);
  if (!info) return '';
  const parts = [info.amount != null ? fmt(info.amount, info.unit) : 'nach Geschmack', info.name, info.variety].filter(Boolean).map(esc).join(' · ');
  return info.known ? `<span class="ok-text">✓ ${parts}</span>` : `<span class="warn-text">${parts} · neue Zutat, kenne ich noch nicht</span>`;
}
export const lineHint = (d, n) => hintFor(d.lines[n].text);

function lineRow(l, n, d) {
  return `<div class="ing-line">
    <div class="ing-input"><input type="text" id="ing-line-${n}" data-line="${n}" value="${esc(l.text)}" placeholder="z. B. 200 g Linsen (rot)" aria-label="Zutat ${n + 1}" autocomplete="off" enterkeyhint="next">
      <button type="button" class="remove" data-act="lineRemove" data-v="${n}" aria-label="Zutat entfernen">×</button></div>
    <div class="ing-meta"><span class="ing-hint small" id="ing-hint-${n}">${lineHint(d, n)}</span>
      <span class="ing-flags"><label class="flag"><input type="checkbox" data-line-flag="optional" data-v="${n}" ${l.optional ? 'checked' : ''}> optional</label>
      <label class="flag"><input type="checkbox" data-line-flag="raw" data-v="${n}" ${l.raw ? 'checked' : ''}> roh</label></span></div></div>`;
}

function stepRow(s, n, total) {
  return `<div class="step-line"><span class="step-no num">${n + 1}</span>
    <textarea id="step-${n}" data-step="${n}" rows="2" aria-label="Schritt ${n + 1}" placeholder="Ein Handgriff, ohne Mengen">${esc(s)}</textarea>
    <span class="step-tools"><button type="button" class="icon-btn small" data-act="stepMove" data-v="${n}" data-d="-1" aria-label="nach oben" ${n === 0 ? 'disabled' : ''}>↑</button>
    <button type="button" class="icon-btn small" data-act="stepMove" data-v="${n}" data-d="1" aria-label="nach unten" ${n === total - 1 ? 'disabled' : ''}>↓</button>
    <button type="button" class="icon-btn small" data-act="stepRemove" data-v="${n}" aria-label="Schritt entfernen">×</button></span></div>`;
}

function renderRecipeForm() {
  const d = app.ui.draft;
  const editing = !!d.id;
  const existing = editing ? app.state.recipes.find(r => r.id === d.id) : null;
  const names = d.lines.map(l => (lineInfo(l.text) || {}).name).filter(Boolean);
  const autoIcon = suggestIcon(d.title, names);
  const icon = d.icon || autoIcon;
  const dietAuto = suggestedDiet({ingredients: names.map(name => ({name}))});
  const num = (id, label, v, extra = '') => `<label class="fld">${label}<input type="number" id="${id}" data-draft="${id.replace('recipe-', '')}" value="${esc(v)}" min="0" inputmode="numeric" ${extra}></label>`;
  let h = `<div class="spread top-actions"><button class="btn ghost small" data-act="cancelRecipe">← Abbrechen</button></div>` + header(editing ? 'Rezept bearbeiten' : 'Neues Rezept');
  if (existing && existing.origin === 'starter') h += `<p class="notice small">Das ist ein mitgeliefertes Rezept. Beim Speichern wird es zu deinem eigenen; das Original kannst du später wiederherstellen.</p>`;
  h += `<details class="panel paste"${editing ? '' : ' open'}><summary><h3>Text einfügen</h3></summary><p class="small muted">Kopierter Rezepttext, z. B. von Instagram oder einer ganzen Webseite. Die App sucht ohne KI nach Zutaten (Zeilen mit Menge) und Schritten und füllt das Formular unten.</p>
    <textarea id="recipe-text" data-paste-text placeholder="Rezepttext hier einfügen…">${esc(app.ui.pasteText || '')}</textarea>
    <div class="row"><button class="btn primary" type="button" data-act="parseRecipe">Auslesen</button><button class="btn ghost small" type="button" data-act="sampleRecipeText">Beispiel einfügen</button></div></details>`;
  h += `<form class="panel" data-form="recipe" novalidate>
    <label class="fld">Name<input type="text" id="recipe-title" data-draft="title" value="${esc(d.title)}" placeholder="z. B. Rotes Linsen-Dal" autocomplete="off"></label>
    <label class="fld">Kurz beschrieben (optional)<input type="text" id="recipe-summary" data-draft="summary" value="${esc(d.summary)}" placeholder="eine Zeile für die Karte" autocomplete="off"></label>
    <div class="grid4">${num('recipe-servings', 'Portionen', d.servings, 'min="1"')}${num('recipe-prepTime', 'Arbeitszeit (Min)', d.prepTime)}${num('recipe-cookTime', 'Kochzeit (Min)', d.cookTime)}${num('recipe-restTime', 'Ruhezeit (Min)', d.restTime)}</div>
    <fieldset class="icon-pick"><legend>Symbol${d.icon ? '' : ' <span class="muted small">(vorgeschlagen)</span>'}</legend>
      <div class="icon-grid">${Object.entries(RECIPE_ICONS).map(([k, [e, l]]) => `<button type="button" class="icon-choice${k === icon ? ' on' : ''}" data-act="pickIcon" data-v="${k}" aria-pressed="${k === icon}" title="${l}"><span aria-hidden="true">${e}</span><span class="sr-only">${l}</span></button>`).join('')}</div></fieldset>
    <label class="fld">Ernährung<select id="recipe-diet" data-draft="diet"><option value="">aus den Zutaten: ${DIET_TEXT[dietAuto]}</option>${['vegan', 'vegetarian', 'all'].map(k => `<option value="${k}" ${d.diet === k ? 'selected' : ''}>${DIET_TEXT[k]}</option>`).join('')}</select></label>
    <div class="stack"><h3>Zutaten</h3><p class="small muted">Eine pro Zeile, z. B. „200 g Linsen (rot)“. <b>optional</b>: zählt nicht als fehlend. <b>roh</b>: wird nicht durchgegart – Eier über dem MHD gelten dann als fehlend.</p>
      <div class="ing-lines">${d.lines.map((l, n) => lineRow(l, n, d)).join('')}</div>
      <div class="row"><button type="button" class="btn small" data-act="lineAdd">+ Zutat</button></div></div>
    <div class="stack"><h3>Zubereitung</h3>
      <div class="step-lines">${d.steps.map((s, n) => stepRow(s, n, d.steps.length)).join('')}</div>
      <div class="row"><button type="button" class="btn small" data-act="stepAdd">+ Schritt</button></div></div>
    <details class="more"${d.sourceName || d.sourceUrl ? ' open' : ''}><summary>Quelle ▾</summary><div class="grid2">
      <label class="fld">Name<input type="text" id="recipe-sourceName" data-draft="sourceName" value="${esc(d.sourceName)}" placeholder="z. B. Tutto Bene"></label>
      <label class="fld">Adresse<input type="url" id="recipe-sourceUrl" data-draft="sourceUrl" value="${esc(d.sourceUrl)}" placeholder="https://…"></label></div></details>
    <div class="row form-actions"><button class="btn primary" type="submit">Speichern</button><button class="btn ghost" type="button" data-act="cancelRecipe">Abbrechen</button></div></form>`;
  return h;
}

/* ---- overview ---- */
function card(r, s, diet) {
  const time = activeTime(r);
  const line1 = [`${s.ok} von ${s.total} da`, s.ch ? `${s.ch} nachschauen` : '', s.over ? `${s.over} drüber` : ''].filter(Boolean).join(' · ');
  const dietBadge = (diet === 'all' || !diet) && recipeDiet(r) !== 'all' ? `<span class="tag">${DIET_TEXT[recipeDiet(r)]}</span>` : '';
  return `<button class="recipe-card" data-act="recipe" data-v="${esc(r.id)}">
    <span class="rc-head"><span class="recipe-icon" aria-hidden="true">${iconOf(r.icon)}</span><span class="rc-title"><b>${esc(r.title)}</b>${dietBadge}</span>${time ? `<span class="rc-time small muted num">${mins(time)}</span>` : ''}</span>
    <span class="bar" aria-hidden="true"><span style="width:${Math.round(s.pct * 100)}%"></span></span>
    <span class="small muted num">${line1}</span>
    ${s.buy && s.buy <= 2 ? `<span class="small">fehlt: ${esc(s.missing.join(', '))}</span>` : ''}
    ${s.soon.length ? `<span class="chip check">verbraucht ${esc(s.soon.map(x => `${x.name} (${x.when})`).join(', '))}</span>` : ''}</button>`;
}

export function renderCooking() {
  const {state, ui} = app;
  if (ui.recipeForm && ui.draft) return renderRecipeForm();
  const r = state.recipes.find(x => x.id === ui.recipeId);
  if (r) return renderRecipe(r);
  const diet = state.household.diet;
  const fitting = state.recipes.filter(r => r.origin === 'own' || (diet !== 'none' && fitsDiet(r, diet)));
  const hidden = state.recipes.length - fitting.length;
  const filters = ui.recipeFilters || [];
  const t = now();
  const scored = fitting.map(r => ({r, s: recipeScore(state.items, r, t)}))
    .sort((a, b) => b.s.score - a.s.score || b.s.soon.length - a.s.soon.length || a.r.title.localeCompare(b.r.title, 'de'));
  const shown = scored.filter(({r, s}) => matchesFilters(r, s, filters, ui.recipeSearch || '', t));
  let h = header('Was kann ich kochen?', 'Oben, was schon da ist und Ablaufendes rettet');
  if (fitting.length) {
    h += `<div class="filters" role="group" aria-label="Filter"><button class="filter${filters.length ? '' : ' on'}" data-act="recipeFilter" data-v="" aria-pressed="${!filters.length}">Alle</button>${Object.entries(RECIPE_FILTERS).map(([k, l]) => `<button class="filter${filters.includes(k) ? ' on' : ''}" data-act="recipeFilter" data-v="${k}" aria-pressed="${filters.includes(k)}">${l}</button>`).join('')}</div>`;
    if (fitting.length >= 5) h += `<label class="sr-only" for="recipe-search">Rezepte durchsuchen</label><input type="search" id="recipe-search" placeholder="🔍 Rezept oder Zutat suchen …" value="${esc(ui.recipeSearch || '')}" autocomplete="off">`;
  }
  if (!fitting.length) h += `<div class="panel empty">Noch keine Rezepte. Leg dein erstes an, z. B. aus einem kopierten Rezepttext.</div>`;
  else if (!shown.length) h += `<div class="panel empty"><p>Kein Rezept passt dazu.</p><div class="row" style="justify-content:center"><button class="btn small" data-act="recipeFilter" data-v="">Filter zurücksetzen</button></div></div>`;
  h += `<div class="recipe-cards">${shown.map(({r, s}) => card(r, s, diet)).join('')}</div>`;
  h += `<div class="row"><button class="btn primary" data-act="newRecipe">+ Neues Rezept</button></div>`;
  if (hidden) h += `<p class="small muted">${hidden} ${hidden === 1 ? 'Rezept ist' : 'Rezepte sind'} ausgeblendet, ${diet === 'none' ? 'weil du keine Vorschläge möchtest' : `weil ${hidden === 1 ? 'es' : 'sie'} nicht zu „${DIET_TEXT[diet]}“ ${hidden === 1 ? 'passt' : 'passen'}`} (Einstellungen).</p>`;
  return h;
}

/* While typing in the form only the small bits that depend on the text are updated (hint under a line, flags,
   proposed symbol, proposed diet); a full redraw would swallow a click that follows the typing. */
export function refreshDraftBits() {
  const d = app.ui.draft;
  if (!d) return;
  d.lines.forEach((l, n) => {
    const hint = document.getElementById(`ing-hint-${n}`); if (hint) hint.innerHTML = lineHint(d, n);
    const opt = document.querySelector(`[data-line-flag="optional"][data-v="${n}"]`); if (opt) opt.checked = !!l.optional;
    const raw = document.querySelector(`[data-line-flag="raw"][data-v="${n}"]`); if (raw) raw.checked = !!l.raw;
  });
  const names = d.lines.map(l => (lineInfo(l.text) || {}).name).filter(Boolean);
  if (!d.icon) {
    const icon = suggestIcon(d.title, names);
    document.querySelectorAll('.icon-choice').forEach(b => { const on = b.dataset.v === icon; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  }
  const auto = document.querySelector('#recipe-diet option[value=""]');
  if (auto) auto.textContent = `aus den Zutaten: ${DIET_TEXT[suggestedDiet({ingredients: names.map(name => ({name}))})]}`;
}
