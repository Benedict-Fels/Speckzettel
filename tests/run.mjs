/* Node runner: node tests/run.mjs (from the app folder or anywhere). */
import fs from 'node:fs';
import {runAll} from './tests.js';
const catalog = JSON.parse(fs.readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));
const results = await runAll(catalog);
for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : '\n    ' + r.error}`);
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed} von ${results.length} Tests bestanden`);
process.exit(failed ? 1 : 0);
