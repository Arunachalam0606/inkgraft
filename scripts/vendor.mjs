// Copy runtime libraries from node_modules into public/vendor so the site loads nothing from third-party CDNs.
import { cpSync, mkdirSync, readdirSync } from 'node:fs';

const out = 'public/vendor';
const copy = (from, to) => { mkdirSync(to.replace(/\/[^/]+$/, ''), { recursive: true }); cpSync(from, to); };

copy('node_modules/pdfjs-dist/build/pdf.min.mjs', `${out}/pdfjs/pdf.min.mjs`);
copy('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', `${out}/pdfjs/pdf.worker.min.mjs`);
copy('node_modules/tesseract.js/dist/tesseract.min.js', `${out}/tesseract/tesseract.min.js`);
copy('node_modules/tesseract.js/dist/worker.min.js', `${out}/tesseract/worker.min.js`);
for (const f of readdirSync('node_modules/tesseract.js-core')) if (/^tesseract-core.*\.(js|wasm)$/.test(f)) copy(`node_modules/tesseract.js-core/${f}`, `${out}/tesseract/core/${f}`);
copy('node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', `${out}/tesseract/lang/eng.traineddata.gz`);
copy('node_modules/jspdf/dist/jspdf.umd.min.js', `${out}/jspdf/jspdf.umd.min.js`);
console.log('vendor: copied runtime libraries to', out);
