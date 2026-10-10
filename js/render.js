/* Draws the current tab, the tab bar and the bottom sheet; commit() saves and redraws; toasts with actions and undo. */
import {app, $} from './app.js';
import {save} from './store.js';
import {setOverrides} from './catalog.js';
import {renderNav} from './views/components.js';
import {renderPantry} from './views/pantry-view.js';
import {renderCooking} from './views/cooking-view.js';
import {renderShopping} from './views/shopping-view.js';
import {renderReceipt} from './views/receipt-view.js';
import {renderSheet} from './views/sheet-view.js';
import {renderSettings} from './views/settings-view.js';
import {renderOnboarding} from './views/onboarding-view.js';

const VIEWS = {pantry: renderPantry, cooking: renderCooking, shopping: renderShopping, receipt: renderReceipt, settings: renderSettings};

/* Re-rendering replaces the HTML; keep the focused field and caret so typing (e.g. search) is not interrupted. */
function keepFocus(draw) {
  const a = document.activeElement;
  const id = a && a.id, sel = a && 'selectionStart' in a ? [a.selectionStart, a.selectionEnd] : null;
  draw();
  if (!id) return;
  const el = document.getElementById(id);
  if (!el) return;
  el.focus({preventScroll: true});
  if (sel && el.setSelectionRange) try { el.setSelectionRange(...sel); } catch (e) {}
}

export function render() {
  setOverrides(app.state.catalogOverrides);
  keepFocus(() => {
    $('#app').innerHTML = `<section class="view">${VIEWS[app.ui.tab]()}</section>`;
    const onboarding = !app.state.household.onboarded;
    $('#sheet').innerHTML = onboarding ? renderOnboarding() : renderSheet();
    document.body.classList.toggle('sheet-open', onboarding || !!app.ui.sheet);
    renderNav();
  });
}

/* ---- toasts ---- */
let toastTimer, toastActions = [];
/* actions: [{label, run}] – shown as buttons; undo: a state snapshot taken before the change */
export function toast(msg, {actions = [], undo = null} = {}) {
  const t = $('#toast');
  toastActions = [...actions];
  if (undo) toastActions.push({label: 'Rückgängig', run: () => { app.state = JSON.parse(undo); commit('Rückgängig gemacht'); }});
  t.innerHTML = `<span>${msg.replace(/[&<>]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c]))}</span>` +
    toastActions.map((a, n) => `<button type="button" class="toast-btn" data-act="toastAction" data-v="${n}">${a.label}</button>`).join('');
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, toastActions.length ? 6500 : 3200);
}
export function hideToast() { $('#toast').hidden = true; toastActions = []; }
export function runToastAction(n) { const a = toastActions[n]; hideToast(); if (a) a.run(); }

export function commit(msg, opts) {
  const ok = save(app.state);
  render();
  if (!ok) toast('Speichern hat nicht geklappt. Ist der Speicher voll oder ein privates Fenster offen?');
  else if (msg) toast(msg, opts);
}

/* Runs a change and offers "Rückgängig" afterwards. */
export function withUndo(change, msg, actions = []) {
  const snapshot = JSON.stringify(app.state);
  const result = change();
  commit(typeof msg === 'function' ? msg(result) : msg, {undo: snapshot, actions});
  return result;
}
