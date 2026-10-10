/* Recipe symbols (spec 8.4): a fixed set of keys, drawn as emoji for now. The key is what is stored,
   so the drawing can later be swapped for own artwork without touching the data. */
export const RECIPE_ICONS = {
  pasta: ['🍝', 'Pasta'], rice: ['🍚', 'Reis'], curry: ['🍛', 'Curry'], pan: ['🥘', 'Pfanne'],
  potato: ['🥔', 'Kartoffeln'], pizza: ['🍕', 'Pizza'], sandwich: ['🥪', 'Brot'], dumpling: ['🥟', 'Teigtaschen'],
  breakfast: ['🥣', 'Frühstück'], pancake: ['🥞', 'Pfannkuchen'], dessert: ['🍮', 'Dessert'], drink: ['🥤', 'Getränk'],
  salad: ['🥗', 'Salat'], soup: ['🍜', 'Suppe'], stew: ['🍲', 'Eintopf'], oven: ['🫕', 'Auflauf'],
  bowl: ['🥙', 'Bowl/Wrap'], burger: ['🍔', 'Burger'], taco: ['🌮', 'Tacos'], noodles: ['🥢', 'Asia-Nudeln'],
  egg: ['🍳', 'Ei'], cake: ['🍰', 'Kuchen'], snack: ['🥨', 'Snack'], veggie: ['🥦', 'Gemüse'],
};
export const DEFAULT_ICON = 'veggie';
export const iconOf = key => (RECIPE_ICONS[key] || RECIPE_ICONS[DEFAULT_ICON])[0];

/* Title words first (most telling), then ingredients. Order matters: the first rule that matches wins. */
const TITLE_RULES = [
  [/tiramisu|mousse|pudding|panna cotta|creme|crème|zabaione|eis\b|dessert|kompott/, 'dessert'],
  [/kuchen|torte|muffin|brownie|kekse|cookies|plätzchen|bananenbrot/, 'cake'],
  [/pfannkuchen|pancake|crêpe|crepe|waffel|kaiserschmarrn/, 'pancake'],
  [/smoothie|shake|limonade|latte|punsch/, 'drink'],
  [/müsli|granola|porridge|overnight|frühstück|haferbrei/, 'breakfast'],
  [/omelett|rührei|spiegelei|frittata|shakshuka|eier\b/, 'egg'],
  [/pizza|flammkuchen/, 'pizza'],
  [/burger/, 'burger'],
  [/taco|burrito|enchilada|quesadilla|nachos|chili/, 'taco'],
  [/wrap|bowl|falafel|döner|gyros/, 'bowl'],
  [/sandwich|toast|stulle|bruschetta|brot\b|bagel/, 'sandwich'],
  [/maultasche|ravioli|tortellini|gyoza|dumpling|teigtasche|pierogi|knödel/, 'dumpling'],
  [/ramen|pho|udon|soba|mie|glasnudel|reisnudel|pad thai|asia-nudel|asianudel/, 'noodles'],
  [/suppe|brühe|soup/, 'soup'],
  [/eintopf|gulasch|ragout|stew|schmor/, 'stew'],
  [/curry|dal\b|dhal|daal|masala|korma/, 'curry'],
  [/auflauf|gratin|lasagne|moussaka|ofen|blech/, 'oven'],
  [/salat/, 'salad'],
  [/spaghetti|pasta|nudel|penne|fusilli|tagliatelle|gnocchi|risotto alla|carbonara|bolognese/, 'pasta'],
  [/risotto|paella|reis|pilaw|bibimbap|sushi/, 'rice'],
  [/kartoffel|pommes|rösti|püree|wedges/, 'potato'],
  [/pfanne|stir|wok|geschnetzeltes|gebraten/, 'pan'],
  [/snack|dip|hummus|aufstrich|chips|cracker/, 'snack'],
];
const INGREDIENT_RULES = [
  [n => n.includes('nudeln') || n.includes('spaghetti'), 'pasta'],
  [n => n.includes('kokosmilch') && (n.includes('currypaste') || n.includes('curry')), 'curry'],
  [n => n.includes('kartoffel'), 'potato'],
  [n => n.includes('reis'), 'rice'],
  [n => n.includes('tofu') || n.includes('tempeh'), 'pan'],
];

/* Proposes a symbol from the title and the ingredient names. */
export function suggestIcon(title, ingredientNames = []) {
  const t = (title || '').toLowerCase();
  for (const [re, k] of TITLE_RULES) if (re.test(t)) return k;
  const names = ingredientNames.map(n => (n || '').toLowerCase()).join(' | ');
  for (const [fn, k] of INGREDIENT_RULES) if (fn(names)) return k;
  return DEFAULT_ICON;
}
