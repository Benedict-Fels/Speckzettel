/* All "now" reads go through here, so tests can pin the time by replacing Date.now.
   Day counts are calendar days in local time (bought yesterday 23:00 = 1 day ago), robust across DST. */
export const DAY = 864e5;
export const now = () => Date.now();
export const startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);
export const addDays = (t, n) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); };
