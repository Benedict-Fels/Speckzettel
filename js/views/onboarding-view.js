/* First start: welcome, diet, how to begin. Every screen can be skipped. */
import {app} from '../app.js';
import {DIETS} from './settings-view.js';

export function renderOnboarding() {
  const step = app.ui.onboardingStep || 0;
  const skip = `<button class="btn ghost small" data-act="onboardingSkip">Überspringen</button>`;
  let body;
  if (step === 0) body = `<img src="icons/icon.svg" alt="" width="96" height="96" class="onb-icon">
    <h1>Speckzettel</h1><p class="lead">Bon rein, Vorrat da, Rezept raus.</p>
    <p class="muted">Die App merkt sich, was im Haus ist, sagt dir, was bald weg muss, und was du damit kochen kannst. Ohne Konto, alles bleibt auf deinem Gerät.</p>
    <div class="row"><button class="btn primary" data-act="onboardingNext">Los</button></div>`;
  else if (step === 1) body = `<h2>Ich esse …</h2>
    <div class="choice">${Object.entries(DIETS).map(([k, l]) => `<button class="btn" data-act="onboardingDiet" data-v="${k}">${l}</button>`).join('')}</div>
    <p class="muted small" id="vegan-wink">Bei vegan: keine Sorge, nur der Name ist aus Speck.</p>
    <p class="muted small">Lässt sich später in den Einstellungen ändern.</p>`;
  else body = `<h2>Wie willst du anfangen?</h2>
    <div class="choice">
      <button class="btn primary" data-act="onboardingStart" data-v="receipt">Letzten Bon einlesen</button>
      <button class="btn" data-act="onboardingStart" data-v="demo">Mit Beispieldaten umschauen</button>
      <button class="btn" data-act="onboardingStart" data-v="empty">Leer starten</button>
    </div>`;
  return `<div class="onboarding" role="dialog" aria-modal="true" aria-label="Erster Start"><div class="onb-card">
    <div class="spread"><span class="muted small">${step + 1} von 3</span>${skip}</div>${body}</div></div>`;
}
