/* Speckzettel start: load catalog and data, wire events, draw. */
import {app, $} from './app.js';
import {load, save} from './store.js';
import {setCatalog, setOverrides} from './catalog.js';
import {purgeGone} from './pantry.js';
import {render} from './render.js';
import {bindEvents} from './actions.js';
import {askPersist, watchInstall, registerServiceWorker} from './platform.js';

async function start() {
  try {
    const res = await fetch('data/catalog.json');
    setCatalog(await res.json());
  } catch (e) {
    $('#app').innerHTML = '<div class="panel empty">Der Produktkatalog konnte nicht geladen werden. Bitte die Seite neu laden.</div>';
    return;
  }
  app.state = load();
  setOverrides(app.state.catalogOverrides);
  const tidy = () => { if (purgeGone(app.state)) save(app.state); };
  tidy();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { tidy(); render(); } });
  watchInstall();
  registerServiceWorker();
  bindEvents();
  render();
  askPersist();
}
start();
