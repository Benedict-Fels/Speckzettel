/* The only place that touches localStorage. A later sync (Supabase) replaces load()/save(). */
import {migrate, schemaOf, looksLikeState, SCHEMA} from './migrate.js';
import {emptyState} from './seed.js';
import {APP_VERSION} from './version.js';

const STORE = 'speckzettel.v1';          /* key name kept from 1.0.0; the format version lives in state.schema */
const OLD_STORE = 'kuechenvorrat.v1';    /* working title until 9.10.2026 */
const BACKUP = 'speckzettel.backup.';    /* + old schema number, written once before upgrading */

export function load() {
  try {
    const raw = localStorage.getItem(STORE) ?? localStorage.getItem(OLD_STORE);
    const s = JSON.parse(raw);
    if (looksLikeState(s)) {
      const v = schemaOf(s);
      if (v < SCHEMA) {
        try { if (localStorage.getItem(BACKUP + v) == null) localStorage.setItem(BACKUP + v, raw); } catch (e) {}
        const up = migrate(s);
        save(up);
        return up;
      }
      return migrate(s);
    }
  } catch (e) {}
  return emptyState({onboarded: false});   /* first start */
}

export function save(state) {
  try { localStorage.setItem(STORE, JSON.stringify(state)); return true; } catch (e) { return false; }
}

/* Backup file content. */
export const backupJson = state => JSON.stringify({app: 'speckzettel', format: SCHEMA, appVersion: APP_VERSION, exported: new Date().toISOString(), state}, null, 2);

/* Reads a backup file (any older format). Returns {state, when} or throws. */
export function parseBackup(text) {
  const d = JSON.parse(text);
  const s = d && d.state ? d.state : d;
  if (!looksLikeState(s)) throw new Error('format');
  return {state: migrate(s), when: d.exported || null};
}
