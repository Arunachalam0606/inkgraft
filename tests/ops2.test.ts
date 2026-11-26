import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { bates, cropMargins, fillTemplate, fitTo, flatten, flip, headerFooter, interleave, nUp, readMeta, sizeReport, splitBySize, splitHalves, writeMeta } from '../src/lib/ops2.ts';

async function doc(labels: string[], size: [number, number] = [300, 400]) {
  const d = await PDFDocument.create(); const f = await d.embedFont(StandardFonts.Helvetica);
  for (const l of labels) d.addPage(size).drawText(l, { x: 20, y: 200, size: 20, font: f });
  return d.save();
}
const texts = async (b: Uint8Array) => {
  const d = await getDocument({ data: b.slice() }).promise; const out: string[] = [];
  for (let i = 1; i <= d.numPages; i++) out.push((await (await d.getPage(i)).getTextContent()).items.map((t: any) => t.str).filter((s: string) => s.trim()).join(' '));
  return out;
};
const sizes = async (b: Uint8Array) => (await PDFDocument.load(b)).getPages().map((p) => [Math.round(p.getWidth()), Math.round(p.getHeight())]);

test('interleave alternates and appends leftovers; reverse handles back-side scans', async () => {
  assert.deepEqual(await texts(await interleave(await doc(['A1', 'A2', 'A3']), await doc(['B1', 'B2']))), ['A1', 'B1', 'A2', 'B2', 'A3']);
  assert.deepEqual(await texts(await interleave(await doc(['A1', 'A2']), await doc(['B2', 'B1']), true)), ['A1', 'B1', 'A2', 'B2']);
});

test('flip keeps page count and size, mirrors the text position', async () => {
  const out = await flip(await doc(['X']), true, false);
  assert.deepEqual(await sizes(out), [[300, 400]]);
  const d = await getDocument({ data: out.slice() }).promise;
  const item = (await (await d.getPage(1)).getTextContent()).items[0] as any;
  assert.ok(item.transform[4] > 150, 'text moved to the right half');
});

test('nUp puts 4 pages on one A4 sheet and keeps order', async () => {
  const out = await nUp(await doc(['P1', 'P2', 'P3', 'P4', 'P5']), 4);
  assert.deepEqual(await sizes(out), [[595, 842], [595, 842]]);
  assert.deepEqual(await texts(out), ['P1 P2 P3 P4', 'P5']);
});

test('splitHalves doubles pages, each half as wide', async () => {
  assert.deepEqual(await sizes(await splitHalves(await doc(['L', 'M'], [600, 400]))), [[300, 400], [300, 400], [300, 400], [300, 400]]);
});

test('cropMargins and fitTo', async () => {
  assert.deepEqual(await sizes(await cropMargins(await doc(['a']), { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 })), [[240, 320]]);
  assert.deepEqual(await sizes(await fitTo(await doc(['a'], [500, 300]), 'a4')), [[842, 595]]);
});

test('metadata round trip and scrub', async () => {
  const m = { title: 'Bill', author: 'CLC', subject: 'Oct', keywords: 'a, b', creator: 'x', producer: 'y' };
  const back = await readMeta(await writeMeta(await doc(['a']), m));
  assert.equal(back.title, 'Bill'); assert.equal(back.author, 'CLC'); assert.equal(back.keywords, 'a b');
});

test('header/footer templates and bates numbering continue across files', async () => {
  assert.equal(fillTemplate('{file} p{n}/{total}', { n: 2, total: 5, date: 'd', file: 'f.pdf' }), 'f.pdf p2/5');
  const hf = await headerFooter(await doc(['a', 'b']), { left: 'CONFIDENTIAL', center: '', right: '' }, { left: '', center: 'Page {n} of {total}', right: '' }, 'f.pdf');
  assert.deepEqual(await texts(hf), ['a CONFIDENTIAL Page 1 of 2', 'b CONFIDENTIAL Page 2 of 2']);
  const b1 = await bates(await doc(['a', 'b']), { prefix: 'ABC', suffix: '', start: 7, digits: 5 });
  assert.equal(b1.next, 9);
  assert.deepEqual((await texts(b1.bytes)).map((t) => t.split(' ').pop()), ['ABC00007', 'ABC00008']);
});

test('flatten keeps pages and text', async () => {
  assert.deepEqual(await texts(await flatten(await doc(['keep']))), ['keep']);
});

test('sizeReport adds up to the file size; splitBySize respects the limit', async () => {
  const b = await doc(Array.from({ length: 6 }, (_, i) => `P${i}`));
  const r = await sizeReport(b);
  assert.equal(r.parts.images + r.parts.fonts + r.parts.content + r.parts.other, r.total);
  const parts = await splitBySize(b, Math.ceil(b.length / 2));
  assert.ok(parts.length >= 2 && parts.every((p) => p.length <= Math.ceil(b.length / 2)));
  assert.equal((await Promise.all(parts.map(async (p) => (await PDFDocument.load(p)).getPageCount()))).reduce((a, c) => a + c, 0), 6);
});
