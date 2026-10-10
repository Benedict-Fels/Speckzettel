/* Settings (gear in the header): household, hints, what is tracked, own ingredients, learned receipt texts, app, data. */
import {app} from '../app.js';
import {esc} from '../text.js';
import {APP_VERSION} from '../version.js';
import {isBuiltIn} from '../catalog.js';
import {AREAS} from '../areas.js';
import {receiptStats, outcome, OUTCOME_LABELS} from '../receipt/history.js';
import {chainLabel} from '../receipt/templates.js';
import {header} from './components.js';

export const DIETS = {all: 'alles', vegetarian: 'vegetarisch', vegan: 'vegan', none: 'Ich möchte keine Rezeptvorschläge'};

const toggle = (key, label, hint) => `<label class="switch-row"><span><b>${label}</b><span class="small muted">${hint}</span></span>
  <input type="checkbox" role="switch" data-setting="${key}" ${app.state.settings[key] ? 'checked' : ''}></label>`;

function installPanel() {
  const env = app.env;
  if (env.standalone) return `<div class="panel"><h3>App</h3><p class="small muted">Speckzettel ist installiert.</p></div>`;
  let body;
  if (env.installEvent) body = `<p class="small muted">Speckzettel bekommt ein eigenes Icon, öffnet ohne Adressleiste und läuft auch offline.</p><div class="row"><button class="btn primary small" data-act="install">App installieren</button></div>`;
  else if (env.isIOS) body = `<p class="small">In Safari unten auf <b>Teilen</b> tippen und dann <b>„Zum Home-Bildschirm“</b> wählen. Danach Speckzettel über das neue Icon öffnen.</p>`;
  else body = `<p class="small">Im Browser-Menü <b>⋮</b> auf <b>„App installieren“</b> tippen (heißt manchmal „Zum Startbildschirm hinzufügen“).</p>`;
  return `<div class="panel"><h3>Als App installieren</h3>${body}</div>`;
}

function dataPanel() {
  const {env, ui} = app;
  const keep = env.persisted === true ? ' Der Browser hält sie dauerhaft fest.'
    : env.persisted === false ? ' Der Browser darf sie bei Platzmangel löschen, mach ab und zu eine Sicherung.' : '';
  let h = `<div class="panel"><h3>Daten</h3><p class="muted small">Alles bleibt auf diesem Gerät.${keep}</p>`;
  if (ui.pendingImport) {
    const p = ui.pendingImport.state;
    const when = ui.pendingImport.when ? ` vom ${new Date(ui.pendingImport.when).toLocaleDateString('de-DE')}` : '';
    h += `<div class="notice" id="import-notice"><span>Sicherung${when} mit ${p.items.length} Sachen und ${p.recipes.length} Rezepten. Sie ersetzt alles, was gerade in der App ist.</span>
      <div class="row"><button class="btn small primary" data-act="importDo">Jetzt laden</button><button class="btn small ghost" data-act="importCancel">Abbrechen</button></div></div>`;
  }
  h += `<div class="row"><button class="btn small" data-act="export">Daten sichern</button><button class="btn small" data-act="importPick">Sicherung laden</button>
    <input type="file" id="import-file" accept="application/json,.json" hidden></div>
    <div class="row"><button class="btn small" data-act="reset">${ui.confirm === 'reset' ? 'Wirklich? Nochmal tippen' : 'Beispieldaten laden'}</button>
    <button class="btn small danger" data-act="clear">${ui.confirm === 'clear' ? 'Wirklich alles löschen?' : 'Alles löschen'}</button></div></div>`;
  return h;
}

function ownIngredients() {
  const o = app.state.catalogOverrides;
  const names = Object.keys(o).sort((a, b) => a.localeCompare(b, 'de'));
  if (!names.length) return `<p class="small muted">Noch keine. Neue Zutaten und geänderte Haltbarkeiten tauchen hier auf.</p>`;
  return `<div class="items">${names.map(n => {
    const e = o[n], own = !isBuiltIn(n);
    const bits = [own ? 'eigene Zutat' : 'angepasst', e.area ? AREAS[e.area] : null, e.profile === 'stable' ? 'hält lange' : e.shelfDays ? `${e.shelfDays} Tage haltbar` : null].filter(Boolean);
    return `<div class="gone-row"><div class="gone-text"><b>${esc(n)}</b><span class="small muted">${esc(bits.join(' · '))}</span></div>
      <button class="btn small ghost" data-act="resetOverride" data-v="${esc(n)}">${own ? 'Entfernen' : 'Zurücksetzen'}</button></div>`;
  }).join('')}</div>`;
}

/* Testing phase (spec 13.4): how well receipts are read. */
function receiptStatsPanel() {
  const list = app.state.receipts || [];
  if (!list.length) return `<div class="panel"><h3>Bon-Statistik</h3><p class="small muted">Noch keine Bons eingelesen.</p></div>`;
  const st = receiptStats(list);
  const rows = [...list].sort((a, b) => b.importedAt - a.importedAt).map(r => {
    const o = outcome(r);
    return `<div class="shop-row"><span class="shop-name">${esc(chainLabel(r.chain))} · ${r.date ? r.date.slice(0, 10).split('-').reverse().join('.') : new Date(r.importedAt).toLocaleDateString('de-DE')}</span>
      <span class="small muted num">${r.via === 'pdf' ? 'PDF' : r.via === 'ai' ? 'KI' : 'Text'} · ${r.lines.length} Zeilen</span><span class="chip ${o === 'smooth' ? 'ok' : o === 'error' ? 'buy' : 'check'}">${OUTCOME_LABELS[o]}</span></div>`;
  }).join('');
  return `<div class="panel"><h3>Bon-Statistik</h3><p class="num"><b>${st.total} Bons</b> · ${st.smooth} glatt · ${st.corrected} korrigiert · ${st.error} Fehler</p>
    <p class="small muted">Glatt: Summe stimmt, nichts korrigiert. Korrigiert: Summe stimmt, aber eine Zutat musste geändert werden. Fehler: Summe stimmte nicht.</p>
    <div class="items">${rows}</div>
    <div class="row"><button class="btn small" data-act="exportReceipts">Bon-Texte als Datei</button></div></div>`;
}

export function renderSettings() {
  const {state} = app;
  const diet = state.household.diet || 'all';
  const learned = Object.keys(state.aliases).length;
  let h = `<div class="row" style="padding-top:16px"><button class="btn ghost small" data-act="tab" data-v="pantry">← Zurück</button></div>` + header('Einstellungen');
  h += `<div class="panel"><h3>Haushalt</h3>
    <label class="fld">Ich esse<select data-household="diet">${Object.entries(DIETS).map(([k, l]) => `<option value="${k}" ${k === diet ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <p class="small muted">Bei „vegan“ und „vegetarisch“ zeigt „Kochen“ nur passende Rezepte. Ob ein Rezept passt, erkennt die App an den Zutaten.</p></div>`;
  h += `<div class="panel"><h3>Hinweise</h3>
    ${toggle('hintSoon', 'Bald verbrauchen', 'Rote Hinweise, wenn etwas bald abläuft oder drüber ist, und die Zahl am Vorrat-Symbol.')}
    ${toggle('hintCheck', 'Schau lieber nach', 'Gelbe Hinweise bei „fast leer“ und bei Sachen, die du lange nicht bestätigt hast.')}
    <p class="small muted">Ausgeschaltet rechnet die App beim Kochen trotzdem richtig, sie zeigt es nur nicht im Vorrat.</p></div>`;
  h += `<div class="panel"><h3>Was verfolgt wird</h3>
    ${toggle('trackSnacks', 'Snacks verfolgen', 'Chips, Schokolade, Kekse & Co. vom Bon übernehmen. Ohne Erinnerungen.')}
    <p class="small muted">Getränke und Drogerieartikel übernimmt die App vom Bon nur, wenn du sie antippst. Salz, Pfeffer und Wasser gelten immer als da.</p></div>`;
  h += `<div class="panel"><h3>Eigene Zutaten und Anpassungen</h3>${ownIngredients()}</div>`;
  h += `<div class="panel"><h3>Gelernte Bon-Texte</h3><p class="small muted">${learned ? `${learned} Bon-Texte erkennt die App wieder, ohne zu fragen.` : 'Noch keine. Jede Korrektur beim Bon wird hier gemerkt.'}</p>
    ${learned ? `<div class="row"><button class="btn small danger" data-act="forgetAliases">${app.ui.confirm === 'forgetAliases' ? 'Wirklich alle vergessen?' : 'Alle vergessen'}</button></div>` : ''}</div>`;
  h += receiptStatsPanel();
  h += installPanel() + dataPanel();
  h += `<p class="muted small">Speckzettel ${APP_VERSION} · Schriften: SIL Open Font License · PDF-Lesen: pdf.js (Mozilla, Apache-Lizenz 2.0)</p>`;
  return h;
}
