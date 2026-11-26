import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from '@cantoo/pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { formatNumber, pageNumbers, watermark } from '../src/lib/ops.ts';

async function blank(n: number) { const d = await PDFDocument.create(); for (let i = 0; i < n; i++) d.addPage([300, 400]); return d.save(); }
async function texts(bytes: Uint8Array) {
  const doc = await getDocument({ data: bytes.slice() }).promise;
  const out: { str: string; x: number; y: number }[][] = [];
  for (let i = 1; i <= doc.numPages; i++) out.push((await (await doc.getPage(i)).getTextContent()).items.map((t: any) => ({ str: t.str, x: t.transform[4], y: t.transform[5] })));
  return out;
}

test('formatNumber', () => assert.equal(formatNumber('Page {n} of {total}', 2, 9), 'Page 2 of 9'));

test('page numbers: format, start, skip first, position', async () => {
  const out = await pageNumbers(await blank(3), { position: 'bottom-right', format: '{n} / {total}', start: 1, size: 10, margin: 20, skipFirst: true });
  const t = await texts(out);
  assert.equal(t[0].length, 0);
  assert.deepEqual(t.slice(1).map((p) => p[0].str), ['1 / 2', '2 / 2']);
  assert.ok(t[1][0].x > 230 && t[1][0].y === 20);
});

test('watermark lands on every page, centred', async () => {
  const t = await texts(await watermark(await blank(2), { text: 'DRAFT', size: 40, opacity: 0.2, angle: 0, color: [0.5, 0.5, 0.5] }));
  assert.deepEqual(t.map((p) => p[0].str), ['DRAFT', 'DRAFT']);
  assert.ok(Math.abs(t[0][0].x - 150) < 80 && t[0][0].y > 150 && t[0][0].y < 230);
});

import { unsupportedChars } from '../src/lib/ops.ts';
test('unsupportedChars flags scripts the standard fonts cannot draw', () => {
  assert.deepEqual(unsupportedChars('Café – “ok” €5'), []);
  assert.deepEqual(unsupportedChars('மா A'), ['ம', 'ா']);
});

import { stampImage } from '../src/lib/ops.ts';
test('stampImage draws the image only on the chosen pages', async () => {
  // 1x1 red PNG
  const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64'));
  const out = await stampImage(await blank(3), png, [{ page: 1, x: 10, y: 10, w: 50, h: 20 }]);
  const doc = await getDocument({ data: out.slice() }).promise;
  const ops = async (n: number) => (await (await doc.getPage(n)).getOperatorList()).fnArray.length;
  assert.equal(await ops(1), 0);
  assert.ok((await ops(2)) > 0);
  assert.equal(await ops(3), 0);
});
