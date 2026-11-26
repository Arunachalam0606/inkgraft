import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import { buildFrom, chunks, split } from '../src/lib/ops.ts';

// a fixture whose pages are told apart by their width: page i is 100 + i points wide
async function fixture(n: number) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < n; i++) doc.addPage([100 + i, 200]).drawText(`P${i + 1}`, { x: 10, y: 100, size: 12, font });
  return doc.save();
}
const widths = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPages().map((p) => p.getWidth());
const turns = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPages().map((p) => p.getRotation().angle);

test('buildFrom reorders, drops and rotates pages', async () => {
  const src = await fixture(5);
  const out = await buildFrom(src, [{ index: 4 }, { index: 0, rotate: 90 }, { index: 2, rotate: -90 }]);
  assert.deepEqual(await widths(out), [104, 100, 102]);
  assert.deepEqual(await turns(out), [0, 90, 270]);
});

test('rotation accumulates on already-rotated pages', async () => {
  const once = await buildFrom(await fixture(1), [{ index: 0, rotate: 270 }]);
  const twice = await buildFrom(once, [{ index: 0, rotate: 180 }]);
  assert.deepEqual(await turns(twice), [90]);
});

test('chunks and split', async () => {
  assert.deepEqual(chunks(5, 2), [[0, 1], [2, 3], [4]]);
  const parts = await split(await fixture(5), chunks(5, 2));
  assert.deepEqual(await Promise.all(parts.map(widths)), [[100, 101], [102, 103], [104]]);
});
