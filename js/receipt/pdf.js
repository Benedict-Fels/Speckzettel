/* Stage 1 for eBon PDFs (spec 13.2): pdf.js reads the text with positions, receipt/lines.js turns it into lines.
   pdf.js (vendor/pdfjs, ~1.8 MB) is only loaded when a PDF is chosen; the service worker keeps it for offline use. */
import {itemsToLines} from './lines.js';

let lib = null;
async function pdfjs() {
  if (!lib) {
    lib = await import('../../vendor/pdfjs/pdf.min.mjs');
    lib.GlobalWorkerOptions.workerSrc = new URL('../../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
  }
  return lib;
}

/* File -> text of all pages, one receipt line per text line. Throws Error('notext') for a scanned PDF without text layer. */
export async function pdfToText(file) {
  const {getDocument} = await pdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await getDocument({data, isEvalSupported: false, verbosity: 0}).promise;
  const out = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const tc = await page.getTextContent();
    out.push(...itemsToLines(tc.items.map(it => ({str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height}))));
  }
  await doc.destroy();
  if (!out.some(l => /\d+,\d{2}/.test(l))) throw new Error('notext');
  return out.join('\n');
}
