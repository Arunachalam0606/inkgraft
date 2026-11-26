import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { isEncrypted, protect, unlock } from '../src/lib/ops.ts';

async function doc() { const d = await PDFDocument.create(); const f = await d.embedFont(StandardFonts.Helvetica); d.addPage([200, 200]).drawText('secret page', { x: 10, y: 100, size: 12, font: f }); return d.save(); }
const text = async (b: Uint8Array, password?: string) => (await (await (await getDocument({ data: b.slice(), password }).promise).getPage(1)).getTextContent()).items.map((t: any) => t.str).join('');

test('protect: needs the password to open, text intact with it', async () => {
  const enc = await protect(await doc(), 'p4ss word', { printing: true, copying: false, modifying: false });
  assert.equal(await isEncrypted(enc), true);
  await assert.rejects(() => text(enc), /password/i);
  assert.equal(await text(enc, 'p4ss word'), 'secret page');
});

test('unlock: right password removes encryption, wrong one is a clear error', async () => {
  const enc = await protect(await doc(), 'abc', { printing: true, copying: true, modifying: true });
  await assert.rejects(() => unlock(enc, 'nope'), { name: 'WrongPassword' });
  const plain = await unlock(enc, 'abc');
  assert.equal(await isEncrypted(plain), false);
  assert.equal(await text(plain), 'secret page');
});
