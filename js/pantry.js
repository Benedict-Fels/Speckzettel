/* Pantry logic: one entry per pack, clocks (spec 7.0–7.3), "vermutlich weg", adding stock. */
import {now, startOfDay, daysBetween, addDays} from './clock.js';
import {uid} from './text.js';
import {key, catalogFor} from './catalog.js';

const DEFAULT_SHELF = 14;
const PURGE_AFTER = 14;       /* days in "vermutlich weg" before the entry is deleted */
const SOON = 2, SOON_USE_BY = 1;
const UNSURE_AFTER = 14;      /* "nur da" items: days without confirmation before "schau lieber nach" */
export const OVER_IN_BOX = 3; /* "drüber" counts as "bald verbrauchen" for this many days */

export const itemLabel = i => i.label || (i.variety ? `${i.ingredient} (${i.variety})` : i.ingredient);

/* Effective rules of a pack: catalog defaults overlaid with what was set on the pack. */
export function rulesFor(i) {
  const c = catalogFor(i.ingredient) || {};
  const baseProfile = i.profile || c.profile || 'perishable';
  const openedDays = i.openedDays ?? c.openedDays ?? null;
  let profile = baseProfile;
  if (i.area === 'freezer') profile = 'frozen';
  else if (baseProfile === 'stable' && i.openedAt && openedDays) profile = 'perishable';
  return {profile, baseProfile, openedDays, shelfDays: i.shelfDays ?? c.shelfDays ?? DEFAULT_SHELF, graceDays: i.graceDays ?? c.graceDays ?? null, useBy: !!(i.useBy ?? c.useBy)};
}

/* Expiry day and grace period of a perishable pack. */
export function expiryOf(i, r = rulesFor(i)) {
  let closed = null;
  if (i.bestBefore) closed = startOfDay(i.bestBefore);
  else if (r.baseProfile === 'perishable') closed = addDays(startOfDay(i.boughtAt), r.shelfDays);
  const opened = i.openedAt && r.openedDays ? addDays(startOfDay(i.openedAt), r.openedDays) : null;
  if (opened != null && (closed == null || opened < closed)) return {expiry: opened, grace: r.useBy ? 0 : r.openedDays, opened: true};
  if (closed == null) return null;
  return {expiry: closed, grace: r.useBy ? 0 : (r.graceDays ?? r.shelfDays), opened: false};
}

/* Status of one pack.
   phase: ok | soon | over | gone | unsure | low | frozen
   plus daysLeft (perishable), overDays, confirmed, goneSince (day). */
export function packStatus(i, t = now()) {
  const today = startOfDay(t);
  const r = rulesFor(i);
  const low = i.tracking === 'rough' && i.level <= .25;
  if (i.probablyGoneAt) return {phase: 'gone', goneSince: startOfDay(i.probablyGoneAt), profile: r.profile};
  if (r.profile === 'frozen') return {phase: 'frozen', profile: 'frozen', frozenDays: daysBetween(i.frozenAt || i.boughtAt, t)};
  if (r.profile === 'stable') return {phase: low ? 'low' : 'ok', profile: 'stable'};
  const e = expiryOf(i, r);
  const daysLeft = daysBetween(today, e.expiry);
  const base = {profile: 'perishable', daysLeft, expiry: e.expiry, useBy: r.useBy, opened: e.opened};
  if (i.confirmedAt) {
    const conf = startOfDay(i.confirmedAt), g = Math.max(e.grace, 1);
    if (daysBetween(conf, today) > g) return {...base, phase: 'gone', goneSince: addDays(conf, g + 1)};
  } else if (-daysLeft > e.grace) return {...base, phase: 'gone', goneSince: addDays(e.expiry, e.grace + 1)};
  if (daysLeft < 0) return {...base, phase: 'over', overDays: -daysLeft, confirmed: !!i.confirmedAt};
  if (daysLeft <= (r.useBy ? SOON_USE_BY : SOON)) return {...base, phase: 'soon'};
  if (i.tracking === 'flag' && daysBetween(i.seenAt, t) >= UNSURE_AFTER) return {...base, phase: 'unsure'};
  if (low) return {...base, phase: 'low'};
  return {...base, phase: 'ok'};
}

export const isGone = (i, t) => packStatus(i, t).phase === 'gone';
export const inSoonBox = s => s.phase === 'soon' || (s.phase === 'over' && !s.confirmed && s.overDays <= OVER_IN_BOX);
export const inCheckBox = s => s.phase === 'unsure' || s.phase === 'low';
/* For the recipe check: stock that should be looked at before cooking. */
/* "Noch da" on a pack past its date counts as checked ("drüber – laut dir noch gut"). */
export const isShaky = i => { const s = packStatus(i); return s.phase === 'unsure' || (s.phase === 'over' && !s.confirmed); };

/* Deletes packs that have been in "vermutlich weg" for PURGE_AFTER days. Returns how many. */
export function purgeGone(state, t = now()) {
  const before = state.items.length;
  state.items = state.items.filter(i => { const s = packStatus(i, t); return !(s.phase === 'gone' && daysBetween(s.goneSince, t) >= PURGE_AFTER); });
  return before - state.items.length;
}
export const purgeDate = s => addDays(s.goneSince, PURGE_AFTER);

/* Packs of an ingredient that count as "im Haus" (not in "vermutlich weg"). */
export function stockFor(items, name) {
  const k = key(name);
  return items.filter(i => (key(i.ingredient) === k || (i.label && key(i.label) === k)) && !isGone(i));
}

/* Pantry list rows: packs of the same ingredient in the same area are shown together. */
export function groupItems(items) {
  const map = new Map();
  for (const i of items) {
    if (isGone(i)) continue;
    const k = `${i.area}|${key(i.ingredient)}`;
    if (!map.has(k)) map.set(k, {key: k, area: i.area, ingredient: i.ingredient, items: []});
    map.get(k).items.push(i);
  }
  for (const g of map.values()) {
    const labels = [...new Set(g.items.map(itemLabel))];
    g.name = labels.length === 1 ? labels[0] : g.ingredient;
    g.items.sort((a, b) => a.boughtAt - b.boughtAt);
  }
  return [...map.values()];
}

/* Adds stock. Exact amounts: always a new pack. Rough / "nur da": the existing entry is refilled. */
export function addItem(state, d) {
  const c = catalogFor(d.name) || {};
  const ingredient = c.name || d.name;
  const tracking = d.tracking || c.tracking || 'exact';
  const unit = d.unit || c.unit || 'Stück';
  const area = d.area || c.area || 'pantry';
  const t = now();
  const same = state.items.filter(i => key(i.ingredient) === key(ingredient));
  if (tracking !== 'exact') {
    const ex = same.find(i => i.tracking === tracking && !isGone(i, t));
    if (ex) {
      Object.assign(ex, {level: 1, boughtAt: t, seenAt: t, openedAt: null, confirmedAt: null, bestBefore: null});
      return ex;
    }
  } else {
    /* bought again: an older pack that is past its date is probably gone */
    for (const i of same) if (i.tracking === 'exact' && packStatus(i, t).phase === 'over') i.probablyGoneAt = t;
  }
  const it = {
    id: uid(), ingredient, variety: d.variety ?? null, label: d.name !== ingredient ? d.name : null,
    area, tracking, amount: tracking === 'exact' ? (+d.amount || c.pack || 1) : 1, unit, level: 1,
    boughtAt: t, seenAt: t, shelfDays: d.shelfDays ? +d.shelfDays : null, profile: d.profile || null,
    bestBefore: null, openedAt: null, confirmedAt: null, frozenAt: area === 'freezer' ? t : null, probablyGoneAt: null,
    source: d.source || 'manual',
  };
  state.items.push(it);
  return it;
}

export function removeItem(state, item) { state.items = state.items.filter(x => x !== item); }

/* Moves a pack to another area. Freezing stops the clock; thawing restarts it from today. */
export function setArea(i, area, t = now()) {
  if (area === i.area) return;
  if (area === 'freezer') i.frozenAt = t;
  else if (i.area === 'freezer') { i.frozenAt = null; i.boughtAt = t; i.openedAt = t; i.bestBefore = null; }
  i.area = area;
}

/* "Noch da" for a pack in "vermutlich weg" or past its date. */
export function confirmStillThere(i, t = now()) { i.probablyGoneAt = null; i.confirmedAt = t; i.seenAt = t; }
export function markSeen(i, t = now()) { i.seenAt = t; }

export function levelText(l) { return l >= .9 ? 'voll' : l >= .5 ? 'halb voll' : l > .25 ? 'gut ein Drittel' : l > 0 ? 'fast leer' : 'leer'; }
