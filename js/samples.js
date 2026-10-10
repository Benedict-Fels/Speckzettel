/* Texts for the "Bon" tab and example inputs. */
export const AI_PROMPT = `Lies den Kassenbon auf dem Foto aus. Antworte NUR mit einer Zeile pro Artikel und am Ende der Summe, ohne weiteren Text, in genau diesem Format:
Bon-Text | Zutat | Sorte | Menge | Einheit | Bereich | Preis
SUMME | Gesamtbetrag

Regeln:
- Bon-Text: genau wie auf dem Bon
- Zutat: Grundform im Singular, wie man sie im Supermarkt sagt (z. B. Pflanzendrink, Tofu, Nudeln, Zwiebel, Joghurt)
- Sorte: nur wenn wichtig (z. B. Hafer, griechisch, geräuchert), sonst leer lassen
- Menge: Packungsgröße mal Anzahl, als Zahl
- Einheit: g, ml, Stück, Dose oder Glas
- Bereich: Kühlschrank, Vorrat oder Tiefkühler
- Preis: Zeilenpreis nach Rabatt, mit Komma
- Pfand als eigene Zeile mit Zutat „Pfand“, Zahlungs- und Steuerzeilen weglassen
- SUMME: der Betrag, der auf dem Bon als Summe steht

Beispiel:
BIO HAFERDR.UNG 1L | Pflanzendrink | Hafer | 1000 | ml | Vorrat | 1,49
SUMME | 1,49`;

export const SAMPLE_AI = `BIO HAFERDR.UNG 1L | Pflanzendrink | Hafer | 1000 | ml | Vorrat | 1,49
TOFU NAT. 400G | Tofu | | 400 | g | Kühlschrank | 2,29
BLATTSPIN. 200G | Spinat | | 200 | g | Kühlschrank | 1,79
SOJASAUCE 150ML | Sojasauce | | 150 | ml | Vorrat | 2,19
SPAGHETTI 500G | Nudeln | Spaghetti | 500 | g | Vorrat | 0,99
SPEISEZWIEB. 1KG | Zwiebel | | 7 | Stück | Vorrat | 1,29
ERDBEEREN 500G | Erdbeeren | | 500 | g | Kühlschrank | 2,99
SUMME | 13,03`;

export const SAMPLE_RECEIPT = `REWE Markt GmbH
Musterstr. 12, 70173 Stuttgart
                              EUR
BIO HAFERDRINK 1L            1,49 B
TOFU NATUR 400G              2,29 B
BLATTSPINAT 200G             1,79 B
SOJASAUCE 150ML              2,19 B
KICHERERBSEN 400G            1,58 B
   2 Stk x  0,79
PAPRIKA ROT                  0,99 B
SNACK CHIPS PAPRIKA          1,69 B
MANDELMUS 250G               4,99 B
PFAND 0,25 EURO              0,25 A
--------------------------------------
SUMME                  EUR  17,26
Geg. EC-Cash           EUR  17,26`;

export const SAMPLE_RECIPE_TEXT = `🍝 Cremige Pasta mit Champignons (vegan) 🌱
für 2 Portionen

Zutaten:
• 250g Pasta
• 250 g Champignons
• 1 Zwiebel
• 2 Zehen Knoblauch
• 200 ml Hafercuisine
• 1 Handvoll Spinat
• Salz & Pfeffer nach Geschmack

Zubereitung:
1. Pasta kochen.
2. Zwiebel, Knoblauch und Pilze anbraten.
3. Hafercuisine dazu, kurz einkochen, Spinat rein.
4. Mit der Pasta mischen 😋

#vegan #pasta #schnellerezepte`;
