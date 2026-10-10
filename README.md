# Speckzettel

Vorrat, Einkaufszettel und Rezepte in einer App, gefüttert mit deinen Kassenbons. Das hier ist die installierbare Web-App (PWA): eine Webseite, die sich auf dem Handy wie eine App installieren lässt und auch offline läuft.

## Was in dem Ordner steckt

| Datei / Ordner | Wofür |
|---|---|
| `index.html` | Gerüst der Seite, lädt Styles und `js/main.js` |
| `css/app.css` | Aussehen (Farben, Abstände, hell/dunkel) |
| `js/` | Logik der App, ohne Oberfläche: Vorrat (`pantry.js`), Rezepte (`recipes.js` Abgleich/Filter/Kochen, `recipe-model.js` Datenmodell, `recipe-edit.js` Formular, `recipe-icons.js` Symbole, `recipe-text.js` Text lesen, `starter-recipes.js` mitgelieferte Rezepte), Einkaufszettel (`shopping.js`), Bon-Auswertung (`receipt/`: `pdf.js` liest eBon-PDFs, `lines.js` setzt Zeilen zusammen, `templates.js` Ketten, `pipeline.js` Zeilen einordnen, Artikel, Rechenproben, Zutaten, `history.js` eingelesene Bons), Einheiten, Katalog, Speichern (`store.js`) und Umzug alter Daten (`migrate.js`) |
| `js/views/` | Oberfläche der vier Bereiche Vorrat, Kochen, Einkauf, Bon, dazu Detail-Blatt, Einstellungen und erster Start |
| `js/version.js` | Versionsnummer der App |
| `data/catalog.json` | Produktkatalog: Warengruppe, Bereich, Einheit, Haltbarkeit, Kulanz, Ernährung, Umrechnung, andere Namen, Bon-Regeln. Wird aus `tools/build_catalog.py` im Projektordner erzeugt (nicht von Hand ändern) |
| `tests/` | Selbsttest der Logik (siehe unten), wird nicht offline gespeichert |
| `manifest.json` | Steckbrief für die Installation: Name, Farben, Icons |
| `sw.js` | Service Worker: legt die App-Dateien auf dem Handy ab, damit sie offline startet |
| `vendor/pdfjs/` | pdf.js von Mozilla (Apache-Lizenz 2.0) zum Auslesen von eBon-PDFs, wird erst geladen, wenn man ein PDF wählt |
| `icons/` | App-Icon in allen nötigen Größen (`icon.svg` ist das Original) |
| `fonts/` | Die drei Schriften lokal, inkl. Lizenzen (SIL Open Font License) |

Namen von Dateien, Ordnern und im Code sind englisch, alles was man in der App liest ist deutsch.

Alle Daten (Vorrat, Rezepte, Einkaufszettel) bleiben auf dem jeweiligen Gerät. Unter **Vorrat → Daten** kann man eine Sicherung als Datei speichern und wieder laden.

## Lokal ausprobieren

Doppelklick auf `index.html` reicht nicht (seit Version 1.1 zeigt die Seite dann nur einen Hinweis): Die App braucht eine echte Webadresse. Für einen Test am Rechner im Ordner ein Terminal öffnen und

```
python3 -m http.server 8000
```

starten (unter Windows heißt der Befehl oft `python` oder `py` statt `python3`), dann im Browser `http://localhost:8000` öffnen (localhost zählt als sichere Adresse).

## Selbsttest

Bei laufendem Server `http://localhost:8000/tests/run.html` öffnen. Die Seite prüft die Logik (Umzug alter Daten, echter Netto-eBon (anonymisiert, `tests/receipts/`), Zutaten- und Rezepttext lesen, Bon-Auswertung, Packungen und Haltbarkeit, „Vermutlich weg“, Katalog und Umrechnung, Rezept-Abgleich mit optional/roh, Filter, Gekocht-Vorschau, Rezept bearbeiten, Einkaufszettel) und zeigt „63 von 63 Tests bestanden“. Wer Node.js installiert hat, kann stattdessen `node tests/run.mjs` ausführen.

## Online stellen mit GitHub Pages (kostenlos)

1. Auf github.com ein Konto anlegen (falls noch nicht vorhanden).
2. Neues Repository anlegen, z. B. `speckzettel`. Sichtbarkeit **Public** (GitHub Pages ist im Gratis-Tarif nur für öffentliche Repositories verfügbar).
3. Im Repository **Add file → Upload files** und den **Inhalt** dieses Ordners hineinziehen (also `index.html`, `manifest.json`, `sw.js`, `css/`, `js/`, `data/`, `icons/`, `fonts/`, `tests/` direkt in die oberste Ebene, nicht den Ordner `app` selbst). Mit **Commit changes** bestätigen.
4. **Settings → Pages**: bei *Source* „Deploy from a branch“, Branch `main`, Ordner `/ (root)`, speichern.
5. Nach ein bis zwei Minuten erscheint dort die Adresse, z. B. `https://DEIN-NAME.github.io/speckzettel/`.

Hinweis: Öffentliches Repository heißt, dass jeder den Code sehen kann. Persönliche Daten stehen darin keine, die liegen nur auf den Handys.

## Auf dem Handy installieren

- **iPhone (Safari):** Adresse öffnen → unten **Teilen** → **„Zum Home-Bildschirm“**.
- **Android (Chrome):** Adresse öffnen → Hinweis „App installieren“ antippen oder Menü **⋮ → „App installieren“**.

Danach Speckzettel immer über das Icon öffnen.

## Neue Version veröffentlichen

1. Änderungen an den Dateien machen.
2. In `sw.js` die Zeile `const VERSION = 'speckzettel-2.3.1';` hochzählen (z. B. `2.3.2`) und in `js/version.js` `APP_VERSION` genauso.
3. Geänderte Dateien bei GitHub hochladen.

Beim nächsten Öffnen erscheint in der App oben **„Neue Version da – Neu laden“**. Ohne das Hochzählen in `sw.js` bekommen die Handys die neue Version nicht mit.

Wenn neue Dateien dazukommen (z. B. ein weiteres Modul in `js/`), müssen sie auch in die Liste `FILES` in `sw.js`, sonst fehlen sie offline.

## Daten und Versionen

Die Daten tragen eine Formatnummer (`schema`). Öffnet eine neuere App-Version ältere Daten, zieht sie sie automatisch um und legt vorher eine Kopie im Browser ab (`speckzettel.backup.1` usw.). Sicherungsdateien aus älteren Versionen lassen sich weiterhin laden.

| App-Version | Datenformat | Änderung |
|---|---|---|
| 1.0.0 | 1 | erste installierbare Version |
| 1.1.0 | 2 | Code in Module aufgeteilt, Katalog als eigene Datei, englische Feldnamen, „Stk“ heißt „Stück“ |
| 1.2.0 | 3 | Eine Packung pro Kauf, Haltbarkeit mit Kulanz, „Vermutlich weg“, Detail-Blatt, Hinzufügen über ein Feld, „Rückgängig“ |
| 1.3.0 | 4 | Katalog mit 262 Zutaten, erster Start, Einstellungen, Grundausstattung, Snacks/Getränke auf dem Bon ausgegraut; einige Zutaten umbenannt (Zwiebeln → Zwiebel, Rote Linsen → Linsen (rot), Gehackte Tomaten → Dosentomaten, Haferdrink → Pflanzendrink (Hafer)) |
| 1.4.0 | 5 | Rezepte: Symbol, Zeiten, Kurzbeschreibung, Ernährung, Quelle, „zuletzt gekocht“; Zutaten „optional“ und „roh“; Bearbeiten (auch mitgelieferte); Gekocht-Vorschau; Filter und Suche. Mitgelieferte Rezepte werden auf den neuen Stand gebracht |
| 1.4.1 | 5 | 26 Startrezepte (10 vegan, 8 vegetarisch, 8 mit Fleisch/Fisch), neue kommen bei bestehenden Daten dazu (`starterIds` merkt sich gelöschte); Schnellkorrektur „Ist da / Weg“ bzw. „Reicht noch / Leer“ in der Rezeptzeile; optionale Zutaten einzeln auf den Zettel |
| 1.5.0 | 6 | Einkaufszettel: Einträge sind Zutat oder Freitext, Gruppen im Ladenrundgang, „für Dal“, Zusammenführen mit Umrechnung, Packungshinweis, Erledigte eingeklappt, Kopieren/Teilen, Prüfliste vor „In den Vorrat“, Bon hakt passende Einträge ab |
| 2.0.0 | 6 | Bon: eBon-PDF direkt einlesen (pdf.js), Ketten erkennen (Netto, REWE, …), Zeilen einordnen, Mengenzeilen per Rechnung zuordnen, Rabatt/Pfand, Rechenproben (Zeile, Summe, Anzahl), neue Prüfansicht als Bon, „immer ignorieren“, gelernt pro Kette, Bons werden gemerkt (ohne Filiale/Payback), doppelte erkannt, Bon-Statistik in den Einstellungen, KI-Auftrag mit Preis und Summe |
| 2.0.1 | 6 | Rezept → Einkaufszettel: Auswahl per Haken direkt in der Zutatenliste statt eigener Liste darunter |
| 2.1.0 | 7 | Eigene Symbole für ~190 Zutaten; Öl ist eine Zutat mit Sorte (Oliven, Raps, Sonnenblumen), andere Sorte wird im Rezept als „Ersatz“ angeboten; Zucchini, Aubergine, Kürbis nach Gewicht; Einkaufszettel: Menge direkt nach dem Namen (antippen: 50-g-Schritte), Mehrzahl, Sorte, Rezept-Symbole statt „für …“, Erledigt offen; Flaschengröße beim Übernehmen; hell/dunkel in den Einstellungen |
| 2.2.0 | 7 | Rezepttext: Menge und Zutat auf getrennten Zeilen (kopierte Webseiten), Knöpfe wie „Portion abziehen“ ignoriert, Menge hinten („Tomaten 200g“), „Zwiebel, rot“, kleine Tippfehler, „Salz & Pfeffer“; „roh“ nur bei Eiern; Sorte nur bei manchen Zutaten streng (Öl, Linsen, Reis …); Einkaufszettel mit Vorschlägen beim Tippen; lose Ware: Stück → Gewicht, „≈ 3“ |
| 2.3.0 | 8 | Rezept-Formular mit festen Feldern (Zutat mit Vorschlägen, Menge, Einheit, Sorte) und Schnellzeile; Sorte nur noch bei Öl, Linsen, Reis, Tofu, Pesto, Saurer Sahne, Frischer Pasta streng, bei Joghurt nur Frucht; Pflanzendrink zählt als Milch, Pflanzensahne als Sahne, Pflanzenjoghurt als Joghurt (nicht umgekehrt); Einkaufszettel: lose Ware in Stück, Verpacktes in 50-g-Schritten |
| 2.3.1 | 8 | Öl und Tofu: Sorte nur Beschreibung; Fruchtjoghurt mit einzelnen Früchten; Paprikapulver rosenscharf streng; Einkaufszettel zeigt, was noch im Vorrat/Kühlschrank/Tiefkühler ist |

## Bevor andere Leute die Adresse bekommen

Für den Test mit Kollegen ist das okay. Sobald die Adresse öffentlich geteilt wird, gehören eine Datenschutzerklärung und in der Regel ein Impressum dazu (eigene kleine Seiten, z. B. per Generator erstellt). Da die App keine Daten an einen Server schickt, fällt die Datenschutzerklärung kurz aus.
