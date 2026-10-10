/* Storage areas: technical code -> German label. */
export const AREAS = {fridge: 'Kühlschrank', pantry: 'Vorrat', freezer: 'Tiefkühler'};
export const areaFromText = t => /tief|tk|frost/i.test(t || '') ? 'freezer' : /k(ü|ue)hl/i.test(t || '') ? 'fridge' : 'pantry';
