/* Texts for the "Bon" tab and example inputs. */
export const AI_PROMPT = `Lies den Kassenbon auf dem Foto aus. Antworte NUR mit einer Zeile pro Artikel, ohne weiteren Text, in genau diesem Format:
Bon-Text | Produktname | Menge | Einheit | Bereich

Regeln:
- Bon-Text: genau wie auf dem Bon
- Produktname: allgemeiner deutscher Name (z. B. Haferdrink, Tofu, Nudeln, Zwiebeln, Gehackte Tomaten)
- Menge: Packungsgröße mal Anzahl, als Zahl
- Einheit: g, ml, Stk oder Dose
- Bereich: Kühlschrank, Vorrat oder Tiefkühler
- Pfand, Summe, Rabatte und Zahlungsangaben weglassen

Beispiel:
BIO HAFERDR.UNG 1L | Haferdrink | 1000 | ml | Kühlschrank`;

export const SAMPLE_AI = `BIO HAFERDR.UNG 1L | Haferdrink | 1000 | ml | Kühlschrank
TOFU NAT. 400G | Tofu | 400 | g | Kühlschrank
BLATTSPIN. 200G | Spinat | 200 | g | Kühlschrank
SOJASAUCE 150ML | Sojasauce | 150 | ml | Vorrat
SPAGHETTI 500G | Nudeln | 500 | g | Vorrat
SPEISEZWIEB. 1KG | Zwiebeln | 8 | Stk | Vorrat
ERDBEEREN 500G | Erdbeeren | 500 | g | Kühlschrank`;

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
