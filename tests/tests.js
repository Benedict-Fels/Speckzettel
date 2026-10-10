/* Speckzettel tests. Run in the browser (tests/run.html via the local server) or with Node (node tests/run.mjs).
   Every new receipt format or bug fix should add a case here. */
import {setCatalog, setOverrides, resolve, key, catalogFor, ruleFor, iconFor} from '../js/catalog.js';
import {convert} from '../js/units.js';
import {migrate, SCHEMA} from '../js/migrate.js';
import {seed} from '../js/seed.js';
import {addItem, packStatus, stockFor, purgeGone, confirmStillThere, setArea, groupItems, inSoonBox} from '../js/pantry.js';
import {shoppingCandidates, recipeCheck, recipeScore, cook, scaleAmount, recipeDiet, fitsDiet, planCook, applyCook, matchesFilters} from '../js/recipes.js';
import {newDraft, draftFromRecipe, recipeFromDraft, restoreStarter, rawSuggested, draftFromParsed, line, lineText, lineFromText, lineToIngredient} from '../js/recipe-edit.js';
import {suggestIcon} from '../js/recipe-icons.js';
import {recipeId} from '../js/recipe-model.js';
import {starterById, starterRecipes, addNewStarters} from '../js/starter-recipes.js';
import {emptyState} from '../js/seed.js';
import {parseIngredientLine, parseRecipeText, splitEntries} from '../js/recipe-text.js';
import {stepShopping, shopLabel, addToShopping, shoppingToStock, shoppingAmountText, groupShopping, shoppingText, stockPlan, applyStockPlan, settleWithReceipt, shopName, stockNote} from '../js/shopping.js';
import {parseAmountStr} from '../js/units.js';
import {parseReceipt, classifyLine, buildArticles, receiptDate, aliasKey} from '../js/receipt/pipeline.js';
import {itemsToLines} from '../js/receipt/lines.js';
import {detectChain} from '../js/receipt/templates.js';
import {receiptRecord, findDuplicate, outcome, receiptStats} from '../js/receipt/history.js';
import {NETTO_TEXT, NETTO_ITEMS} from './receipts/fixtures.js';
import {SAMPLE_RECEIPT, SAMPLE_AI, SAMPLE_RECIPE_TEXT} from '../js/samples.js';

const DAY = 864e5;
const KNOEDEL = "Zutaten\nPortionen\nPortion abziehen\n4\nPortion hinzufügen\n400 g\nMini Knödel\n250 g\nPilze, gemischt\n1\nZwiebel, rot\n1 Bund\nSpinat, frisch\n0,5\nPaprikas, rot\n0,5\nPaprikas, gelb\n3\nKnoblauchzehen\n150 ml\nGemüsebrühe\n100 ml\nSahne\n2 EL\nOlivenöl\n100 g\nParmesan, gerieben\nSalz\nPfeffer\nZubereitung\n\n1. Die Mini-Knödel nach Packungsanleitung zubereiten und bereithalten. Die Pilze putzen und in mundgerechte Stücke schneiden. Die rote Zwiebel pellen, halbieren und in feine Streifen schneiden.\n2. Den Spinat waschen, trockenschleudern, vom Strunk befreien und in feine Streifen schneiden.\n3. Den Knoblauch pellen und in feine Würfel schneiden. Rote und gelbe Paprika waschen, trocknen und in Streifen schneiden. Öl erhitzen, Paprika, Pilze sowie die Zwiebeln hinzugeben und für etwa 5 Minuten bei mittlerer Hitze anbraten.\n4. Den Spinat und Knoblauch hineingeben und für 2 Minuten anschwitzen. Mit Gemüsebrühe auffüllen, aufkochen und für 3 Minuten köcheln lassen. Mit Salz und Pfeffer abschmecken.\nBackofen auf 160 Grad Umluft (180 Grad Ober-/ Unterhitze) vorheizen.\n5. Die Knödel hineingeben und mit geriebenem Parmesan bestreuen, für 15 Minuten im Backofen auf mittlerer Schiene überbacken. Anschließend servieren.\n";
const T0 = new Date(2026, 9, 10, 12).getTime(); /* 10.10.2026, 12:00 local time */
const empty = () => ({items: [], recipes: [], shopping: [], aliases: {}, catalogOverrides: {}});

export async function runAll(catalogDoc) {
  setCatalog(catalogDoc);
  const realNow = Date.now;
  const results = [];
  const test = (name, fn) => {
    Date.now = () => T0;
    setOverrides({});
    try { fn(); results.push({name, ok: true}); }
    catch (e) { results.push({name, ok: false, error: e.message}); }
    finally { Date.now = realNow; setOverrides({}); }
  };
  const is = (actual, expected, what = '') => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${what} erwartet ${JSON.stringify(expected)}, bekommen ${JSON.stringify(actual)}`);
  };
  const at = d => T0 + d * DAY;

  /* ---- data format ---- */
  test('Umzug 1.0.0 → aktuelles Format', () => {
    const v1 = {demo: false,
      items: [{id: 'a', name: 'Spaghetti', ing: 'Nudeln', cat: 'vorrat', mode: 'exact', unit: 'g', amount: 500, level: 1, shelf: 365, snack: false, bought: T0, seen: T0},
        {id: 'b', name: 'Zucchini', ing: 'Zucchini', cat: 'kuehl', mode: 'exact', unit: 'Stk', amount: 2, level: 1, shelf: 10, snack: false, bought: T0, seen: T0},
        {id: 'c', name: 'Erbsen', ing: 'Erbsen', cat: 'tk', mode: 'exact', unit: 'g', amount: 450, level: 1, shelf: 270, bought: T0, seen: T0}],
      recipes: [{id: 'x', name: 'Test', servings: 2, own: true, ingredients: [{name: 'Zucchini', amount: 1, unit: 'Stk'}, {name: 'Salz', amount: null, unit: null}], steps: ['a']}],
      shop: [{id: 's', name: 'Bananen', amount: 3, unit: 'Stk', done: true}],
      learned: {'tofu natur': {name: 'Tofu', cat: 'kuehl', unit: 'g'}}};
    const s = migrate(JSON.parse(JSON.stringify(v1)));
    is(s.schema, SCHEMA, 'schema');
    is(s.items.map(i => [i.ingredient, i.label, i.area, i.unit]), [['Nudeln', 'Spaghetti', 'pantry', 'g'], ['Zucchini', null, 'fridge', 'g'], ['Erbsen', null, 'freezer', 'g']]);
    is(s.items[0].boughtAt, T0, 'boughtAt');
    is(s.items.some(i => 'snack' in i), false, 'kein snack-Feld mehr');
    is(s.items[2].frozenAt, T0, 'Tiefkühl-Sachen bekommen ein Einfrierdatum');
    const rc = s.recipes[0];
    is([rc.id, rc.title, rc.servings, rc.origin, rc.steps], ['x', 'Test', 2, 'own', ['a']]);
    is(rc.ingredients, [{amount: 1, unit: 'Stück', name: 'Zucchini', variety: null, optional: false, raw: false}, {amount: null, unit: null, name: 'Salz', variety: null, optional: false, raw: false}]);
    is(s.shopping, [{id: 's', ingredient: 'Banane', variety: null, text: null, amount: 3, unit: 'Stück', done: true, doneAt: null, addedAt: null, reason: null}]);
    is(s.aliases, {'tofu natur': {ingredient: 'Tofu', area: 'fridge', unit: 'g', variety: null}});
    is([s.household.onboarded, s.settings.hintSoon], [true, true], 'bestehende Daten: kein erster Start');
    is(s.catalogOverrides, {});
  });

  test('Umzug 1.1.0 (Format 2) → aktuelles Format', () => {
    const v2 = {schema: 2, demo: false, recipes: [], shopping: [], aliases: {},
      items: [{id: 'a', ingredient: 'Tofu', variety: null, label: null, area: 'fridge', tracking: 'exact', amount: 400, unit: 'g', level: 1, boughtAt: T0, seenAt: T0, shelfDays: 10, snack: false, source: 'manual'}]};
    const s = migrate(v2);
    is(s.schema, SCHEMA);
    is([s.items[0].openedAt, s.items[0].bestBefore, s.items[0].probablyGoneAt, s.items[0].shelfDays, 'snack' in s.items[0]], [null, null, null, 10, false]);
  });

  test('Umzug 1.2.0 (Format 3): umbenannte Zutaten', () => {
    const it = (ingredient, variety = null) => ({id: ingredient, ingredient, variety, label: null, area: 'pantry', tracking: 'exact', amount: 1, unit: 'g', level: 1, boughtAt: T0, seenAt: T0});
    const v3 = {schema: 3, demo: false, items: [it('Zwiebeln'), it('Rote Linsen'), it('Haferdrink'), it('Gehackte Tomaten'), it('Tofu', 'geräuchert')],
      recipes: [{id: 'r', title: 'Dal', servings: 2, origin: 'own', steps: [], ingredients: [{amount: 200, unit: 'g', name: 'Rote Linsen', variety: null}, {amount: 1, unit: 'Stück', name: 'Zwiebeln', variety: null}]}],
      shopping: [{id: 's', name: 'Haferdrink', amount: null, unit: null, done: false}],
      aliases: {'haferdr ung': {ingredient: 'Haferdrink', area: 'fridge', unit: 'ml'}}, catalogOverrides: {Zwiebeln: {shelfDays: 40}}};
    const s = migrate(v3);
    is(s.items.map(i => [i.ingredient, i.variety]), [['Zwiebel', null], ['Linsen', 'rot'], ['Pflanzendrink', 'Hafer'], ['Dosentomaten', null], ['Tofu', 'geräuchert']]);
    is(s.recipes[0].ingredients.map(x => [x.name, x.variety]), [['Linsen', 'rot'], ['Zwiebel', null]]);
    is([s.shopping[0].ingredient, s.aliases['haferdr ung'].ingredient, s.aliases['haferdr ung'].variety, Object.keys(s.catalogOverrides)], ['Pflanzendrink', 'Pflanzendrink', 'Hafer', ['Zwiebel']]);
    is(s.household, {diet: null, onboarded: true});
  });

  /* ---- catalog ---- */
  test('Katalog: Namen, Mehrzahl, Synonyme mit Sorte', () => {
    is(resolve('Zwiebeln'), {name: 'Zwiebel', variety: null});
    is(resolve('Spaghetti'), {name: 'Nudeln', variety: 'Spaghetti'});
    is(resolve('rote Linsen'), {name: 'Linsen', variety: 'rot'});
    is(resolve('Eier'), {name: 'Ei', variety: null});
    is(resolve('Karotten').name, 'Karotte'); is(resolve('Möhren').name, 'Karotte');
    is(resolve('Hafermilch'), {name: 'Pflanzendrink', variety: 'Hafer'});
    is(key('Erbsen') === key('Kichererbsen'), false, 'Erbsen ≠ Kichererbsen');
    is(key('Reis') === key('Reisnudeln'), false);
    is(resolve('Unbekanntes Zeug'), null);
  });
  test('Katalog: jede Zutat ist vollständig', () => {
    for (const [n, e] of Object.entries(catalogDoc.ingredients)) {
      if (!e.group || !e.area || !e.unit || !e.tracking || !e.profile || !e.diet) throw new Error(`${n}: Pflichtfeld fehlt`);
      if (e.profile === 'perishable' && !e.shelfDays) throw new Error(`${n}: verderblich ohne Haltbarkeit`);
    }
    is(Object.keys(catalogDoc.ingredients).length >= 250, true, 'mindestens 250 Zutaten');
    is(Object.entries(catalogDoc.ingredients).filter(([, e]) => e.staple).map(([n]) => n).sort(), ['Pfeffer', 'Salz', 'Wasser']);
  });
  test('Bon-Regeln: Stichproben', () => {
    const cases = {'SPEISEZWIEB.': 'Zwiebel', 'KICHERERBSEN': 'Kichererbsen', 'TK ERBSEN': 'Erbsen', 'BUTTERMILCH': 'Buttermilch', 'ERDNUSSBUTTER': 'Erdnussmus',
      'GL grie.Jogh.Nat.4ST': 'Joghurt', 'SNACK CHIPS PAPRIKA': 'Chips', 'RAEUCHERTOFU': 'Tofu', 'HACKFLEISCH GEM.': 'Hackfleisch', 'APFELSAFT': 'Saft', 'TOMATEN GEHACKT': 'Dosentomaten'};
    for (const [t, exp] of Object.entries(cases)) is((ruleFor(t) || {}).name, exp, t);
    is(ruleFor('BIO HAFERDRINK'), {name: 'Pflanzendrink', variety: 'Hafer'});
  });
  test('Umrechnung pro Zutat', () => {
    is(convert(240, 'g', 'Dose', catalogFor('Kichererbsen')), 1);
    is(+convert(1, 'kg', 'Stück', catalogFor('Zwiebel')).toFixed(2), 6.67);
    is(convert(3, 'Stück', 'g', catalogFor('Kartoffel')), 300);
    is(convert(2, 'Stück', 'Zehe', catalogFor('Knoblauch')), 2);
    is(convert(2, 'EL', 'ml', null), 30, 'Löffel ohne Katalog');
    is(convert(1, 'Bund', 'g', catalogFor('Tofu')), null, 'keine sinnlose Umrechnung');
  });

  test('Neuere Datenformate werden abgelehnt', () => {
    let msg = '';
    try { migrate({schema: SCHEMA + 1, items: [], recipes: []}); } catch (e) { msg = e.message; }
    is(msg, 'newer');
  });

  /* ---- text parsing ---- */
  test('Zutatenzeilen lesen', () => {
    const cases = [
      ['250g Pasta', {name: 'Nudeln', amount: 250, unit: 'g'}],
      ['2 Zehen Knoblauch', {name: 'Knoblauch', amount: 2, unit: 'Zehe'}],
      ['1,5 kg Kartoffeln', {name: 'Kartoffel', amount: 1500, unit: 'g'}],
      ['200 g Linsen (rot)', {name: 'Linsen', amount: 200, unit: 'g', variety: 'rot'}],
      ['2 Knoblauchzehen', {name: 'Knoblauch', amount: 2, unit: 'Zehe'}],
      ['½ Zitrone', {name: 'Zitrone', amount: .5, unit: 'Stück'}],
      ['Salz nach Geschmack', {name: 'Salz', amount: null, unit: null}],
      ['• 200 ml Hafercuisine', {name: 'Pflanzensahne', amount: 200, unit: 'ml', variety: 'Hafer'}],
    ];
    for (const [line, exp] of cases) { const p = parseIngredientLine(line); const got = {name: p.name, amount: p.amount, unit: p.unit}; if (exp.variety) got.variety = p.variety; is(got, exp, line); }
  });

  test('Mehrere Einträge in einem Feld', () => {
    is(splitEntries('500 g Tofu, 2 Zucchini; Spinat\n1,5 kg Kartoffeln'), ['500 g Tofu', '2 Zucchini', 'Spinat', '1,5 kg Kartoffeln']);
  });

  test('Rezepttext (Instagram-Beispiel)', () => {
    const r = parseRecipeText(SAMPLE_RECIPE_TEXT);
    is(r.title, 'Cremige Pasta mit Champignons (vegan)');
    is(r.servings, 2); is(r.ingredients.length, 8); is(r.steps.length, 4);
    is(r.ingredients.slice(-2).map(i => i.name), ['Salz', 'Pfeffer'], '„Salz & Pfeffer“ wird zwei Zutaten');
  });

  test('Kopierte Webseite: Menge und Zutat auf getrennten Zeilen, Knöpfe ignoriert (Bene, 11.10.2026)', () => {
    const r = parseRecipeText(KNOEDEL);
    is([r.title, r.servings, r.ingredients.length, r.steps.length], ['Neues Rezept', 4, 13, 6]);
    is(r.ingredients.map(i => [i.amount, i.unit, i.name, i.variety]).slice(0, 11), [[400, 'g', 'Mini Knödel', null], [250, 'g', 'Pilze', null], [1, 'Stück', 'Zwiebel', 'rot'],
      [1, 'Bund', 'Spinat', null], [.5, 'Stück', 'Paprika', 'rot'], [.5, 'Stück', 'Paprika', 'gelb'], [3, 'Zehe', 'Knoblauch', null], [150, 'ml', 'Gemüsebrühe', null],
      [100, 'ml', 'Sahne', null], [2, 'EL', 'Öl', 'Oliven'], [100, 'g', 'Parmesan', null]]);
    const p = l => { const x = parseIngredientLine(l); return [x.amount, x.unit, x.name]; };
    is([p('Tomaten 200g'), p('200g Tomaten'), p('200 g Tomaten'), p('Tomatn 200 g'), p('2 Zuchini'), p('Salz, 1 Prise')],
      [[200, 'g', 'Tomate'], [200, 'g', 'Tomate'], [200, 'g', 'Tomate'], [200, 'g', 'Tomate'], [2, 'Stück', 'Zucchini'], [1, 'Prise', 'Salz']]);
  });

  /* ---- receipts ---- */
  test('eBon-Text (REWE-Beispiel)', () => {
    const rows = parseReceipt(SAMPLE_RECEIPT, {}).rows;
    is(rows.map(r => r.name), ['Pflanzendrink', 'Tofu', 'Spinat', 'Sojasauce', 'Kichererbsen', 'Paprika', 'Chips', 'Mandelmus']);
    is([rows[0].variety, rows[1].variety], ['Hafer', 'natur']);
    is(rows[4].amount, 2, 'Kichererbsen 2 Dosen');
    is(rows.map(r => r.src).every(x => x === 'rule'), true);
    is(rows.filter(r => r.skip).map(r => r.name), ['Chips'], 'Snacks ausgegraut');
    is(parseReceipt(SAMPLE_RECEIPT, {}, {trackSnacks: true}).rows.filter(r => r.skip).length, 0, 'mit „Snacks verfolgen“');
  });

  test('Bon: Mengen umrechnen, ohne Größe übliche Packung, TK in den Tiefkühler', () => {
    const rows = parseReceipt('SPEISEZWIEB. 1KG 1,49 B\nTOFU NATUR 2,29 B\nRAHMSPINAT TK 450G 1,99 B\nMINERALWASSER 0,49 A', {}).rows;
    is(rows.map(r => [r.name, r.amount, r.unit, r.area]), [['Zwiebel', 7, 'Stück', 'pantry'], ['Tofu', 400, 'g', 'fridge'], ['Spinat', 450, 'g', 'freezer'], ['Wasser', 1, 'Stück', 'pantry']]);
    is(rows[3].skip, true, 'Getränke ausgegraut');
  });

  test('KI-Antwort im Format mit |', () => {
    const res = parseReceipt(SAMPLE_AI, {});
    is([res.via, res.rows.length, res.total, res.checks.sum], ['ai', 7, 13.03, 'ok']);
    is([res.rows[5].name, res.rows[5].amount, res.rows[5].unit, res.rows[5].area, res.rows[4].variety], ['Zwiebel', 7, 'Stück', 'pantry', 'Spaghetti']);
    const old = parseReceipt('TOFU NAT. 400G | Tofu | 400 | g | Kühlschrank\nPFAND | Pfand | 1 | Stück | Vorrat', {});
    is([old.rows.map(r => [r.name, r.amount]), old.checks.sum], [[['Tofu', 400]], 'none'], 'altes Format ohne Preis, Pfand nie in den Vorrat');
  });

  test('Gelernte Bon-Texte haben Vorrang', () => {
    const rows = parseReceipt('MANDELMUS 250G 4,99 B', {'mandelmus': {ingredient: 'Mandelmus', area: 'pantry', unit: 'g'}}).rows;
    is([rows[0].name, rows[0].src, rows[0].amount, rows[0].unit], ['Mandelmus', 'learned', 250, 'g']);
  });

  /* ---- pantry: packs ---- */
  test('Eine Packung pro Kauf, Grobes wird aufgefüllt', () => {
    const s = empty();
    addItem(s, {name: 'Tofu', amount: 400}); addItem(s, {name: 'Tofu', amount: 200}); addItem(s, {name: 'Tofu'});
    is(s.items.map(i => i.amount), [400, 200, 400], 'ohne Menge: übliche Packung');
    const oil = addItem(s, {name: 'Essig'}); oil.level = .25;
    addItem(s, {name: 'Essig'});
    is([s.items.filter(i => i.ingredient === 'Essig').length, oil.level], [1, 1]);
    is(groupItems(s.items).map(x => [x.name, x.items.length]), [['Tofu', 3], ['Essig', 1]]);
  });

  /* The four phases from spec 7.3, days counted from purchase. */
  const phases = (name, extra = {}) => {
    const s = empty();
    const i = addItem(s, {name, amount: 1, ...extra});
    const out = [];
    for (let d = 0; d <= 40; d++) out.push(packStatus(i, at(d)).phase);
    return out;
  };
  const firstDays = p => ['soon', 'over', 'gone'].map(x => p.indexOf(x));

  test('Phasen: Spinat (4 Tage haltbar, drüber genauso lange)', () => is(firstDays(phases('Spinat')), [2, 5, 9]));
  test('Phasen: Tofu (10 Tage)', () => is(firstDays(phases('Tofu')), [8, 11, 21]));
  test('Phasen: Ausnahme 60 Tage drüber, geöffnet Grundregel (Joghurt)', () => {
    setOverrides({Joghurt: {area: 'fridge', unit: 'g', tracking: 'exact', profile: 'perishable', shelfDays: 14, graceDays: 60, openedDays: 4}});
    const j = addItem(empty(), {name: 'Joghurt', amount: 500});
    is([packStatus(j, at(74)).phase, packStatus(j, at(75)).phase], ['over', 'gone']);
    j.openedAt = at(2);
    is([6, 7, 10, 11].map(d => packStatus(j, at(d)).phase), ['soon', 'over', 'over', 'gone'], 'geöffnet: 4 Tage + 4 drüber');
  });
  test('Phasen: Verbrauchsdatum (Hackfleisch)', () => {
    setOverrides({Hackfleisch: {area: 'fridge', unit: 'g', tracking: 'exact', profile: 'perishable', shelfDays: 1, useBy: true}});
    is(firstDays(phases('Hackfleisch')), [0, -1, 2]);
  });
  test('Haltbares und Eingefrorenes melden sich nie', () => {
    is([...new Set(phases('Nudeln'))], ['ok']);
    is([...new Set(phases('Erbsen'))], ['frozen']);
    is([...new Set(phases('Spinat', {area: 'freezer'}))], ['frozen']);
  });
  test('Angebrochene Konserve bekommt eine Uhr', () => {
    const k = addItem(empty(), {name: 'Kokosmilch', amount: 1});
    is(packStatus(k, at(400)).phase, 'ok', 'zu: keine Uhr');
    k.openedAt = T0;
    is([1, 4, 7].map(d => packStatus(k, at(d)).phase), ['soon', 'over', 'gone']);
  });
  test('„Drüber“ zählt nur 3 Tage als „bald verbrauchen“', () => {
    const t = addItem(empty(), {name: 'Tofu', amount: 400});
    is([13, 14].map(d => inSoonBox(packStatus(t, at(d)))), [true, false]);
  });
  test('Vermutlich weg: zählt nicht beim Kochen, Noch da, nach 14 Tagen gelöscht', () => {
    const s = empty();
    const sp = addItem(s, {name: 'Spinat', amount: 200});
    Date.now = () => at(9);
    is(packStatus(sp).phase, 'gone');
    is(stockFor(s.items, 'Spinat').length, 0, 'zählt nicht als Vorrat');
    confirmStillThere(sp);
    is([packStatus(sp).phase, packStatus(sp).confirmed], ['over', true]);
    is(packStatus(sp, at(13)).phase, 'over'); is(packStatus(sp, at(14)).phase, 'gone', 'nach erneuter Kulanz wieder unten');
    is(purgeGone(s, at(27)), 0, '13 Tage unten: bleibt');
    is(purgeGone(s, at(28)), 1, '14 Tage unten: gelöscht');
  });
  test('Wiederkauf schiebt die alte, abgelaufene Packung nach „vermutlich weg“', () => {
    const s = empty();
    const old = addItem(s, {name: 'Tofu', amount: 400});
    Date.now = () => at(12);
    addItem(s, {name: 'Tofu', amount: 400, source: 'receipt'});
    is(packStatus(old).phase, 'gone');
  });
  test('Einfrieren stoppt die Uhr, Auftauen startet sie neu', () => {
    const t = addItem(empty(), {name: 'Tofu', amount: 400});
    setArea(t, 'freezer', at(2));
    is(packStatus(t, at(200)).phase, 'frozen');
    setArea(t, 'fridge', at(200));
    is(packStatus(t, at(200)).daysLeft, 4, 'aufgetaut: Haltbarkeit nach dem Öffnen');
  });

  /* ---- recipes ---- */
  test('Skalieren: Zählbares auf halbe aufrunden', () => {
    is(scaleAmount(1, 'Stück', 1.5), 1.5); is(scaleAmount(1, 'Dose', .3), .5); is(scaleAmount(250, 'g', .5), 125);
  });

  test('Rezept-Abgleich mit den Beispieldaten', () => {
    const s = seed();
    const dal = s.recipes.find(r => r.id === 'r2');
    is(recipeCheck(s.items, dal, 2).map(x => x.status), ['ok', 'ok', 'ok', 'ok', 'ok', 'check', 'ok', 'ok', 'optional'], 'Koriander ist optional und fehlt');
    is(recipeCheck(s.items, dal, 6).map(x => x.status)[0], 'buy', 'Linsen reichen nicht für 6');
    const pan = s.recipes.find(r => r.id === 'r3');
    is(recipeCheck(s.items, pan, 2)[2].status, 'buy', 'Champignons liegen unter „vermutlich weg“');
  });

  test('Abgleich rechnet um: 240 g Kichererbsen = 1 Dose', () => {
    const s = empty(); addItem(s, {name: 'Kichererbsen', amount: 1});
    const r = {servings: 2, ingredients: [{name: 'Kichererbsen', amount: 240, unit: 'g'}, {name: 'Salz', amount: null, unit: null}, {name: 'Pfeffer', amount: 1, unit: 'Prise'}]};
    is(recipeCheck(s.items, r, 2).map(x => x.status), ['ok', 'ok', 'ok'], 'Salz und Pfeffer immer da');
    is(recipeScore(s.items, r).total, 1, 'Grundausstattung zählt nicht mit');
    cook(s, r, 1);
    is(s.items[0].amount, .5, 'halbe Dose übrig');
  });

  test('Ernährung: aus den Zutaten', () => {
    const rc = (...names) => ({ingredients: names.map(name => ({name}))});
    is([recipeDiet(rc('Tofu', 'Reis')), recipeDiet(rc('Feta', 'Tomate')), recipeDiet(rc('Hackfleisch', 'Zwiebel'))], ['vegan', 'vegetarian', 'all']);
    is([fitsDiet(rc('Feta'), 'vegan'), fitsDiet(rc('Feta'), 'vegetarian'), fitsDiet(rc('Hackfleisch'), 'all')], [false, true, true]);
  });

  test('Gekocht: was zuerst abläuft, geht zuerst; Rest gilt als angebrochen', () => {
    const s = empty();
    Date.now = () => at(-5); const old = addItem(s, {name: 'Tofu', amount: 400});
    Date.now = () => T0; const fresh = addItem(s, {name: 'Tofu', amount: 200});
    cook(s, {servings: 2, ingredients: [{name: 'Tofu', amount: 500, unit: 'g'}]}, 2);
    is(stockFor(s.items, 'Tofu').map(i => [i.id, i.amount]), [[fresh.id, 100]]);
    is([fresh.openedAt, old.amount], [T0, 0], 'Rest angebrochen, alte Packung leer');
  });

  /* ---- shopping ---- */
  test('Einkaufszettel: zusammenführen und in den Vorrat', () => {
    const s = empty();
    addToShopping(s, 'Spinat', 100, 'g'); addToShopping(s, 'Spinat', 50, 'g'); addToShopping(s, 'Bananen', null, null);
    is(s.shopping.map(x => [x.ingredient, x.amount]), [['Spinat', 150], ['Banane', null]]);
    s.shopping.forEach(x => x.done = true);
    is(shoppingToStock(s), 2);
    is(s.items.map(i => [i.ingredient, i.amount, i.unit]), [['Spinat', 200, 'g'], ['Banane', 5, 'Stück']]);
    addToShopping(s, 'Tofu', 700, 'g'); s.shopping[0].done = true; shoppingToStock(s);
    is(s.items.filter(i => i.ingredient === 'Tofu').map(i => i.amount), [400, 400], '700 g → zwei 400er-Packungen');
  });

  /* ---- 1.4: recipes ---- */
  const recipe = (ingredients, more = {}) => ({id: 't', title: 'Test', servings: 2, prepTime: 0, cookTime: 0, restTime: 0, cookedAt: [], steps: [],
    ingredients: ingredients.map(([name, amount, unit, flags = {}]) => ({name, amount, unit, variety: null, optional: false, raw: false, ...flags})), ...more});

  test('Umzug 1.3.0 (Format 4): Rezepte bekommen Symbol, Zeiten, optional/roh', () => {
    const v4 = {schema: 4, demo: false, items: [], shopping: [], aliases: {}, catalogOverrides: {}, household: {diet: 'vegan', onboarded: true}, settings: {},
      recipes: [{id: 'r2', title: 'Rotes Linsen-Dal', servings: 2, origin: 'starter', ingredients: [{amount: 200, unit: 'g', name: 'Linsen', variety: 'rot'}], steps: []},
        {id: 'abc1234', title: 'Omas Kartoffelsuppe', servings: 4, origin: 'own', ingredients: [{amount: 1, unit: 'kg', name: 'Kartoffel', variety: null}], steps: ['Kochen.']}]};
    const s = migrate(v4);
    is(s.schema, SCHEMA);
    const [dal, soup] = s.recipes;
    is([dal.icon, dal.prepTime + dal.cookTime, dal.ingredients.length, dal.ingredients.at(-1).optional], ['curry', 30, 9, true], 'mitgeliefertes Rezept auf neuem Stand');
    is([soup.id, soup.icon, soup.diet, soup.prepTime, soup.cookedAt, soup.ingredients[0].optional, soup.ingredients[0].raw], ['abc1234', 'soup', null, 0, [], false, false], 'eigenes Rezept ergänzt');
  });

  test('Symbol-Vorschlag aus Titel und Zutaten', () => {
    is([suggestIcon('Rotes Linsen-Dal'), suggestIcon('Tiramisu'), suggestIcon('Ofengemüse vom Blech'), suggestIcon('Abendessen', ['Nudeln', 'Tomate']), suggestIcon('Irgendwas')],
      ['curry', 'dessert', 'oven', 'pasta', 'veggie']);
    is([recipeId('Rotes Linsen-Dal'), recipeId('Rotes Linsen-Dal', ['rotes-linsen-dal']), recipeId('Grüße aus Köln')], ['rotes-linsen-dal', 'rotes-linsen-dal-2', 'gruesse-aus-koeln']);
  });

  test('Optional: zählt nicht, fehlt nie, kommt nicht auf den Zettel', () => {
    const s = empty(); addItem(s, {name: 'Reis', amount: 500});
    const r = recipe([['Reis', 150, 'g'], ['Koriander', 1, 'Bund', {optional: true}]]);
    const rows = recipeCheck(s.items, r, 2);
    is(rows.map(x => x.status), ['ok', 'optional']);
    is(rows[1].missing, null, 'keine fehlende Menge');
    const sc = recipeScore(s.items, r);
    is([sc.total, sc.ok, sc.buy, sc.pct], [1, 1, 0, 1], 'Abdeckung ohne optionale Zutat');
    addItem(s, {name: 'Koriander', amount: 1});
    is(recipeCheck(s.items, r, 2)[1].status, 'ok', 'optional und da: normal „da“');
  });

  test('Roh: Eier über dem MHD fehlen, sonst nur „schau nach“', () => {
    const s = empty();
    Date.now = () => at(-25); const old = addItem(s, {name: 'Ei', amount: 6});
    Date.now = () => T0;
    const cooked = recipe([['Ei', 2, 'Stück']]), raw = recipe([['Ei', 2, 'Stück', {raw: true}]]);
    is(recipeCheck(s.items, cooked, 2)[0].status, 'check', 'durchgegart: riech mal');
    const x = recipeCheck(s.items, raw, 2)[0];
    is([x.status, x.note, x.rawOver], ['buy', 'Eier sind drüber – für dieses Rezept nicht roh verwenden', true]);
    addItem(s, {name: 'Ei', amount: 1}); confirmStillThere(old);   /* Wiederkauf schiebt die alten weg; „Noch da“ holt sie zurück */
    const y = recipeCheck(s.items, raw, 2)[0];
    is([y.status, y.missing, y.note], ['buy', 1, 'nur 1 Stück da, der Rest ist drüber – nicht roh verwenden'], 'frische zählen');
    is(planCook(s.items, raw, 2)[0].use, 1, 'Gekocht nimmt nur die frischen');
    is([rawSuggested('Tiramisu', 'Eier'), rawSuggested('Rührei', 'Eier'), rawSuggested('Tiramisu', 'Mascarpone')], [true, false, false]);
  });

  test('Übersicht: Sortierung bevorzugt Ablaufendes, kürzlich Gekochtes rutscht runter', () => {
    const s = empty();
    Date.now = () => at(-3); addItem(s, {name: 'Spinat', amount: 200});
    Date.now = () => T0; addItem(s, {name: 'Nudeln', amount: 500});
    const a = recipe([['Nudeln', 250, 'g']]), b = recipe([['Nudeln', 250, 'g'], ['Spinat', 100, 'g']]);
    const sa = recipeScore(s.items, a), sb = recipeScore(s.items, b);
    is([sa.pct, sb.pct, sb.soon.map(x => [x.name, x.when])], [1, 1, [['Spinat', 'morgen']]]);
    is(sb.score > sa.score, true, 'rettet den Spinat');
    a.cookedAt = [at(-1)];
    is(+(sa.score - recipeScore(s.items, a).score).toFixed(2), .05, 'gestern gekocht: −0,05');
  });

  test('Filter: kochbar, ≤ 30 Min, lange nicht gekocht, Suche', () => {
    const s = empty(); addItem(s, {name: 'Nudeln', amount: 500});
    const ok = recipe([['Nudeln', 250, 'g']], {title: 'Pasta aglio', prepTime: 5, cookTime: 15, cookedAt: [at(-40)]});
    const miss = recipe([['Nudeln', 250, 'g'], ['Zucchini', 1, 'Stück']], {title: 'Zucchini-Pasta', prepTime: 20, cookTime: 25, cookedAt: [at(-2)]});
    const m = (r, f, q = '') => matchesFilters(r, recipeScore(s.items, r), f, q);
    is([m(ok, ['cookable']), m(miss, ['cookable'])], [true, false], 'kochbar');
    is([m(ok, ['quick']), m(miss, ['quick']), m(recipe([['Nudeln', 1, 'g']]), ['quick'])], [true, false, false], '≤ 30 Min, ohne Zeit nicht');
    is([m(ok, ['longAgo']), m(miss, ['longAgo']), m(recipe([['Nudeln', 1, 'g']]), ['longAgo'])], [true, false, true], 'lange nicht / nie gekocht');
    is([m(ok, ['cookable', 'quick']), m(miss, [], 'zucchini'), m(ok, [], 'zucchini')], [true, true, false], 'kombiniert und Suche über Zutaten');
  });

  test('Gekocht-Vorschau: korrigieren, dann abziehen', () => {
    const s = empty();
    addItem(s, {name: 'Linsen', variety: 'rot', amount: 300}); addItem(s, {name: 'Currypaste'}); addItem(s, {name: 'Hummus'});
    s.items.find(i => i.ingredient === 'Currypaste').level = .25;
    const r = recipe([['Linsen', 200, 'g'], ['Currypaste', 1, 'EL'], ['Hummus', null, null], ['Salz', null, null], ['Tofu', 200, 'g'], ['Koriander', 1, 'Bund', {optional: true}]]);
    const plan = planCook(s.items, r, 2);
    is(plan.map(x => x.kind), ['exact', 'rough', 'flag', 'staple', 'none', 'none']);
    is([plan[0].have, plan[0].use, plan[0].unit, plan[1].after, plan[2].gone], [300, 200, 'g', .15, false]);
    plan[0].use = 250; plan[1].after = 0; plan[2].gone = true;
    const res = applyCook(s, r, plan);
    is(s.items.map(i => [i.ingredient, i.amount]), [['Linsen', 50]], 'korrigierte Menge, leere Paste und Hummus weg');
    is(res.emptied, ['Currypaste', 'Hummus']);
    is([r.cookedAt, s.items[0].openedAt], [[T0], T0], 'gekocht gemerkt, Rest angebrochen');
    const r2 = recipe([['Hummus', null, null]]); addItem(s, {name: 'Hummus'});
    cook(s, r2, 2);
    is(stockFor(s.items, 'Hummus').length, 1, 'ohne Korrektur bleibt Nur-da-Sache da');
  });

  test('Rezept bearbeiten: Formular hin und zurück, Mitgeliefertes wird eigenes', () => {
    const starter = starterById('r2');
    const d = draftFromRecipe(starter);
    is(d.lines.map(lineText).slice(0, 2), ['200 g Linsen (rot)', '1 Dose Kokosmilch']);
    is([d.lines[0].name, d.lines[0].amount, d.lines[0].unit, d.lines[0].variety], ['Linsen', '200', 'g', 'rot'], 'feste Felder');
    is([d.lines.at(-2).optional, lineText(d.lines.at(-1))], [true, ''], 'optional bleibt erhalten, unten eine leere Zeile');
    d.title = 'Mein Dal'; d.lines[0].amount = '250'; d.cookTime = '25';
    const r = recipeFromDraft(d, {...starter, cookedAt: [at(-3)]}, [starter]);
    is([r.id, r.origin, r.basedOn, r.title, r.ingredients[0].amount, r.cookTime, r.cookedAt], ['r2', 'own', 'r2', 'Mein Dal', 250, 25, [at(-3)]]);
    const back = restoreStarter(r);
    is([back.origin, back.title, back.cookedAt], ['starter', 'Rotes Linsen-Dal', [at(-3)]], 'Original wiederherstellen behält den Verlauf');
    const nd = newDraft(); nd.title = 'Tiramisu'; nd.lines = [line({name: 'Eier', amount: '3', raw: true}), line({name: 'Kakao zum Bestreuen'})];
    const t = recipeFromDraft(nd, null, [{id: 'tiramisu'}]);
    is([t.id, t.origin, t.icon, t.ingredients.map(i => [i.name, i.raw, i.optional]), recipeDiet(t)], ['tiramisu-2', 'own', 'dessert', [['Ei', true, false], ['Kakao', false, true]], 'vegetarian']);
    is(recipeDiet({...t, diet: 'all'}), 'all', 'eigene Angabe schlägt Vorschlag');
    const p = draftFromParsed(newDraft(), parseRecipeText('Mayonnaise\nZutaten\n1 Ei\n200 ml Öl\nZubereitung\n1. Mixen.'));
    is([p.title, p.lines[0].raw, p.lines[1].raw], ['Mayonnaise', true, false], 'roh vorgeschlagen');
  });

  test('Rezeptformular: feste Felder lesen', () => {
    const ing = l => { const p = lineToIngredient(line(l)); return p && [p.name, p.amount, p.unit, p.variety, p.optional]; };
    is(ing({name: 'Tomaten', amount: '1,5', unit: 'kg'}), ['Tomate', 1500, 'g', null, false], 'kg wird g, Mehrzahl wird Katalogname');
    is(ing({name: 'Linsen', amount: '200', unit: 'g', variety: 'rot'}), ['Linsen', 200, 'g', 'rot', false]);
    is(ing({name: 'Knoblauch', amount: '2', unit: 'Zehe'}), ['Knoblauch', 2, 'Zehe', null, false]);
    is(ing({name: 'Zwiebel', amount: '2'}), ['Zwiebel', 2, 'Stück', null, false], 'ohne Einheit: Stück');
    is(ing({name: 'Salz'}), ['Salz', null, null, null, false], 'ohne Menge: nach Geschmack');
    is(ing({name: 'Cherrytomaten', amount: '200', unit: 'g'}), ['Tomate', 200, 'g', 'Cherry', false], 'Sorte aus dem Namen');
    is(ing({name: '200 g Feta'}), ['Feta', 200, 'g', null, false], 'ganze Zeile im Namensfeld');
    is(ing({name: '  '}), null);
    const q = lineFromText('Tomaten 200g');
    is([q.name, q.amount, q.unit], ['Tomate', '200', 'g'], 'Schnellzeile');
  });

  test('Zutatenzeilen: „optional“, „nach Belieben“, „evtl.“', () => {
    is(parseIngredientLine('1 Handvoll Koriander (optional)'), {name: 'Koriander', amount: 1, unit: 'Handvoll', variety: null, optional: true});
    is(parseIngredientLine('evtl. 1 Chili'), {name: 'Chili', amount: 1, unit: 'Stück', variety: null, optional: true});
    is(parseIngredientLine('Sesam zum Bestreuen').optional, true);
    is('optional' in parseIngredientLine('2 Eier'), false);
  });

  test('Startrezepte: je Ernährung passend, alle Zutaten im Katalog', () => {
    const all = starterRecipes();
    const count = d => all.filter(r => fitsDiet(r, d)).length;
    is([count('vegan'), count('vegetarian'), count('all')], [10, 18, 26]);
    is(all.flatMap(r => r.ingredients).filter(i => !catalogFor(i.name)).map(i => i.name), [], 'unbekannte Zutaten');
    is(new Set(all.map(r => r.id)).size, all.length, 'Kennungen eindeutig');
    is(all.find(r => r.id === 'start-tiramisu').ingredients.find(i => i.name === 'Ei').raw, true);
  });

  test('Neue Startrezepte kommen dazu, gelöschte bleiben weg', () => {
    const s = emptyState({diet: 'vegan'});
    is(addNewStarters(s), 0, 'frisch angelegt: alle schon da');
    s.recipes = s.recipes.filter(r => r.id !== 'r1');
    is([addNewStarters(s), s.recipes.some(r => r.id === 'r1')], [0, false], 'gelöscht bleibt gelöscht');
    const old = {...s, starterIds: undefined, recipes: s.recipes.filter(r => r.id.startsWith('r'))};
    is(addNewStarters(old), 23, 'Daten aus 1.4.0 (ohne Merkliste) bekommen die 22 neuen und das dort gelöschte r1');
    const none = {...emptyState({withRecipes: false}), household: {diet: 'none'}};
    is([addNewStarters(none), none.recipes.length], [0, 0], 'keine Rezeptvorschläge');
    none.household.diet = 'vegetarian';
    is(addNewStarters(none), 26, 'nach Wechsel der Ernährung kommen sie');
  });

  test('„Noch da“ bei abgelaufener Packung: Rezept zählt sie als da', () => {
    const s = empty(); Date.now = () => at(-12); const t = addItem(s, {name: 'Tofu', amount: 400}); Date.now = () => T0;
    const r = recipe([['Tofu', 200, 'g']]);
    const x = recipeCheck(s.items, r, 2)[0];
    is([x.status, x.fix, x.note], ['check', 'shaky', '400 g da – MHD seit 2 Tagen drüber – riech mal']);
    confirmStillThere(t);
    is(recipeCheck(s.items, r, 2)[0].status, 'ok');
    s.items = []; addItem(s, {name: 'Currypaste'}); s.items[0].level = .25;
    is(recipeCheck(s.items, recipe([['Currypaste', 1, 'EL']]), 2)[0].fix, 'low');
  });

  test('Auf den Zettel: Fehlendes vorausgewählt, Optionales abwählbar dabei, schon Notiertes nicht', () => {
    const s = empty(); addItem(s, {name: 'Reis', amount: 100});
    const r = recipe([['Reis', 150, 'g'], ['Tofu', 200, 'g'], ['Koriander', 1, 'Bund', {optional: true}], ['Zwiebel', 1, 'Stück']]);
    const c = shoppingCandidates(recipeCheck(s.items, r, 2), n => n === 'Zwiebel');
    is(c.map(x => [x.name, x.amount, x.unit, x.optional, x.checked]), [['Reis', 50, 'g', false, true], ['Tofu', 200, 'g', false, true], ['Koriander', 1, 'Bund', true, false]]);
  });

  /* ---- 1.5: shopping list ---- */
  test('Umzug 1.4 (Format 5): Zettel-Einträge werden Zutat oder Freitext', () => {
    const v5 = {schema: 5, demo: false, items: [], recipes: [], aliases: {}, catalogOverrides: {}, starterIds: [], household: {diet: 'none', onboarded: true},
      shopping: [{id: 'a', name: 'Zwiebeln', amount: 2, unit: 'Stück', done: false}, {id: 'b', name: 'Geschenk für Lisa', amount: null, unit: null, done: true}]};
    const s = migrate(v5);
    is(s.shopping.map(x => [x.ingredient, x.text, x.amount, x.done]), [['Zwiebel', null, 2, false], [null, 'Geschenk für Lisa', null, true]]);
  });

  test('Zettel: Zusammenführen rechnet um, Herkunft sammelt sich, Freitext bleibt Freitext', () => {
    const s = empty();
    addToShopping(s, 'Kichererbsen', 1, 'Dose', {recipe: 'a'}); addToShopping(s, 'Kichererbsen', 240, 'g', {recipe: 'b'});
    addToShopping(s, 'Zwiebel', .5, 'Stück'); addToShopping(s, 'Zwiebel', .5, 'Stück');
    addToShopping(s, 'Geschenkpapier', null, null);
    is(s.shopping.map(x => [shopName(x), x.amount, x.unit]), [['Kichererbsen', 2, 'Dose'], ['Zwiebel', 1, 'Stück'], ['Geschenkpapier', null, null]]);
    is(s.shopping[0].reason, {recipes: ['a', 'b']});
    is([s.shopping[2].ingredient, s.shopping[2].text], [null, 'Geschenkpapier']);
  });

  test('Zettel: Anzeige rundet, Packungshinweis, Ladenrundgang', () => {
    const s = empty();
    const e = (name, a, u) => shoppingAmountText(addToShopping(s, name, a, u));
    is([e('Spinat', 100, 'g'), e('Dosentomaten', .3, 'Dose'), e('Zwiebel', 1.5, 'Stück'), e('Kichererbsen', 240, 'g'), e('Kreuzkümmel', 1, 'TL')],
      ['100 g (1 Pck.)', '1 Dose', '2', '240 g (1 Dose)', '']);
    addToShopping(s, 'Sonnencreme', null, null); addToShopping(s, 'Brot', 1, 'Stück');
    is(groupShopping(s.shopping).map(g => g.key), ['produce', 'bread', 'cans', 'spices', 'other']);
    is(shoppingText(s.shopping).split('\n').slice(0, 3), ['Einkauf (Speckzettel)', '– Spinat, 100 g (1 Pck.)', '– Zwiebeln, 2']);
  });

  test('Zettel → Vorrat: Prüfliste mit Packungen, korrigierbar, Freitext wird nur gelöscht', () => {
    const s = empty();
    addToShopping(s, 'Tofu', 700, 'g'); addToShopping(s, 'Zwiebel', 3, 'Stück'); addToShopping(s, 'Essig', null, null); addToShopping(s, 'Geschenkpapier', null, null);
    addToShopping(s, 'Reis', 500, 'g');
    s.shopping.slice(0, 4).forEach(x => { x.done = true; });
    const plan = stockPlan(s);
    is(plan.rows.map(r => [r.ingredient, r.kind, r.count ?? r.amount]), [['Tofu', 'packs', 2], ['Zwiebel', 'amount', 3], ['Essig', 'level', undefined]]);
    is(plan.reminders.map(shopName), ['Geschenkpapier']);
    plan.rows[0].count = 1; plan.rows[1].take = false;
    is(applyStockPlan(s, plan), 2);
    is(s.items.map(i => [i.ingredient, i.amount]), [['Tofu', 400], ['Essig', 1]]);
    is(s.shopping.map(shopName), ['Reis'], 'Erledigte weg, Offenes bleibt');
  });

  test('Bon übernommen: passende Zettel-Einträge sind erledigt', () => {
    const s = empty(); addToShopping(s, 'Tofu', 400, 'g'); addToShopping(s, 'Spinat', null, null); addToShopping(s, 'Geschenkpapier', null, null);
    s.shopping[1].done = true;
    is(settleWithReceipt(s, ['Tofu', 'Spinat', 'Reis']), ['Tofu', 'Spinat']);
    is(s.shopping.map(shopName), ['Geschenkpapier']);
  });

  test('Mengenbereich „1–2“ ergibt den Mittelwert', () => {
    is([parseAmountStr('1-2'), parseAmountStr('2–3'), parseAmountStr('½')], [1.5, 2.5, .5]);
  });

  /* ---- 2.0: receipt pipeline with the real Netto eBon of 9.10.2026 (anonymised) ---- */
  test('PDF-Positionen → Zeilen (Netto-eBon)', () => {
    is(itemsToLines(NETTO_ITEMS), ['EUR', 'GL grie.Jogh.Nat.4ST 600g    1,39    B', 'Bisc.SchoSchokokränze250G    1,69    B', '2 x    1,69',
      'Champignon weiss 400g    3,38    B', 'Rabatt 50%    -1,70', 'SUMME [4]    4,76']);
  });

  test('Zeilen einordnen', () => {
    const k = l => classifyLine(l).kind;
    is(['GL grie.Jogh.Nat.4ST 600g    1,39    B', '2 x    1,69', '2 Stk x  0,79', '0,532 kg x 2,99 EUR/kg', 'Rabatt 50%    -1,70', 'SUMME [4]    4,76',
      'B    7%    0,31    4,76    4,45', 'Geg. EC-Cash  EUR  17,26', 'PFAND 0,25 EURO  0,25 A', 'Aktionsersparnis    2,30', 'PAYBACK    2 Punkte', 'TSE-Start:2026-10-09T12:57:34.000Z', 'Filiale 0000'].map(k),
      ['article', 'qty', 'qty', 'weight', 'discount', 'total', 'tax', 'payment', 'deposit', 'discount', 'text', 'tse', 'text']);
    is(classifyLine('SUMME [4]    4,76').count, 4);
  });

  test('Netto-eBon: Kette, Datum, Mengenzeile vor dem Artikel, Rabatt, alle Proben stimmen', () => {
    const r = parseReceipt(NETTO_TEXT, {});
    is([r.chain, r.date, r.total, r.count], ['netto', '2026-10-09T14:56', 4.76, 4]);
    is(r.checks, {sum: 'ok', sumFound: 4.76, sumDiff: 0, count: 'ok', lines: 'ok'});
    is(r.rows.map(x => [x.text, x.qty, x.price, x.discount]), [['GL grie.Jogh.Nat.4ST 600g', 1, 1.39, 0], ['Bisc.SchoSchokokränze250G', 1, 1.69, 0], ['Champignon weiss 400g', 2, 3.38, -1.7]]);
    is(r.rows.map(x => [x.name, x.amount, x.unit, x.skip]), [['Joghurt', 600, 'g', false], ['Schokolade', 1, 'Stück', true], ['Champignons', 800, 'g', false]]);
    is(detectChain(['REWE Markt GmbH']), 'rewe');
  });

  test('Mengenzeile: Rechnung entscheidet vor der Vorlage', () => {
    /* REWE layout (after) on an unknown chain, and Netto layout (before) on an unknown chain */
    const after = buildArticles(['KICHERERBSEN 400G 1,58 B', '2 Stk x 0,79', 'TOFU 2,29 B', 'SUMME 3,87']);
    is(after.articles.map(a => [a.text, a.qty]), [['KICHERERBSEN 400G', 2], ['TOFU', 1]]);
    const before = buildArticles(['TOFU 2,29 B', '2 x 1,69', 'CHAMPIGNON 3,38 B', 'SUMME 5,67']);
    is(before.articles.map(a => [a.text, a.qty, a.lineCheck]), [['TOFU', 1, null], ['CHAMPIGNON', 2, 'ok']]);
    const weight = buildArticles(['BANANEN 1,49 A', '0,532 kg x 2,80 EUR/kg', 'SUMME 1,49']);
    is([weight.articles[0].weightKg, parseReceipt('BANANEN 1,49 A\n0,532 kg x 2,80 EUR/kg\nSUMME 1,49', {}).rows[0].amount], [.532, 4], '532 g Bananen = 4 Stück');
  });

  test('Summenprobe fängt Lesefehler', () => {
    const r = parseReceipt('TOFU 2,29 B\nSPINAT 1,89 B\nSUMME 3,68', {});
    is([r.checks.sum, r.checks.sumDiff], ['off', -.5]);
    const pfand = parseReceipt('WASSER 0,49 A\nPFAND 0,25 A\nLEERGUT -0,25\nSUMME 0,49', {});
    is([pfand.checks.sum, pfand.rows.length, pfand.deposits.length], ['ok', 1, 2]);
    is([receiptDate('Datum 09.10.2026 14:56'), receiptDate('09.10.26    14:56'), receiptDate('kein Datum')], ['2026-10-09T14:56', '2026-10-09T14:56', null]);
  });

  test('Gelernt mit Kette, „immer ignorieren“', () => {
    const al = {[aliasKey('GL grie.Jogh.Nat.4ST 600g', 'netto')]: {ingredient: 'Joghurt', variety: 'griechisch', area: 'fridge', unit: 'g'},
      [aliasKey('Bisc.SchoSchokokränze250G', 'netto')]: {ingredient: 'Kekse', ignore: true}};
    const r = parseReceipt(NETTO_TEXT, al);
    is(r.rows.map(x => [x.name, x.variety, x.src, x.skip]), [['Joghurt', 'griechisch', 'learned', false], ['Kekse', null, 'ignored', true], ['Champignons', null, 'rule', false]]);
    is(parseReceipt('GL grie.Jogh.Nat.4ST 600g 1,39 B', al).rows[0].src, 'rule', 'andere Kette: Netto-Kürzel gilt nicht');
  });

  test('Bon merken: doppelt erkennen, Statistik', () => {
    const res = parseReceipt(NETTO_TEXT, {});
    const rec = receiptRecord(res, res.rows);
    is([rec.key, rec.chain, rec.total, rec.lines.length, rec.lines[1].skipped, outcome(rec)], ['netto|2026-10-09T14:56|4.76', 'netto', 4.76, 3, true, 'smooth']);
    is(Object.keys(rec).includes('branch') || JSON.stringify(rec).includes('PAYBACK'), false, 'keine Filiale, kein Payback');
    is(findDuplicate([rec], parseReceipt(NETTO_TEXT, {})) === rec, true);
    const bad = receiptRecord(parseReceipt('TOFU 2,29 B\nSUMME 3,00', {}), []);
    const fixed = {...rec, corrected: true};
    is(receiptStats([rec, bad, fixed]), {total: 3, smooth: 1, corrected: 1, error: 1});
  });

  /* ---- 2.1: oil varieties, swap, shopping by weight and plural, sizes, symbols ---- */
  test('Umzug 2.0 (Format 6): Öl mit Sorte, Zucchini nach Gewicht', () => {
    const v6 = {schema: 6, demo: false, aliases: {'netto|rapsoel 1l': {ingredient: 'Rapsöl', area: 'pantry', unit: 'ml'}}, catalogOverrides: {}, starterIds: [], receipts: [], household: {diet: 'vegan', onboarded: true}, settings: {},
      items: [{id: 'a', ingredient: 'Olivenöl', variety: null, label: null, area: 'pantry', tracking: 'rough', amount: 1, unit: 'ml', level: .5, boughtAt: T0, seenAt: T0},
        {id: 'b', ingredient: 'Zucchini', variety: null, label: null, area: 'fridge', tracking: 'exact', amount: 2, unit: 'Stück', level: 1, boughtAt: T0, seenAt: T0}],
      recipes: [{id: 'x', title: 'Salat', servings: 2, origin: 'own', steps: [], ingredients: [{amount: 2, unit: 'EL', name: 'Olivenöl', variety: null}]}, {id: 'r1', title: 'alt', servings: 2, origin: 'starter', ingredients: [], steps: [], cookedAt: [T0]}],
      shopping: [{id: 's', ingredient: 'Sonnenblumenöl', text: null, amount: null, unit: null, done: false},
        {id: 't', ingredient: 'Tomate', text: null, amount: 300, unit: 'g', done: false}, {id: 'c', ingredient: 'Tomate', variety: 'Cherry', text: null, amount: 250, unit: 'g', done: false}]};
    const s = migrate(v6);
    is(s.shopping.slice(1).map(x => [x.amount, x.unit]), [[3, 'Stück'], [250, 'g']], 'Format 8: lose Tomaten in Stück, Cherry bleibt Gewicht');
    is(s.items.map(i => [i.ingredient, i.variety, i.amount, i.unit]), [['Öl', 'Oliven', 1, 'ml'], ['Zucchini', null, 500, 'g']]);
    is([s.recipes[0].ingredients[0].name, s.recipes[0].ingredients[0].variety, s.recipes[1].title, s.recipes[1].cookedAt], ['Öl', 'Oliven', 'Spaghetti mit Tomatensauce und Spinat', [T0]]);
    is([s.shopping[0].ingredient, s.shopping[0].variety, s.aliases['netto|rapsoel 1l'].variety, s.settings.theme], ['Öl', 'Sonnenblumen', 'Raps', 'system']);
    is([resolve('Olivenöl'), ruleFor('BIO OLIVENOEL NATIV 0,75L'), ruleFor('SPEISEZWIEB. 1KG').name], [{name: 'Öl', variety: 'Oliven'}, {name: 'Öl', variety: 'Oliven'}, 'Zwiebel']);
  });

  test('Sorte im Rezept: andere Sorte als Ersatz anbieten, erst nach Zustimmung nehmen', () => {
    const s = empty(); addItem(s, {name: 'Linsen', variety: 'Beluga', amount: 500});
    const r = recipe([['Linsen', 200, 'g', {variety: 'rot'}], ['Linsen', 100, 'g']]);
    let rows = recipeCheck(s.items, r, 2);
    is([rows[0].status, rows[0].note, rows[1].status], ['swap', 'Beluga da – statt rot nehmen?', 'ok'], 'ohne Sorte im Rezept gehen alle Linsen');
    is([recipeScore(s.items, r).swaps, planCook(s.items, r, 2)[0].kind], [1, 'none'], 'Ersatz wird nicht abgezogen');
    is(shoppingCandidates(rows).map(c => [c.name, c.variety, c.checked, c.swap]), [['Linsen', 'rot', false, true]], 'auf dem Zettel nicht vorausgewählt');
    r.ingredients[0].swapOk = true;
    rows = recipeCheck(s.items, r, 2);
    is([rows[0].status, rows[0].swapped, planCook(s.items, r, 2)[0].use], ['ok', true, 200]);
    addItem(s, {name: 'Linsen', amount: 500});
    r.ingredients[0].swapOk = false;
    is(recipeCheck(s.items, r, 2)[0].status, 'ok', 'Packung ohne Sorte passt immer');
    const o = empty(); addItem(o, {name: 'Öl', variety: 'Raps', amount: 750});
    is(recipeCheck(o.items, recipe([['Öl', 2, 'EL', {variety: 'Oliven'}]]), 2)[0].status, 'ok', 'Öl: Sorte ist seit 11.10. nur Beschreibung');
    const p = empty(); addItem(p, {name: 'Paprika', variety: 'gelb', amount: 1});
    const pr = recipeCheck(p.items, recipe([['Paprika', 1, 'Stück', {variety: 'rot'}]]), 2)[0];
    is([pr.status, pr.note], ['ok', '1 Stück da · gelb statt rot'], 'Paprika: Farbe ist nur Beschreibung');
    const k = empty(); addItem(k, {name: 'Kartoffel', variety: 'mehligkochend', amount: 1000});
    is(recipeCheck(k.items, recipe([['Kartoffel', 500, 'g', {variety: 'festkochend'}]]), 2)[0].status, 'ok', 'Kartoffel: Sorte ist nur Beschreibung');
  });

  test('Familien: Pflanzendrink zählt als Milch, nicht umgekehrt; Fruchtjoghurt nur als Ersatz', () => {
    const s = empty(); addItem(s, {name: 'Pflanzendrink', variety: 'Hafer', amount: 1000});
    const milk = recipeCheck(s.items, recipe([['Milch', 200, 'ml']]), 2)[0];
    is([milk.status, milk.note], ['ok', '1 l da · Pflanzendrink zählt mit']);
    is(planCook(s.items, recipe([['Milch', 200, 'ml']]), 2)[0].use, 200, 'wird abgezogen');
    const c = empty(); addItem(c, {name: 'Milch', amount: 1000});
    is(recipeCheck(c.items, recipe([['Pflanzendrink', 200, 'ml']]), 2)[0].status, 'buy', 'veganes Rezept nimmt keine Kuhmilch');
    addItem(c, {name: 'Pflanzendrink', amount: 500});
    is(planCook(c.items, recipe([['Milch', 200, 'ml']]), 2)[0].packIds.map(id => c.items.find(i => i.id === id).ingredient), ['Milch', 'Pflanzendrink'], 'erst die echte Milch');
    const j = empty(); addItem(j, {name: 'Joghurt', variety: 'Frucht', amount: 500});
    const jr = recipeCheck(j.items, recipe([['Joghurt', 150, 'g']]), 2)[0];
    is([jr.status, jr.note], ['swap', 'Frucht da – trotzdem nehmen?'], 'Fruchtjoghurt statt Naturjoghurt nur als Ersatz');
    const m = empty(); addItem(m, {name: 'Joghurt', variety: resolve('Mangojoghurt').variety, amount: 500});
    is([m.items[0].variety, recipeCheck(m.items, recipe([['Joghurt', 150, 'g', {variety: 'Frucht'}]]), 2)[0].status], ['Mango', 'ok'], 'Fruchtjoghurt im Rezept: jede Frucht passt');
    is(recipeCheck(m.items, recipe([['Joghurt', 150, 'g', {variety: 'Erdbeer'}]]), 2)[0].status, 'swap', 'Erdbeer statt Mango nur als Ersatz');
    const pp = empty(); addItem(pp, {name: 'Paprikapulver', variety: 'geräuchert'});
    is(['edelsüß', 'rosenscharf'].map(v => recipeCheck(pp.items, recipe([['Paprikapulver', 1, 'TL', {variety: v}]]), 2)[0].status), ['ok', 'swap'], 'Paprikapulver: rosenscharf ist streng');
    addItem(j, {name: 'Joghurt', variety: 'griechisch', amount: 500});
    is(recipeCheck(j.items, recipe([['Joghurt', 150, 'g', {variety: 'natur'}]]), 2)[0].status, 'ok', 'griechisch statt natur zählt');
    is(recipeCheck(j.items, recipe([['Pflanzenjoghurt', 150, 'g']]), 2)[0].status, 'buy');
  });

  test('Zettel: Mehrzahl, Sorte, Gewicht statt Stück, 50-g-Schritte', () => {
    const s = empty();
    const t = addToShopping(s, 'Tomate', 2, 'Stück', null, 'Cherry');
    addToShopping(s, 'Cherrytomaten', 100, 'g');
    const z = addToShopping(s, 'Zwiebel', 1, 'Stück'), z2 = addToShopping(s, 'Zwiebeln', 2, 'Stück');
    const b = addToShopping(s, 'Bananen', null, null);
    is([shopLabel(t), t.amount, t.unit, shoppingAmountText(t), shopLabel(z), shopLabel(b), z === z2], ['Tomaten (Cherry)', 300, 'g', '300 g', 'Zwiebeln', 'Bananen', true]);
    is(shopLabel(addToShopping(empty(), 'Zwiebel', 1, 'Stück')), 'Zwiebel', 'eine: Einzahl');
    stepShopping(t, 1); is(t.amount, 350); stepShopping(t, -1); stepShopping(t, -1); is(t.amount, 250);
    const ol = addToShopping(s, 'Öl', 2, 'EL', null, 'Oliven'); is(shoppingAmountText(ol), '1 Pck.');
    const tofu = addToShopping(s, 'Tofu', 400, 'g'); stepShopping(tofu, 1); is(tofu.amount, 450, 'Verpacktes in 50-g-Schritten');
    const lt = addToShopping(s, 'Tomate', 250, 'g');
    is([lt.amount, lt.unit, shoppingAmountText(lt), shopLabel(lt)], [2.5, 'Stück', '3', 'Tomaten'], 'Loses in Stück (Durchschnitt 100 g)');
    addToShopping(s, 'Tomaten', 1, 'Stück'); stepShopping(lt, 1); is(lt.amount, 4);
    const kz = addToShopping(s, 'Zucchini', null, null); stepShopping(kz, 1); is([kz.amount, kz.unit], [1, 'Stück']);
    stepShopping(z, -1); stepShopping(z, -1); stepShopping(z, -1); is(z.amount, null, 'unter 1: ohne Menge');
  });

  test('Zettel: Gegenprobe mit dem Vorrat', () => {
    const s = empty();
    addItem(s, {name: 'Tofu', amount: 400, area: 'fridge'}); addItem(s, {name: 'Tofu', variety: 'geräuchert', amount: 200, area: 'freezer'});
    addItem(s, {name: 'Öl', variety: 'Oliven'});
    is(stockNote(s.items, 'Tofu'), '400 g im Kühlschrank, 200 g (geräuchert) im Tiefkühler');
    is(stockNote(s.items, 'Öl'), '1 l (Oliven) im Vorrat');
    is([stockNote(s.items, 'Reis'), stockNote(s.items, 'Salz')], ['', ''], 'nichts da / Grundausstattung');
  });

  test('In den Vorrat: Flaschengröße wählbar, Loses in Stück, im Vorrat als Gewicht', () => {
    const s = empty();
    addToShopping(s, 'Öl', 2, 'EL', null, 'Oliven'); addToShopping(s, 'Tomate', 3, 'Stück');
    s.shopping.forEach(x => { x.done = true; });
    const plan = stockPlan(s);
    is(plan.rows.map(r => [r.ingredient, r.variety, r.kind, r.count ?? r.amount, r.size ?? null, r.sizes ?? null]), [['Öl', 'Oliven', 'packs', 1, 1000, [1000, 750, 500, 250]], ['Tomate', null, 'pieces', 3, null, null]]);
    plan.rows[0].size = 750;
    applyStockPlan(s, plan);
    is(s.items.map(i => [i.ingredient, i.variety, i.amount, i.unit]), [['Öl', 'Oliven', 750, 'ml'], ['Tomate', null, 300, 'g']]);
    is([iconFor('Tomate'), iconFor('Rucola'), iconFor('Tofu')], ['🍅', '🥬', '🧊']);
    const b = parseReceipt('TOMATEN 1,47 B\n3 x 0,49\nRISPENTOMATEN 500G 1,99 B\nTOMATEN 1,79 B\nSUMME 5,25', {});
    is(b.rows.map(x => x.amount), [300, 500, 500], 'Bon: 3 einzelne Tomaten = 300 g, Packung mit Größe, ohne Angabe übliche Packung');
  });

  return results;
}
