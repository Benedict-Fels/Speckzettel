/* User actions: clicks, field changes, typing, form submits. Logic lives in the modules, this file only wires it up. */
import {app, $} from './app.js';
import {render, commit, toast, withUndo, runToastAction} from './render.js';
import {now} from './clock.js';
import {uid} from './text.js';
import {fmt} from './units.js';
import {AREAS} from './areas.js';
import {catalogFor, setOverrides, key, resolve} from './catalog.js';
import {seed, emptyState} from './seed.js';
import {COUNT_UNITS} from './units.js';
import {backupJson, parseBackup} from './store.js';
import {addItem, removeItem, itemLabel, packStatus, setArea, confirmStillThere, markSeen} from './pantry.js';
import {recipeCheck, planCook, applyCook, shoppingCandidates} from './recipes.js';
import {newDraft, draftFromRecipe, draftFromParsed, recipeFromDraft, restoreStarter, lineInfo, rawSuggested, suggestRawAll} from './recipe-edit.js';
import {refreshDraftBits} from './views/cooking-view.js';
import {addNewStarters} from './starter-recipes.js';
import {parseIngredientLine, parseRecipeText, splitEntries} from './recipe-text.js';
import {addToShopping, shopName, setDone, stockPlan, applyStockPlan, shoppingText, settleWithReceipt} from './shopping.js';
import {parseReceipt, aliasKey, receiptAmount} from './receipt/pipeline.js';
import {pdfToText} from './receipt/pdf.js';
import {receiptRecord, findDuplicate, receiptsExport} from './receipt/history.js';
import {AI_PROMPT, SAMPLE_AI, SAMPLE_RECEIPT, SAMPLE_RECIPE_TEXT} from './samples.js';
import {applyUpdate} from './platform.js';
import {findGroup} from './views/sheet-view.js';

function exportData() {
  const blob = new Blob([backupJson(app.state)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `speckzettel-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Sicherung gespeichert');
}

function readImport(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      app.ui.pendingImport = parseBackup(r.result);
      app.ui.tab = 'pantry';
      render();
      const p = $('#import-notice'); if (p) p.scrollIntoView({block: 'center'});
    } catch (e) { toast(e.message === 'newer' ? 'Diese Sicherung stammt aus einer neueren Speckzettel-Version' : 'Das ist keine Speckzettel-Sicherung'); }
  };
  r.readAsText(file);
}

function copyText(text, done) {
  const fallback = () => toast('Kopieren geht hier nicht – bitte „Teilen“ nehmen');
  try { navigator.clipboard.writeText(text).then(() => toast(done), fallback); } catch (err) { fallback(); }
}

function copyPrompt() {
  const fallback = () => { const r = document.createRange(); r.selectNodeContents($('#prompt')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Text markiert, jetzt kopieren'); };
  try { navigator.clipboard.writeText(AI_PROMPT).then(() => toast('Auftrag kopiert'), fallback); } catch (err) { fallback(); }
}

const openSheetFor = item => { app.ui.sheet = {type: 'group', key: `${item.area}|${key(item.ingredient)}`}; app.ui.sheetMore = false; };
const onShoppingList = () => new Set(app.state.shopping.filter(x => !x.done).map(x => key(shopName(x))));
const toShoppingAction = name => ({label: 'Auf den Zettel', run: () => { addToShopping(app.state, name, null, null); commit(`${name} steht auf dem Einkaufszettel`); }});
/* Changing what all packs of an ingredient follow also lands in the household's catalog overrides. */
function setOverride(ingredient, patch) {
  const o = app.state.catalogOverrides;
  o[ingredient] = {...(o[ingredient] || {}), ...patch};
  setOverrides(o);
}

/* ---- one-field add ("500 g Tofu, 2 Zucchini") ---- */
/* Returns the packs added ("2 Tofu" = two usual packs). */
function addEntry(p, raw) {
  const c = catalogFor(p.name);
  const explicitUnit = /\b(st(ü|ue)ck|stk)\b/i.test(raw);
  if (c && c.pack && p.unit === 'Stück' && c.unit !== 'Stück' && !explicitUnit) {
    const packs = [];
    for (let n = 0; n < Math.max(1, Math.round(p.amount)); n++) packs.push(addItem(app.state, {name: p.name, amount: c.pack, unit: c.unit}));
    return packs;
  }
  return [addItem(app.state, {name: p.name, amount: p.amount, unit: p.amount != null ? p.unit : undefined})];
}
function describe(packs) {
  const it = packs[0];
  const qty = it.tracking !== 'exact' ? '' : `, ${packs.length > 1 ? `${packs.length} × ` : ''}${fmt(it.amount, it.unit)}`;
  return `${itemLabel(it)}${qty} → ${AREAS[it.area]}`;
}
const things = n => `${n} ${n === 1 ? 'Sache' : 'Sachen'}`;

function submitAdd() {
  const raw = $('#add-input').value.trim();
  if (!raw) return;
  const parts = splitEntries(raw);
  const added = [], unknown = [];
  for (const part of parts) {
    const p = parseIngredientLine(part);
    if (!p) continue;
    if (catalogFor(p.name)) added.push(addEntry(p, part)); else unknown.push({...p, raw: part});
  }
  app.ui.addDraft = '';
  if (unknown.length) app.ui.sheet = {type: 'newIngredient', queue: unknown, added: added.length};
  if (!added.length) { $('#add-input').value = ''; return render(); }
  if (added.length === 1) { const packs = added[0]; return commit(describe(packs), {actions: [{label: 'Ändern', run: () => { openSheetFor(packs[0]); render(); }}]}); }
  return commit(`${things(added.length)} im Vorrat`);
}

function chooseNewArea(area) {
  const sh = app.ui.sheet;
  const entry = sh.queue.shift();
  setOverride(entry.name, {area, unit: entry.unit || 'Stück', tracking: 'exact', profile: area === 'pantry' ? 'stable' : 'perishable', shelfDays: 14});
  const packs = addEntry(entry, entry.raw);
  if (!sh.queue.length) app.ui.sheet = null;
  commit(describe(packs), {actions: [{label: 'Ändern', run: () => { openSheetFor(packs[0]); render(); }}]});
}

function focusField(id) { const el = document.getElementById(id); if (el) { el.focus(); el.scrollIntoView({block: 'nearest'}); } }

/* "Passt, abziehen" in the Gekocht preview. */
function applyCookSheet() {
  const {state, ui} = app;
  const sh = ui.sheet, r = state.recipes.find(x => x.id === sh.recipeId);
  if (!r) return;
  const snapshot = JSON.stringify(state);
  const {changed, emptied} = applyCook(state, r, sh.plan);
  ui.sheet = null;
  const actions = emptied.length ? [{label: emptied.length === 1 ? `${emptied[0]} auf den Zettel` : 'Leeres auf den Zettel', run: () => {
    emptied.forEach(n => addToShopping(app.state, n, null, null));
    commit(`${emptied.join(', ')} ${emptied.length === 1 ? 'steht' : 'stehen'} auf dem Einkaufszettel`);
  }}] : [];
  commit(changed.length ? `Abgezogen: ${changed.join(', ')}` : 'Als gekocht gemerkt', {undo: snapshot, actions});
}

/* ---- receipts ---- */
const receiptRow = id => app.ui.receipt.rows.find(r => r.id === id);
function showReceipt(result) {
  const {ui, state} = app;
  ui.receipt = result; ui.receiptEdit = null;
  ui.receiptDuplicate = findDuplicate(state.receipts, result);
  render();
  const el = document.getElementById('receipt-review'); if (el) el.scrollIntoView({block: 'start'});
}
async function readReceiptPdf(file) {
  const {ui, state} = app;
  ui.receiptBusy = true; render();
  try { showReceipt(parseReceipt(await pdfToText(file), state.aliases, {trackSnacks: state.settings.trackSnacks, via: 'pdf'})); }
  catch (e) { toast(e.message === 'notext' ? 'In diesem PDF steht kein lesbarer Text (eingescannt?). Dann lieber über die KI.' : 'Das PDF ließ sich nicht lesen.'); }
  finally { ui.receiptBusy = false; render(); }
}
/* Takes the reviewed receipt over: packs into the pantry, corrections learned, receipt kept, shopping list settled. */
function importReceipt() {
  const {state, ui} = app;
  const result = ui.receipt;
  const chain = result.chain === 'generic' ? null : result.chain;
  const rows = result.rows;
  const take = rows.filter(r => !r.skip && r.name.trim());
  ui.receipt = null; ui.receiptEdit = null; ui.receiptText = ''; ui.receiptDuplicate = null;
  let settled = [];
  window.scrollTo(0, 0);
  return withUndo(() => {
    const names = [];
    for (const r of rows) {
      const key = aliasKey(r.text, chain);
      if (r.skip) { if (r.ignoreAlways) state.aliases[key] = {ingredient: r.name, ignore: true}; continue; }
      if (!r.name.trim()) continue;
      const res = resolve(r.name.trim());
      const name = res ? res.name : r.name.trim(), variety = r.variety ?? (res ? res.variety : null);
      /* learn only what was corrected or newly confirmed, not every rule hit (fehler 15.3 #8) */
      if (r.edited || r.src === 'unknown' || r.src === 'ai') state.aliases[key] = {ingredient: name, variety, area: r.area, unit: r.unit};
      addItem(state, {name, variety, amount: r.amount, unit: r.unit, area: r.area, source: 'receipt'});
      names.push(name);
    }
    if (!Array.isArray(state.receipts)) state.receipts = [];
    state.receipts.push(receiptRecord(result, rows));
    settled = settleWithReceipt(state, names);
  }, () => `${take.length} ${take.length === 1 ? 'Artikel' : 'Artikel'} im Vorrat${settled.length ? ` · ${settled.length} vom Zettel erledigt` : ''}`);
}
function downloadText(text, filename, done) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type: 'text/plain;charset=utf-8'}));
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast(done);
}

/* ---- clicks ---- */
function onClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const {state, ui} = app;
  const a = b.dataset.act, v = b.dataset.v;
  if (a !== 'reset' && a !== 'clear' && a !== 'forgetAliases') ui.confirm = null;
  const item = id => state.items.find(i => i.id === id);
  const group = () => ui.sheet && ui.sheet.type === 'group' ? findGroup(ui.sheet.key) : null;
  const currentRecipe = () => state.recipes.find(x => x.id === ui.recipeId);
  switch (a) {
    case 'toastAction': return runToastAction(+v);
    case 'tab': ui.tab = v; ui.sheet = null; window.scrollTo(0, 0); return render();

    /* pantry rows and the detail sheet */
    case 'sheet': ui.tab = 'pantry'; ui.sheet = {type: 'group', key: v}; ui.sheetMore = false; return render();
    case 'closeSheet': ui.sheet = null; return render();
    case 'toggleSheetMore': e.preventDefault(); ui.sheetMore = !ui.sheetMore; return render();
    case 'packStep': {
      const i = item(v); const step = (i.unit === 'g' || i.unit === 'ml') ? (i.amount > 100 || +b.dataset.d > 0 ? 50 : 10) : 1;
      const next = +Math.max(0, i.amount + step * +b.dataset.d).toFixed(2);
      if (next <= 0) return withUndo(() => removeItem(state, i), `${itemLabel(i)}: Packung entfernt`);
      i.amount = next; markSeen(i); return commit();
    }
    case 'packDelete': { const i = item(v); return withUndo(() => removeItem(state, i), `${itemLabel(i)}: Packung entfernt`); }
    case 'level': {
      const i = item(v); i.level = +b.dataset.l; markSeen(i);
      if (i.level === 0) return withUndo(() => removeItem(state, i), `${itemLabel(i)} ist leer`, [toShoppingAction(i.ingredient)]);
      return commit();
    }
    case 'groupSeen': { const g = group(); g.items.forEach(i => markSeen(i)); ui.sheet = null; return commit(`${g.name}: gemerkt`); }
    case 'groupGone': { const g = group(); ui.sheet = null; return withUndo(() => g.items.forEach(i => removeItem(state, i)), `${g.name} aufgebraucht`, [toShoppingAction(g.ingredient)]); }
    case 'groupToShopping': { const g = group(); addToShopping(state, g.ingredient, null, null); return commit(`${g.ingredient} steht auf dem Einkaufszettel`); }
    case 'openRecipe': ui.sheet = null; ui.tab = 'cooking'; ui.recipeForm = false; ui.draft = null; ui.recipeId = v; ui.persons = state.recipes.find(r => r.id === v).servings; window.scrollTo(0, 0); return render();
    case 'newIngredientArea': return chooseNewArea(v);

    /* "Vermutlich weg" */
    case 'toggleGone': ui.showGone = !ui.showGone; return render();
    case 'stillThere': { const i = item(v); confirmStillThere(i); return commit(`${itemLabel(i)} ist wieder im Bestand`); }
    case 'goneDelete': { const i = item(v); return withUndo(() => removeItem(state, i), `${itemLabel(i)} entfernt`); }
    case 'allStillThere': { const g = state.items.filter(i => packStatus(i).phase === 'gone'); g.forEach(i => confirmStillThere(i)); return commit(`${things(g.length)} wieder im Bestand`); }
    case 'allGoneDelete': {
      const g = state.items.filter(i => packStatus(i).phase === 'gone');
      return withUndo(() => { state.items = state.items.filter(i => !g.includes(i)); }, `${things(g.length)} entfernt`);
    }

    /* data */
    case 'reset': {
      if (ui.confirm !== 'reset') { ui.confirm = 'reset'; return render(); }
      const keep = {household: state.household, settings: state.settings};
      app.state = {...seed(), ...keep}; ui.confirm = null; return commit('Beispieldaten geladen');
    }
    case 'clear': {
      if (ui.confirm !== 'clear') { ui.confirm = 'clear'; return render(); }
      const diet = state.household.diet;
      app.state = {...emptyState({withRecipes: diet !== 'none', diet}), settings: state.settings}; ui.confirm = null;
      return commit('Alles gelöscht');
    }

    /* settings */
    case 'dismissInstallHint': state.settings.installHintDismissed = true; return commit();
    case 'resetOverride': { delete state.catalogOverrides[v]; setOverrides(state.catalogOverrides); return commit(`${v}: zurückgesetzt`); }
    case 'forgetAliases':
      if (ui.confirm !== 'forgetAliases') { ui.confirm = 'forgetAliases'; return render(); }
      ui.confirm = null; return withUndo(() => { state.aliases = {}; }, 'Gelernte Bon-Texte vergessen');

    /* first start */
    case 'onboardingNext': ui.onboardingStep = (ui.onboardingStep || 0) + 1; return render();
    case 'onboardingSkip': state.household.onboarded = true; return commit();
    case 'onboardingDiet': state.household.diet = v; if (v === 'none') { state.recipes = state.recipes.filter(r => r.origin === 'own'); state.starterIds = []; } ui.onboardingStep = 2; return commit();
    case 'onboardingStart': {
      const diet = state.household.diet;
      if (v === 'demo') { app.state = {...seed(), household: {diet: diet || 'vegan', onboarded: true}, settings: state.settings}; ui.tab = 'pantry'; return commit('Beispieldaten geladen. Unter Einstellungen kannst du alles löschen.'); }
      state.household.onboarded = true;
      ui.tab = v === 'receipt' ? 'receipt' : 'pantry';
      return commit();
    }
    case 'export': return exportData();
    case 'importPick': { const f = $('#import-file'); if (f) { f.value = ''; f.click(); } return; }
    case 'importDo': { if (!ui.pendingImport) return; app.state = ui.pendingImport.state; app.state.demo = false; ui.pendingImport = null; return commit(`Sicherung geladen: ${app.state.items.length} Sachen`); }
    case 'importCancel': ui.pendingImport = null; return render();
    case 'install': { const evt = app.env.installEvent; if (!evt) return; evt.prompt(); evt.userChoice.finally(() => { app.env.installEvent = null; render(); }); return; }
    case 'update': return applyUpdate();

    /* cooking */
    case 'recipe': { ui.recipeId = v; ui.persons = state.recipes.find(r => r.id === v).servings; window.scrollTo(0, 0); return render(); }
    case 'back': ui.shopPick = null; ui.recipeId = null; ui.recipeForm = false; ui.draft = null; return render();
    case 'persons': ui.shopPick = null; ui.persons = Math.max(1, Math.min(20, ui.persons + +v)); return render();
    case 'recipeFilter': {
      const f = ui.recipeFilters || [];
      ui.recipeFilters = !v ? [] : f.includes(v) ? f.filter(x => x !== v) : [...f, v];
      if (!v) ui.recipeSearch = '';
      return render();
    }
    case 'shopPickOpen': {
      const listed = onShoppingList();
      ui.shopPick = {recipeId: ui.recipeId, items: shoppingCandidates(recipeCheck(state.items, currentRecipe(), ui.persons), n => listed.has(key(n)))};
      return render();
    }
    case 'shopPickCancel': ui.shopPick = null; return render();
    case 'shopPickConfirm': {
      const chosen = ui.shopPick.items.filter(c => c.checked);
      ui.shopPick = null;
      const rid = ui.recipeId;
      return withUndo(() => chosen.forEach(c => addToShopping(state, c.name, c.amount, c.unit, {recipe: rid})), `${chosen.length} ${chosen.length === 1 ? 'Zutat' : 'Zutaten'} auf dem Einkaufszettel`);
    }
    case 'quickHave': {
      const x = recipeCheck(state.items, currentRecipe(), ui.persons)[+v];
      for (const i of x.stock) {
        if (packStatus(i).phase === 'over') confirmStillThere(i); else markSeen(i);
        if (x.fix === 'low' && i.tracking === 'rough' && i.level <= .25) i.level = .5;
      }
      return commit(x.fix === 'low' ? `${x.ing.name}: auf „halb voll“ gesetzt` : `${x.ing.name}: gemerkt, ist da`);
    }
    case 'quickGone': {
      const x = recipeCheck(state.items, currentRecipe(), ui.persons)[+v];
      const ids = new Set(x.stock.map(i => i.id));
      return withUndo(() => { state.items = state.items.filter(i => !ids.has(i.id)); }, `${x.ing.name} ist weg`, [toShoppingAction(x.ing.name)]);
    }
    case 'cookPreview': { const r = currentRecipe(); ui.sheet = {type: 'cook', recipeId: r.id, persons: ui.persons, plan: planCook(state.items, r, ui.persons)}; return render(); }
    case 'cookStep': {
      const row = ui.sheet.plan[+v]; const fine = row.unit === 'g' || row.unit === 'ml';
      const step = fine ? (row.use > 100 || (row.use === 100 && +b.dataset.d > 0) ? 50 : 10) : COUNT_UNITS.includes(row.unit) ? .5 : 1;
      row.use = +Math.min(row.have, Math.max(0, row.use + step * +b.dataset.d)).toFixed(2); return render();
    }
    case 'cookLevel': { ui.sheet.plan[+v].after = +b.dataset.l; return render(); }
    case 'cookApply': return applyCookSheet();
    case 'deleteRecipe': { const r = currentRecipe(); ui.recipeId = null; return withUndo(() => { state.recipes = state.recipes.filter(x => x !== r); }, `${r.title} gelöscht`); }
    case 'restoreRecipe': {
      const r = currentRecipe(); const orig = restoreStarter(r); if (!orig) return;
      return withUndo(() => { state.recipes[state.recipes.indexOf(r)] = orig; ui.recipeId = orig.id; ui.persons = orig.servings; }, 'Original wiederhergestellt');
    }
    case 'newRecipe': ui.recipeForm = true; ui.recipeId = null; ui.draft = newDraft(); ui.pasteText = ''; window.scrollTo(0, 0); return render();
    case 'editRecipe': ui.recipeForm = true; ui.draft = draftFromRecipe(currentRecipe()); ui.pasteText = ''; window.scrollTo(0, 0); return render();
    case 'cancelRecipe': ui.recipeForm = false; ui.draft = null; window.scrollTo(0, 0); return render();
    case 'sampleRecipeText': ui.pasteText = SAMPLE_RECIPE_TEXT; $('#recipe-text').value = SAMPLE_RECIPE_TEXT; return;
    case 'parseRecipe': {
      const t = (ui.pasteText || '').trim(); if (!t) return toast('Erst Text einfügen');
      ui.draft = draftFromParsed(ui.draft, parseRecipeText(t)); render();
      return toast(`${ui.draft.lines.length - 1} Zutaten und ${ui.draft.steps.filter(Boolean).length} Schritte gefunden. Bitte prüfen.`);
    }
    case 'pickIcon': ui.draft.icon = v; return render();
    case 'lineAdd': ui.draft.lines.push({text: '', optional: false, raw: false, rawTouched: false}); render(); return focusField(`ing-line-${ui.draft.lines.length - 1}`);
    case 'lineRemove': { const d = ui.draft; d.lines.splice(+v, 1); if (!d.lines.length) d.lines.push({text: '', optional: false, raw: false, rawTouched: false}); return render(); }
    case 'stepAdd': ui.draft.steps.push(''); render(); return focusField(`step-${ui.draft.steps.length - 1}`);
    case 'stepRemove': { const d = ui.draft; d.steps.splice(+v, 1); if (!d.steps.length) d.steps.push(''); return render(); }
    case 'stepMove': {
      const d = ui.draft, n = +v, m = n + +b.dataset.d; if (m < 0 || m >= d.steps.length) return;
      [d.steps[n], d.steps[m]] = [d.steps[m], d.steps[n]]; render(); return focusField(`step-${m}`);
    }

    /* shopping */
    case 'shoppingDelete': { e.preventDefault(); const s = state.shopping.find(x => x.id === v); return withUndo(() => { state.shopping = state.shopping.filter(x => x !== s); }, `${shopName(s)} vom Zettel genommen`); }
    case 'shoppingClear': return withUndo(() => { state.shopping = state.shopping.filter(s => !s.done); }, 'Erledigte gelöscht');
    case 'toggleShopDone': ui.showShopDone = !ui.showShopDone; return render();
    case 'shoppingCopy': return copyText(shoppingText(state.shopping), 'Einkaufszettel kopiert');
    case 'shoppingShare': {
      const text = shoppingText(state.shopping);
      if (navigator.share) navigator.share({text}).catch(() => {});
      else copyText(text, 'Einkaufszettel kopiert');
      return;
    }
    case 'shoppingToStock': ui.sheet = {type: 'stock', plan: stockPlan(state)}; return render();
    case 'stockStep': {
      const r = ui.sheet.plan.rows[+v], d = +b.dataset.d;
      if (r.kind === 'packs') r.count = Math.max(0, r.count + d);
      else { const fine = r.unit === 'g' || r.unit === 'ml'; r.amount = Math.max(0, +(r.amount + d * (fine ? (r.amount > 100 || (r.amount === 100 && d > 0) ? 50 : 10) : 1)).toFixed(2)); }
      r.take = (r.kind === 'packs' ? r.count : r.amount) > 0;
      return render();
    }
    case 'stockApply': {
      const plan = ui.sheet.plan; ui.sheet = null;
      return withUndo(() => applyStockPlan(state, plan), n => n ? `${things(n)} im Vorrat` : 'Erledigte vom Zettel genommen');
    }

    /* receipt (spec 13) */
    case 'copyPrompt': return copyPrompt();
    case 'pdfPick': { const f = $('#receipt-file'); if (f) { f.value = ''; f.click(); } return; }
    case 'sampleAI': ui.receiptText = SAMPLE_AI; ui.receipt = null; return render();
    case 'sampleReceipt': ui.receiptText = SAMPLE_RECEIPT; ui.receipt = null; return render();
    case 'parseReceipt': {
      ui.receiptText = $('#receipt-text').value;
      if (!ui.receiptText.trim()) return toast('Erst Bon-Text oder KI-Antwort einfügen');
      return showReceipt(parseReceipt(ui.receiptText, state.aliases, {trackSnacks: state.settings.trackSnacks}));
    }
    case 'receiptRowTake': { const r = receiptRow(v); r.skip = false; r.userSkip = false; r.ignoreAlways = false; if (r.src === 'ignored') { r.edited = true; r.src = 'learned'; } return render(); }
    case 'receiptRowSkip': { const r = receiptRow(v); r.skip = true; r.userSkip = true; ui.receiptEdit = null; return render(); }
    case 'receiptRowEdit': ui.receiptEdit = ui.receiptEdit === v ? null : v; render(); return focusField(`receipt-name-${v}`);
    case 'receiptDiscard': ui.receipt = null; ui.receiptEdit = null; window.scrollTo(0, 0); return render();
    case 'receiptImport': return importReceipt();
    case 'toggleReceiptHow': ui.receiptHow = !ui.receiptHow; return render();
    case 'exportReceipts': return downloadText(receiptsExport(state.receipts || []), `speckzettel-bons-${new Date().toISOString().slice(0, 10)}.txt`, 'Bon-Texte gespeichert');
  }
}

/* ---- field changes ---- */
function onChange(e) {
  const t = e.target;
  const {state, ui} = app;
  if (t.id === 'import-file') { if (t.files && t.files[0]) readImport(t.files[0]); return; }
  if (t.id === 'receipt-file') { if (t.files && t.files[0]) readReceiptPdf(t.files[0]); return; }
  if (t.dataset.ignoreAlways && ui.receipt) { receiptRow(t.dataset.ignoreAlways).ignoreAlways = t.checked; return; }
  if (t.dataset.act === 'shoppingTick') { const s = state.shopping.find(x => x.id === t.dataset.v); setDone(s, t.checked); return commit(); }
  if (t.dataset.stockTake != null && ui.sheet && ui.sheet.type === 'stock') { ui.sheet.plan.rows[+t.dataset.stockTake].take = t.checked; return render(); }
  if (t.dataset.stockAmount != null && ui.sheet && ui.sheet.type === 'stock') {
    const r = ui.sheet.plan.rows[+t.dataset.stockAmount]; const n = parseFloat(t.value.replace(',', '.'));
    if (!isNaN(n) && n >= 0) { if (r.kind === 'packs') r.count = Math.round(n); else r.amount = n; r.take = n > 0; }
    return render();
  }
  if (t.dataset.pack) {
    const i = state.items.find(x => x.id === t.dataset.pack); if (!i) return;
    const f = t.dataset.f;
    if (f === 'amount') {
      const n = parseFloat(t.value.replace(',', '.'));
      if (isNaN(n)) return render();
      if (n <= 0) return withUndo(() => removeItem(state, i), `${itemLabel(i)}: Packung entfernt`);
      i.amount = n; markSeen(i); return commit();
    }
    if (f === 'opened') { i.openedAt = t.checked ? now() : null; return commit(); }
    if (f === 'bestBefore') { i.bestBefore = t.value ? new Date(t.value + 'T12:00').getTime() : null; i.confirmedAt = null; return commit(t.value ? 'MHD eingetragen' : 'MHD entfernt'); }
  }
  if (t.dataset.lineFlag && ui.draft) {
    const l = ui.draft.lines[+t.dataset.v]; if (!l) return;
    l[t.dataset.lineFlag] = t.checked;
    if (t.dataset.lineFlag === 'raw') l.rawTouched = true;
    return;
  }
  if (t.dataset.shopPick != null && ui.shopPick) { ui.shopPick.items[+t.dataset.shopPick].checked = t.checked; return render(); }
  if (t.dataset.cookFlag != null && ui.sheet && ui.sheet.type === 'cook') { ui.sheet.plan[+t.dataset.cookFlag].gone = t.checked; return render(); }
  if (t.dataset.cookUse != null && ui.sheet && ui.sheet.type === 'cook') {
    const row = ui.sheet.plan[+t.dataset.cookUse]; const n = parseFloat(t.value.replace(',', '.'));
    if (!isNaN(n)) row.use = +Math.min(row.have, Math.max(0, n)).toFixed(2);
    return render();
  }
  if (t.dataset.setting) { state.settings[t.dataset.setting] = t.checked; return commit(); }
  if (t.dataset.household) { state.household[t.dataset.household] = t.value; const n = addNewStarters(state); return commit(n ? `${n} passende Rezepte dazugekommen` : undefined); }
  if (t.dataset.groupF) {
    const g = findGroup(ui.sheet.key); if (!g) return;
    const f = t.dataset.groupF, v = t.value;
    if (f === 'area') { g.items.forEach(i => setArea(i, v)); ui.sheet.key = `${v}|${key(g.ingredient)}`; return commit(`${g.name} → ${AREAS[v]}`); }
    if (f === 'profile') { g.items.forEach(i => { i.profile = null; }); setOverride(g.ingredient, {profile: v}); return commit(v === 'stable' ? `${g.ingredient} hält lange, keine Erinnerung mehr` : `${g.ingredient} läuft ab`); }
    if (f === 'shelfDays') { const n = Math.max(1, Math.round(+v || 0)); if (!n) return; g.items.forEach(i => { i.shelfDays = null; }); setOverride(g.ingredient, {shelfDays: n}); return commit(`${g.ingredient}: ${n} Tage haltbar`); }
    if (f === 'tracking') {
      const c = catalogFor(g.ingredient) || {};
      g.items.forEach(i => { i.tracking = v; i.level = 1; if (v === 'exact' && !i.amount) i.amount = c.pack || 1; });
      setOverride(g.ingredient, {tracking: v}); return commit();
    }
  }
  if (t.dataset.row && ui.receipt) {
    const r = receiptRow(t.dataset.row); if (!r) return;
    const f = t.dataset.f;
    r[f] = f === 'amount' ? (parseFloat(t.value.replace(',', '.')) || 0) : t.value;
    r.edited = true;
    if (f === 'name') {
      const c = catalogFor(t.value), res = resolve(t.value);
      r.variety = res ? res.variety : null;
      if (c) { r.name = c.name; r.area = c.area; r.unit = c.unit; r.amount = receiptAmount(r.weightKg ? [r.weightKg * 1000, 'g'] : r.sz, r.weightKg ? 1 : (r.qty || 1), c.unit, c); }
      r.src = r.src === 'unknown' ? 'learned' : r.src;
      r.skip = false;
    }
    return render();
  }
}

function onInput(e) {
  const t = e.target, {ui} = app;
  if (t.id === 'pantry-search') { ui.search = t.value; return render(); }
  if (t.id === 'recipe-search') { ui.recipeSearch = t.value; return render(); }
  if (t.dataset.pasteText != null) { ui.pasteText = t.value; return; }
  const d = ui.draft;
  if (!d) return;
  if (t.dataset.draft) {
    d[t.dataset.draft] = t.tagName === 'SELECT' ? (t.value || null) : t.value;
    if (t.dataset.draft === 'title') { suggestRawAll(d); refreshDraftBits(); }
    return;
  }
  if (t.dataset.line != null) {
    const l = d.lines[+t.dataset.line]; if (!l) return;
    l.text = t.value;
    const info = lineInfo(l.text);
    if (info && info.optional) l.optional = true;
    if (!l.rawTouched) l.raw = !!(info && rawSuggested(d.title, info.name));
    return refreshDraftBits();
  }
  if (t.dataset.step != null) { d.steps[+t.dataset.step] = t.value; }
}

/* Recipe form: Enter in an ingredient line opens the next one; pasting several lines fills several rows. */
const blankLine = text => ({text, optional: false, raw: false, rawTouched: false});
function onPaste(e) {
  const t = e.target, d = app.ui.draft;
  if (!d || t.dataset.line == null) return;
  const text = (e.clipboardData || window.clipboardData).getData('text');
  const parts = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (parts.length < 2) return;
  e.preventDefault();
  const n = +t.dataset.line;
  const before = t.value.slice(0, t.selectionStart) + parts[0] + t.value.slice(t.selectionEnd);
  d.lines[n].text = before;
  d.lines.splice(n + 1, 0, ...parts.slice(1).map(blankLine));
  for (const l of d.lines) { const info = lineInfo(l.text); if (info && info.optional) l.optional = true; }
  suggestRawAll(d);
  render();
  focusField(`ing-line-${n + parts.length - 1}`);
}

/* ---- forms ---- */
function onSubmit(e) {
  e.preventDefault();
  const {state, ui} = app;
  const f = e.target.dataset.form;
  if (f === 'add') return submitAdd();
  if (f === 'shopping') {
    const v = $('#shopping-input').value.trim(); if (!v) return;
    for (const part of splitEntries(v)) { const p = parseIngredientLine(part); if (p) addToShopping(state, p.name, p.amount, p.unit); }
    return commit();
  }
  if (f === 'recipe') {
    const d = ui.draft; if (!d) return;
    if (!(d.title || '').trim()) { toast('Bitte einen Namen eintragen'); return focusField('recipe-title'); }
    if (!d.lines.some(l => lineInfo(l.text))) { toast('Mindestens eine Zutat eintragen'); return focusField('ing-line-0'); }
    const existing = d.id ? state.recipes.find(r => r.id === d.id) : null;
    const r = recipeFromDraft(d, existing, state.recipes);
    return withUndo(() => {
      if (existing) state.recipes[state.recipes.indexOf(existing)] = r; else state.recipes.push(r);
      ui.recipeForm = false; ui.draft = null; ui.recipeId = r.id; ui.persons = r.servings; window.scrollTo(0, 0);
    }, existing ? 'Änderungen gespeichert' : 'Rezept gespeichert');
  }

}

function onKey(e) {
  if (e.key === 'Escape' && app.ui.sheet) { app.ui.sheet = null; return render(); }
  const t = e.target, d = app.ui.draft;
  if (e.key === 'Enter' && d && t.dataset && t.dataset.line != null && !e.isComposing) {
    e.preventDefault();
    const n = +t.dataset.line;
    d.lines.splice(n + 1, 0, blankLine(''));
    render();
    focusField(`ing-line-${n + 1}`);
  }
}

export function bindEvents() {
  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  document.addEventListener('input', onInput);
  document.addEventListener('submit', onSubmit);
  document.addEventListener('keydown', onKey);
  document.addEventListener('paste', onPaste);
}
