/* Example data for the first start ("Beispieldaten"). */
import {DAY, now} from './clock.js';
import {uid} from './text.js';
import {catalogFor} from './catalog.js';
import {SCHEMA} from './migrate.js';
import {starterRecipes} from './starter-recipes.js';

/* Starter recipes live in starter-recipes.js; kept under this name for older callers. */
export const seedRecipes = starterRecipes;

export function seed() {
  const t = now(), ago = d => t - d * DAY;
  /* o.days: bought that many days ago; o.seenDays: last confirmed that many days ago */
  const it = (name, o = {}) => {
    const c = catalogFor(name) || {};
    const {days, seenDays, ...rest} = o;
    const area = rest.area || c.area || 'pantry';
    const item = {
      id: uid(), ingredient: c.name || name, variety: null, label: null, area, tracking: c.tracking || 'exact',
      amount: 1, unit: c.unit || 'Stück', level: 1, boughtAt: t, seenAt: t, shelfDays: null, profile: null,
      bestBefore: null, openedAt: null, confirmedAt: null, frozenAt: null, probablyGoneAt: null, source: 'manual',
      ...rest, ...(days != null ? {boughtAt: ago(days), seenAt: ago(seenDays ?? days)} : {}),
    };
    if (area === 'freezer') item.frozenAt = item.boughtAt;
    return item;
  };
  return {
    schema: SCHEMA,
    demo: true,
    items: [
      it('Pflanzendrink', {variety: 'Hafer', amount: 1000, days: 5, area: 'fridge', openedAt: t - 2 * DAY}), it('Tofu', {label: 'Tofu natur', amount: 400, days: 8}), it('Tofu', {amount: 200, days: 1}),
      it('Spinat', {amount: 200, days: 3}), it('Zucchini', {amount: 2, days: 6}), it('Champignons', {amount: 250, days: 14}),
      it('Zitrone', {amount: 1, days: 9}), it('Hummus', {days: 9}), it('Currypaste', {level: .25, days: 40, seenDays: 5}),
      it('Nudeln', {label: 'Spaghetti', amount: 500, days: 20, seenDays: 4}), it('Reis', {amount: 800, days: 30, seenDays: 6}),
      it('Linsen', {variety: 'rot', amount: 300, days: 45, seenDays: 10}), it('Dosentomaten', {amount: 2, days: 25, seenDays: 8}),
      it('Kokosmilch', {amount: 1, days: 25, seenDays: 8}), it('Kichererbsen', {amount: 1, days: 60, seenDays: 58}), it('Zwiebel', {amount: 3, days: 10}),
      it('Knoblauch', {amount: 6, days: 12}), it('Olivenöl', {level: .5, days: 30, seenDays: 3}), it('Salz', {level: 1, days: 90, seenDays: 3}),
      it('Pfeffer', {level: .75, days: 90, seenDays: 3}), it('Erdnussmus', {level: .5, days: 20, seenDays: 6}), it('Chips', {days: 9}),
      it('Erbsen', {amount: 450, days: 30, seenDays: 20}),
    ],
    recipes: seedRecipes(),
    starterIds: seedRecipes().map(r => r.id),
    shopping: [{id: uid(), name: 'Bananen', amount: null, unit: null, done: false}],
    aliases: {},
    catalogOverrides: {},
    household: {diet: 'vegan', onboarded: true},
    settings: defaultSettings(),
  };
}

export const defaultSettings = () => ({hintSoon: true, hintCheck: true, trackSnacks: false, installHintDismissed: false});

/* withRecipes: false when the household wants no suggested recipes. onboarded: false shows the first-start screens. */
export const emptyState = ({withRecipes = true, onboarded = true, diet = null} = {}) => ({schema: SCHEMA, demo: false, items: [], recipes: withRecipes ? seedRecipes() : [], starterIds: withRecipes ? seedRecipes().map(r => r.id) : [],
  shopping: [], aliases: {}, catalogOverrides: {}, household: {diet, onboarded}, settings: defaultSettings()});
