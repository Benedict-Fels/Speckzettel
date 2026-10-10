/* Recipes that come with the app (origin "starter"): everyday dishes for vegan, vegetarian and all households.
   Which ones a household sees follows its diet (worked out from the ingredients). Ids never change: an edited starter
   keeps its id, and "Original wiederherstellen" looks the original up here. New starters reach existing households
   through addNewStarters(); state.starterIds remembers which ones were offered, so deleted ones stay deleted. */
import {normalizeRecipe} from './recipe-model.js';

const ing = (name, amount, unit, variety = null, more = {}) => ({amount, unit, name, variety, optional: false, raw: false, ...more});
const opt = (name, amount, unit, variety = null) => ing(name, amount, unit, variety, {optional: true});

const STARTERS = [
  {id: 'r1', title: 'Spaghetti mit Tomatensauce und Spinat', summary: 'Der Klassiker, der den Spinat rettet.', servings: 2, prepTime: 5, cookTime: 15, icon: 'pasta', ingredients: [
    ing('Nudeln', 250, 'g'), ing('Dosentomaten', 1, 'Dose'), ing('Zwiebel', 1, 'Stück'),
    ing('Knoblauch', 2, 'Zehe'), ing('Spinat', 100, 'g'), ing('Olivenöl', 2, 'EL'), ing('Salz', null, null), opt('Basilikum', .5, 'Bund')],
    steps: ['Nudeln ins Salzwasser.', 'Zwiebel und Knoblauch klein schnippeln, in Öl glasig dünsten.', 'Tomaten dazu, 10 Minuten blubbern lassen.', 'Spinat unterheben, bis er zusammenfällt, abschmecken, fertig.']},
  {id: 'r2', title: 'Rotes Linsen-Dal', summary: 'Cremig, mild scharf, in einer halben Stunde.', servings: 2, prepTime: 10, cookTime: 20, icon: 'curry', ingredients: [
    ing('Linsen', 200, 'g', 'rot'), ing('Kokosmilch', 1, 'Dose'), ing('Dosentomaten', 1, 'Dose'),
    ing('Zwiebel', 1, 'Stück'), ing('Knoblauch', 2, 'Zehe'), ing('Currypaste', 1, 'EL'),
    ing('Spinat', 100, 'g'), ing('Reis', 150, 'g'), opt('Koriander', .5, 'Bund')],
    steps: ['Reis aufsetzen.', 'Zwiebel, Knoblauch und Currypaste anbraten.', 'Linsen, Tomaten und Kokosmilch rein, 15 Minuten köcheln.', 'Spinat unterrühren, mit Reis servieren.']},
  {id: 'r3', title: 'Tofu-Gemüse-Pfanne', summary: 'Knuspriger Tofu, Erdnusssauce, fertig.', servings: 2, prepTime: 10, cookTime: 15, icon: 'pan', ingredients: [
    ing('Tofu', 400, 'g'), ing('Zucchini', 1, 'Stück'), ing('Champignons', 250, 'g'),
    ing('Reis', 150, 'g'), ing('Sojasauce', 3, 'EL'), ing('Erdnussmus', 1, 'EL'), opt('Sesam', 1, 'EL')],
    steps: ['Tofu würfeln und knusprig braten.', 'Gemüse dazu, ein paar Minuten mitbraten.', 'Sojasauce mit Erdnussmus und etwas Wasser verrühren, drüber, fertig.']},
  {id: 'r4', title: 'Kichererbsen-Curry', summary: 'Aus dem Vorratsschrank, wenn nichts Frisches da ist.', servings: 2, prepTime: 5, cookTime: 15, icon: 'curry', ingredients: [
    ing('Kichererbsen', 1, 'Dose'), ing('Kokosmilch', 1, 'Dose'), ing('Currypaste', 1, 'EL'),
    ing('Zwiebel', 1, 'Stück'), ing('Erbsen', 150, 'g'), ing('Reis', 150, 'g'), opt('Zitrone', .5, 'Stück')],
    steps: ['Zwiebel mit Currypaste anschwitzen.', 'Kichererbsen und Kokosmilch dazu, 10 Minuten köcheln.', 'Erbsen rein, mit Zitrone abschmecken, mit Reis essen.']},

  /* ---- vegan ---- */
  {id: 'start-chili-sin-carne', title: 'Chili sin Carne', summary: 'Bohnen, Mais, ordentlich Kreuzkümmel.', servings: 4, prepTime: 10, cookTime: 30, icon: 'taco', ingredients: [
    ing('Kidneybohnen', 1, 'Dose'), ing('Schwarze Bohnen', 1, 'Dose'), ing('Mais', 1, 'Dose'), ing('Dosentomaten', 2, 'Dose'),
    ing('Paprika', 1, 'Stück'), ing('Zwiebel', 1, 'Stück'), ing('Knoblauch', 2, 'Zehe'), ing('Tomatenmark', 2, 'EL'),
    ing('Kreuzkümmel', 1, 'TL'), ing('Paprikapulver', 1, 'TL'), ing('Reis', 300, 'g'), opt('Koriander', .5, 'Bund'), opt('Limette', 1, 'Stück')],
    steps: ['Reis aufsetzen.', 'Zwiebel, Knoblauch und Paprika würfeln und anbraten.', 'Tomatenmark und Gewürze kurz mitrösten.', 'Tomaten, Bohnen und Mais rein, 25 Minuten köcheln.', 'Abschmecken, mit Reis und Limette essen.']},
  {id: 'start-erdnuss-nudeln', title: 'Erdnuss-Nudeln mit Brokkoli', summary: 'Asia-Nudeln in cremiger Erdnusssauce.', servings: 2, prepTime: 10, cookTime: 10, icon: 'noodles', ingredients: [
    ing('Mie-Nudeln', 250, 'g'), ing('Brokkoli', 1, 'Stück'), ing('Karotte', 1, 'Stück'), ing('Erdnussmus', 3, 'EL'),
    ing('Sojasauce', 3, 'EL'), ing('Knoblauch', 1, 'Zehe'), ing('Ingwer', 10, 'g'), opt('Frühlingszwiebel', .5, 'Bund'), opt('Sesam', 1, 'EL')],
    steps: ['Nudeln kochen, in den letzten 3 Minuten Brokkoli dazu.', 'Erdnussmus, Sojasauce, Knoblauch, Ingwer und etwas Nudelwasser verrühren.', 'Karotte raspeln.', 'Alles mischen, mit Frühlingszwiebel und Sesam drüber.']},
  {id: 'start-ofengemuese', title: 'Ofengemüse mit Hummus', summary: 'Blech rein, fertig.', servings: 2, prepTime: 15, cookTime: 30, icon: 'oven', ingredients: [
    ing('Süßkartoffel', 1, 'Stück'), ing('Paprika', 1, 'Stück'), ing('Zucchini', 1, 'Stück'), ing('Zwiebel', 1, 'Stück'),
    ing('Kichererbsen', 1, 'Dose'), ing('Olivenöl', 3, 'EL'), ing('Paprikapulver', 1, 'TL'), ing('Hummus', null, null), opt('Petersilie', .5, 'Bund')],
    steps: ['Ofen auf 200 °C vorheizen.', 'Gemüse in grobe Stücke schneiden, Kichererbsen abtropfen.', 'Alles mit Öl, Paprika und Salz aufs Blech, 30 Minuten rösten.', 'Mit Hummus und Petersilie servieren.']},
  {id: 'start-kartoffel-lauch-suppe', title: 'Kartoffel-Lauch-Suppe', summary: 'Wärmt, kostet fast nichts.', servings: 4, prepTime: 10, cookTime: 25, icon: 'soup', ingredients: [
    ing('Kartoffel', 600, 'g'), ing('Lauch', 2, 'Stück'), ing('Zwiebel', 1, 'Stück'), ing('Gemüsebrühe', 1, 'EL'),
    ing('Rapsöl', 1, 'EL'), opt('Pflanzensahne', 100, 'ml'), opt('Schnittlauch', .5, 'Bund')],
    steps: ['Zwiebel und Lauch schneiden, in Öl andünsten.', 'Kartoffeln würfeln, mit 1 Liter Wasser und Brühe dazu, 20 Minuten kochen.', 'Pürieren, nach Lust Sahne rein, abschmecken.', 'Schnittlauch drüber.']},
  {id: 'start-couscous-salat', title: 'Couscous-Salat mit Kichererbsen', summary: 'Hält sich zwei Tage, gut fürs Büro.', servings: 2, prepTime: 15, cookTime: 5, icon: 'salad', ingredients: [
    ing('Couscous', 150, 'g'), ing('Kichererbsen', 1, 'Dose'), ing('Gurke', 1, 'Stück'), ing('Tomate', 2, 'Stück'),
    ing('Zitrone', 1, 'Stück'), ing('Olivenöl', 3, 'EL'), opt('Minze', .5, 'Bund'), opt('Granatapfel', .5, 'Stück')],
    steps: ['Couscous mit kochendem Wasser übergießen, 5 Minuten quellen lassen.', 'Gurke und Tomaten würfeln, Kichererbsen abspülen.', 'Mit Zitronensaft, Öl, Salz mischen, Minze und Granatapfel drüber.']},
  {id: 'start-overnight-oats', title: 'Overnight Oats', summary: 'Abends 3 Minuten, morgens fertig.', servings: 1, prepTime: 5, cookTime: 0, restTime: 480, icon: 'breakfast', ingredients: [
    ing('Haferflocken', 50, 'g'), ing('Pflanzendrink', 150, 'ml'), ing('Banane', 1, 'Stück'),
    opt('Beerenmischung', 80, 'g'), opt('Ahornsirup', 1, 'TL'), opt('Chiasamen', 1, 'EL')],
    steps: ['Haferflocken mit Pflanzendrink und zerdrückter Banane verrühren.', 'Über Nacht in den Kühlschrank.', 'Morgens Beeren und Sirup drüber.']},

  /* ---- vegetarisch ---- */
  {id: 'start-shakshuka', title: 'Shakshuka', summary: 'Eier in würziger Tomatensauce.', servings: 2, prepTime: 10, cookTime: 20, icon: 'egg', ingredients: [
    ing('Ei', 4, 'Stück'), ing('Dosentomaten', 1, 'Dose'), ing('Paprika', 1, 'Stück'), ing('Zwiebel', 1, 'Stück'),
    ing('Knoblauch', 2, 'Zehe'), ing('Kreuzkümmel', 1, 'TL'), ing('Paprikapulver', 1, 'TL'), opt('Feta', 100, 'g'), opt('Brot', 1, 'Stück')],
    steps: ['Zwiebel, Paprika, Knoblauch in Öl weich braten, Gewürze kurz mit.', 'Tomaten rein, 10 Minuten einkochen.', 'Mulden machen, Eier reinschlagen, Deckel drauf, 6–8 Minuten stocken lassen.', 'Feta drüberbröseln, mit Brot essen.']},
  {id: 'start-ofen-feta-pasta', title: 'Ofen-Feta-Pasta', summary: 'Der Internet-Klassiker, zu Recht.', servings: 2, prepTime: 5, cookTime: 30, icon: 'pasta', ingredients: [
    ing('Feta', 200, 'g'), ing('Tomate', 400, 'g', 'Kirsch'), ing('Nudeln', 250, 'g'), ing('Knoblauch', 2, 'Zehe'),
    ing('Olivenöl', 3, 'EL'), opt('Basilikum', .5, 'Bund'), opt('Chiliflocken', 1, 'Prise')],
    steps: ['Ofen auf 200 °C.', 'Tomaten und Knoblauch in eine Form, Feta in die Mitte, Öl drüber, 30 Minuten backen.', 'Nebenbei Nudeln kochen.', 'Alles zerdrücken, Nudeln unterheben, Basilikum drauf.']},
  {id: 'start-kartoffel-frittata', title: 'Kartoffel-Frittata', summary: 'Resteverwertung mit Ei.', servings: 2, prepTime: 10, cookTime: 20, icon: 'egg', ingredients: [
    ing('Ei', 5, 'Stück'), ing('Kartoffel', 400, 'g'), ing('Zwiebel', 1, 'Stück'), ing('Paprika', 1, 'Stück'),
    ing('Reibekäse', 50, 'g'), ing('Butter', 10, 'g'), opt('Schnittlauch', .5, 'Bund')],
    steps: ['Kartoffeln in dünnen Scheiben mit Zwiebel und Paprika in Butter 10 Minuten braten.', 'Eier mit Käse, Salz und Pfeffer verquirlen und drübergießen.', 'Deckel drauf, bei kleiner Hitze 10 Minuten stocken lassen.']},
  {id: 'start-pfannkuchen', title: 'Pfannkuchen', summary: 'Süß oder herzhaft, Hauptsache viele.', servings: 2, prepTime: 5, cookTime: 20, restTime: 10, icon: 'pancake', ingredients: [
    ing('Mehl', 200, 'g'), ing('Milch', 400, 'ml'), ing('Ei', 3, 'Stück'), ing('Butter', 20, 'g'),
    opt('Zucker', 1, 'EL'), opt('Apfelmus', 1, 'Glas')],
    steps: ['Mehl, Milch, Eier und eine Prise Salz glatt rühren, 10 Minuten stehen lassen.', 'Butter in der Pfanne heiß werden lassen, dünn Teig rein, von beiden Seiten goldig backen.', 'Mit Zucker oder Apfelmus essen.']},
  {id: 'start-gnocchi-tomate-mozzarella', title: 'Gnocchi mit Tomaten und Mozzarella', summary: 'Aus der Pfanne, überbacken.', servings: 2, prepTime: 5, cookTime: 15, icon: 'oven', ingredients: [
    ing('Gnocchi', 500, 'g'), ing('Passata', 400, 'ml'), ing('Mozzarella', 125, 'g'), ing('Knoblauch', 1, 'Zehe'),
    ing('Olivenöl', 1, 'EL'), opt('Basilikum', .5, 'Bund')],
    steps: ['Gnocchi in Öl goldbraun braten.', 'Knoblauch und Passata dazu, 5 Minuten köcheln.', 'Mozzarella zerzupft drauf, Deckel drauf, schmelzen lassen.', 'Basilikum drüber.']},
  {id: 'start-halloumi-bulgur', title: 'Halloumi mit Bulgur und Gemüse', summary: 'Salzig, knusprig, satt.', servings: 2, prepTime: 10, cookTime: 15, icon: 'bowl', ingredients: [
    ing('Halloumi', 225, 'g'), ing('Bulgur', 150, 'g'), ing('Zucchini', 1, 'Stück'), ing('Tomate', 2, 'Stück'),
    ing('Zitrone', .5, 'Stück'), ing('Olivenöl', 2, 'EL'), opt('Joghurt', 150, 'g'), opt('Minze', .5, 'Bund')],
    steps: ['Bulgur mit doppelter Menge Wasser 10 Minuten quellen lassen.', 'Zucchini in Scheiben anbraten, Tomaten würfeln.', 'Halloumi in Scheiben von beiden Seiten knusprig braten.', 'Alles mit Zitrone und Öl anrichten, Joghurt dazu.']},
  {id: 'start-kartoffelgratin', title: 'Kartoffelgratin', summary: 'Sonntag. Ofen. Käse.', servings: 4, prepTime: 20, cookTime: 50, icon: 'oven', ingredients: [
    ing('Kartoffel', 1000, 'g'), ing('Sahne', 200, 'ml'), ing('Milch', 200, 'ml'), ing('Reibekäse', 100, 'g'),
    ing('Knoblauch', 1, 'Zehe'), ing('Muskat', 1, 'Prise'), ing('Butter', 10, 'g')],
    steps: ['Ofen auf 180 °C, Form mit Butter und Knoblauch ausreiben.', 'Kartoffeln in dünne Scheiben hobeln und einschichten.', 'Sahne, Milch, Salz, Pfeffer, Muskat verrühren und drübergießen.', 'Käse drauf, 50 Minuten backen.']},
  {id: 'start-tiramisu', title: 'Tiramisu', summary: 'Mit rohen Eiern, also nur mit frischen.', servings: 6, prepTime: 25, cookTime: 0, restTime: 240, icon: 'dessert', ingredients: [
    ing('Mascarpone', 500, 'g'), ing('Ei', 3, 'Stück', null, {raw: true}), ing('Zucker', 80, 'g'), ing('Kekse', 200, 'g', 'Löffelbiskuits'),
    ing('Kaffee', 300, 'ml', 'Espresso'), ing('Kakao', 2, 'EL')],
    steps: ['Kaffee kochen und abkühlen lassen.', 'Eigelb mit Zucker schaumig schlagen, Mascarpone unterrühren.', 'Eiweiß steif schlagen und unterheben.', 'Biskuits kurz in Kaffee tunken, abwechselnd mit Creme schichten.', 'Mindestens 4 Stunden kalt stellen, mit Kakao bestäuben.']},

  /* ---- alles ---- */
  {id: 'start-bolognese', title: 'Spaghetti Bolognese', summary: 'Je länger sie köchelt, desto besser.', servings: 4, prepTime: 15, cookTime: 45, icon: 'pasta', ingredients: [
    ing('Hackfleisch', 400, 'g'), ing('Nudeln', 400, 'g'), ing('Passata', 500, 'ml'), ing('Zwiebel', 1, 'Stück'),
    ing('Karotte', 1, 'Stück'), ing('Knoblauch', 2, 'Zehe'), ing('Tomatenmark', 2, 'EL'), ing('Olivenöl', 1, 'EL'), opt('Parmesan', 40, 'g')],
    steps: ['Zwiebel, Karotte und Knoblauch fein würfeln, in Öl anschwitzen.', 'Hack dazu und krümelig braten, Tomatenmark kurz mitrösten.', 'Passata rein, 40 Minuten leise köcheln.', 'Nudeln kochen, mit Parmesan servieren.']},
  {id: 'start-haehnchen-curry', title: 'Hähnchen-Curry', summary: 'Mild, cremig, mit Reis.', servings: 2, prepTime: 10, cookTime: 20, icon: 'curry', ingredients: [
    ing('Hähnchenbrust', 300, 'g'), ing('Kokosmilch', 1, 'Dose'), ing('Currypaste', 1, 'EL'), ing('Paprika', 1, 'Stück'),
    ing('Zwiebel', 1, 'Stück'), ing('Reis', 150, 'g'), opt('Koriander', .5, 'Bund'), opt('Limette', .5, 'Stück')],
    steps: ['Reis aufsetzen.', 'Hähnchen in Stücken scharf anbraten, rausnehmen.', 'Zwiebel und Paprika mit Currypaste anbraten, Kokosmilch rein.', 'Hähnchen zurück, 10 Minuten köcheln, mit Limette und Koriander.']},
  {id: 'start-ofenlachs', title: 'Ofenlachs mit Kartoffeln und Brokkoli', summary: 'Ein Blech, eine halbe Stunde.', servings: 2, prepTime: 10, cookTime: 30, icon: 'oven', ingredients: [
    ing('Lachs', 250, 'g'), ing('Kartoffel', 500, 'g'), ing('Brokkoli', 1, 'Stück'), ing('Zitrone', 1, 'Stück'),
    ing('Olivenöl', 2, 'EL'), opt('Dill', .5, 'Bund')],
    steps: ['Ofen auf 200 °C. Kartoffeln vierteln, mit Öl und Salz 15 Minuten aufs Blech.', 'Brokkoli-Röschen und Lachs dazu, Zitronenscheiben drauf.', 'Weitere 15 Minuten backen, mit Dill bestreuen.']},
  {id: 'start-chili-con-carne', title: 'Chili con Carne', summary: 'Großer Topf, zwei Tage glücklich.', servings: 4, prepTime: 15, cookTime: 40, icon: 'taco', ingredients: [
    ing('Hackfleisch', 500, 'g'), ing('Kidneybohnen', 2, 'Dose'), ing('Mais', 1, 'Dose'), ing('Dosentomaten', 2, 'Dose'),
    ing('Paprika', 1, 'Stück'), ing('Zwiebel', 1, 'Stück'), ing('Knoblauch', 2, 'Zehe'), ing('Kreuzkümmel', 1, 'TL'),
    ing('Chili', 1, 'Stück'), opt('Saure Sahne', 150, 'g'), opt('Brot', 1, 'Stück')],
    steps: ['Hack krümelig anbraten, Zwiebel, Knoblauch, Paprika und Chili dazu.', 'Kreuzkümmel kurz mitrösten.', 'Tomaten, Bohnen und Mais rein, 30 Minuten köcheln.', 'Mit saurer Sahne und Brot essen.']},
  {id: 'start-carbonara', title: 'Spaghetti Carbonara', summary: 'Ohne Sahne. Die Eier stocken nur in der Restwärme.', servings: 2, prepTime: 5, cookTime: 15, icon: 'pasta', ingredients: [
    ing('Nudeln', 250, 'g', 'Spaghetti'), ing('Speck', 120, 'g'), ing('Ei', 3, 'Stück', null, {raw: true}), ing('Parmesan', 60, 'g'), ing('Pfeffer', null, null)],
    steps: ['Nudeln kochen.', 'Speck in Würfeln knusprig auslassen.', 'Eier mit Parmesan und viel Pfeffer verquirlen.', 'Nudeln mit etwas Kochwasser zum Speck, Herd aus, Eiermasse unterrühren bis sie cremig ist.']},
  {id: 'start-bratkartoffeln', title: 'Bratkartoffeln mit Speck und Spiegelei', summary: 'Aus gekochten Kartoffeln von gestern.', servings: 2, prepTime: 10, cookTime: 20, icon: 'potato', ingredients: [
    ing('Kartoffel', 600, 'g'), ing('Speck', 100, 'g'), ing('Zwiebel', 1, 'Stück'), ing('Ei', 2, 'Stück'),
    ing('Butter', 20, 'g'), opt('Gewürzgurken', 1, 'Glas')],
    steps: ['Gekochte Kartoffeln in Scheiben schneiden.', 'Speck auslassen, Kartoffeln in Butter dazu, 15 Minuten ohne viel Rühren knusprig braten.', 'Zwiebel die letzten 5 Minuten mit.', 'Spiegeleier braten, alles zusammen auf den Teller.']},
  {id: 'start-haehnchen-wraps', title: 'Hähnchen-Wraps', summary: 'Jeder rollt sich seinen.', servings: 2, prepTime: 15, cookTime: 10, icon: 'bowl', ingredients: [
    ing('Hähnchenbrust', 250, 'g'), ing('Wraps', 1, 'Packung'), ing('Salatmischung', 100, 'g'), ing('Tomate', 2, 'Stück'),
    ing('Paprikapulver', 1, 'TL'), ing('Joghurt', 150, 'g'), opt('Avocado', 1, 'Stück'), opt('Reibekäse', 50, 'g')],
    steps: ['Hähnchen in Streifen mit Paprika und Salz anbraten.', 'Joghurt mit Salz und etwas Knoblauch verrühren.', 'Wraps kurz in der Pfanne warm machen.', 'Füllen, rollen, essen.']},
  {id: 'start-thunfisch-pasta', title: 'Thunfisch-Pasta', summary: 'Wenn nur noch Dosen da sind.', servings: 2, prepTime: 5, cookTime: 15, icon: 'pasta', ingredients: [
    ing('Nudeln', 250, 'g'), ing('Thunfisch', 1, 'Dose'), ing('Dosentomaten', 1, 'Dose'), ing('Zwiebel', 1, 'Stück'),
    ing('Knoblauch', 1, 'Zehe'), ing('Olivenöl', 1, 'EL'), opt('Kapern', 1, 'EL'), opt('Petersilie', .5, 'Bund')],
    steps: ['Nudeln kochen.', 'Zwiebel und Knoblauch in Öl anschwitzen, Tomaten dazu, 10 Minuten köcheln.', 'Thunfisch und Kapern unterrühren, warm werden lassen.', 'Mit Nudeln und Petersilie mischen.']},
];

export const starterRecipes = () => STARTERS.map(r => normalizeRecipe({...JSON.parse(JSON.stringify(r)), origin: 'starter'}));
export const starterById = id => starterRecipes().find(r => r.id === id) || null;

/* Adds starters this household has not been offered yet (not for "keine Rezeptvorschläge"). Returns how many. */
export function addNewStarters(state) {
  if (!Array.isArray(state.starterIds)) state.starterIds = [];
  if (state.household && state.household.diet === 'none') return 0;
  let n = 0;
  for (const r of starterRecipes()) {
    if (state.starterIds.includes(r.id)) continue;
    state.starterIds.push(r.id);
    if (state.recipes.some(x => x.id === r.id || x.basedOn === r.id)) continue;
    state.recipes.push(r); n++;
  }
  return n;
}
