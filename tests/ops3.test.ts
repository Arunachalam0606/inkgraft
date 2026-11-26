import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { fillFields, readFields, runWorkflow } from '../src/lib/ops3.ts';
import { isEncrypted } from '../src/lib/ops.ts';

async function formPdf() {
  const d = await PDFDocument.create(); const p = d.addPage([400, 400]); const f = d.getForm();
  f.createTextField('name').addToPage(p, { x: 20, y: 300, width: 200, height: 24 });
  f.createCheckBox('agree').addToPage(p, { x: 20, y: 260, width: 14, height: 14 });
  const dd = f.createDropdown('city'); dd.addOptions(['Chennai', 'Trichy']); dd.addToPage(p, { x: 20, y: 220, width: 120, height: 22 });
  return d.save();
}
const text = async (b: Uint8Array, password?: string) => { const d = await getDocument({ data: b.slice(), password }).promise; let s = ''; for (let i = 1; i <= d.numPages; i++) s += (await (await d.getPage(i)).getTextContent()).items.map((t: any) => t.str).join(' ') + '\n'; return s; };

test('reads and fills form fields; locking flattens them into page text', async () => {
  const src = await formPdf();
  assert.deepEqual((await readFields(src)).map((f) => [f.name, f.kind]), [['name', 'text'], ['agree', 'check'], ['city', 'choice']]);
  const filled = await fillFields(src, { name: 'Test Person', agree: true, city: 'Trichy' }, false);
  const back = await readFields(filled);
  assert.deepEqual(back.map((f) => f.value), ['Test Person', true, 'Trichy']);
  const locked = await fillFields(src, { name: 'Test Person' }, true);
  assert.equal((await readFields(locked)).length, 0);
  assert.ok((await text(locked)).includes('Test Person'));
});

test('workflow chains steps in order and ends encrypted', async () => {
  const d = await PDFDocument.create(); const font = await d.embedFont(StandardFonts.Helvetica);
  for (const l of ['one', 'two']) d.addPage([300, 400]).drawText(l, { x: 20, y: 200, size: 14, font });
  const out = await runWorkflow(await d.save(), [{ kind: 'numbers', position: 'bottom-center', format: 'Page {n} of {total}' }, { kind: 'watermark', text: 'DRAFT', opacity: 0.2 }, { kind: 'protect', password: 'pw' }], 'f.pdf');
  assert.equal(await isEncrypted(out), true);
  const s = await text(out, 'pw');
  assert.ok(s.includes('Page 2 of 2') && s.includes('DRAFT'));
  await assert.rejects(() => runWorkflow(out, [{ kind: 'protect', password: 'x' }, { kind: 'flatten' }], 'f.pdf'), /last step/);
});
