import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from '@cantoo/pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { addTextLayer } from '../src/lib/ops.ts';

test('addTextLayer makes words findable on the right page, roughly where they were', async () => {
  const d = await PDFDocument.create(); d.addPage([400, 300]); d.addPage([400, 300]);
  const { bytes, count } = await addTextLayer(await d.save(), [{ page: 1, words: [{ text: 'November', x: 50, y: 100, w: 80, h: 14 }, { text: '2026', x: 140, y: 100, w: 36, h: 14 }] }]);
  assert.equal(count, 2);
  const doc = await getDocument({ data: bytes.slice() }).promise;
  const items = async (n: number) => (await (await doc.getPage(n)).getTextContent()).items as any[];
  assert.equal((await items(1)).length, 0);
  const p2 = (await items(2)).filter((i) => i.str.trim()); // pdf.js inserts a space item between words
  assert.deepEqual(p2.map((i) => i.str), ['November', '2026']);
  assert.ok(Math.abs(p2[0].transform[4] - 50) < 1 && Math.abs(p2[0].width - 80) < 2);
});
