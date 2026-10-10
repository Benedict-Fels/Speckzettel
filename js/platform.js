/* Install prompt, persistent storage, service worker updates. */
import {app, $} from './app.js';
import {render, toast} from './render.js';

export async function askPersist() {
  try {
    if (navigator.storage && navigator.storage.persisted) {
      app.env.persisted = await navigator.storage.persisted();
      if (!app.env.persisted && navigator.storage.persist) app.env.persisted = await navigator.storage.persist();
    }
  } catch (e) {}
  if (app.ui.tab === 'pantry') render();
}

export function watchInstall() {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); app.env.installEvent = e; if (app.ui.tab === 'pantry') render(); });
  window.addEventListener('appinstalled', () => { app.env.installEvent = null; app.env.standalone = true; render(); toast('Installiert. Speckzettel liegt jetzt bei deinen Apps.'); });
}

const showUpdate = () => { $('#update').hidden = false; };

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    app.env.registration = reg;
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate();
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(); });
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (refreshing) return; refreshing = true; location.reload(); });
}

export function applyUpdate() {
  const w = app.env.registration && app.env.registration.waiting;
  if (w) w.postMessage({type: 'SKIP_WAITING'}); else location.reload();
}
