import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { inline, parseCsv, parseMarkdown, render, textBlocks } from '../src/lib/compose.ts';

const allText = async (b: Uint8Array) => {
  const d = await getDocument({ data: b.slice() }).promise; let s = '';
  for (let i = 1; i <= d.numPages; i++) s += (await (await d.getPage(i)).getTextContent()).items.map((t: any) => t.str).join(' ') + '\n';
  return { s: s.replace(/\s+/g, ' '), pages: d.numPages }; // words are separate items (each word drawn on its own)
};

test('inline markdown styles', () => {
  assert.deepEqual(inline('a **b** *c* `d`').filter((r) => r.text.trim()).map((r) => [r.text.trim(), r.style]), [['a', 'reg'], ['b', 'bold'], ['c', 'italic'], ['d', 'mono']]);
});

test('markdown blocks', () => {
  const b = parseMarkdown('# T\n\nPara one\nstill one\n\n- x\n  - y\n1. z\n> q\n\n---\n```\ncode\n```\n| a | b |\n|---|---|\n| 1 | 2 |');
  assert.deepEqual(b.map((x) => x.kind), ['h1', 'p', 'li', 'li', 'li', 'quote', 'hr', 'code', 'table']);
  assert.equal((b[3] as any).depth, 1);
  assert.deepEqual((b[8] as any).rows, [['a', 'b'], ['1', '2']]);
});

test('csv: quotes, embedded commas/newlines, semicolons', () => {
  assert.deepEqual(parseCsv('n,note\n"Ravi, K","said ""hi""\nthen left"\n'), [['n', 'note'], ['Ravi, K', 'said "hi"\nthen left']]);
  assert.deepEqual(parseCsv('a;b\n1;2'), [['a', 'b'], ['1', '2']]);
});

test('render keeps text selectable, wraps long input onto more pages', async () => {
  const md = '# Invoice notes\n\nHello **world**.\n\n' + Array.from({ length: 120 }, (_, i) => `- item ${i}`).join('\n');
  const r = await allText(await render(parseMarkdown(md)));
  assert.ok(r.s.includes('Invoice notes') && r.s.includes('item 119'));
  assert.ok(r.pages >= 2);
  const t = await allText(await render(textBlocks('plain text\nline two')));
  assert.ok(t.s.includes('plain text') && t.s.includes('line two'));
});

test('long tables repeat the header row on every page', async () => {
  const rows = [['Name', 'Amount'], ...Array.from({ length: 90 }, (_, i) => [`Row ${i}`, String(i * 10)])];
  const b = await render([{ kind: 'table', rows, header: true }]);
  const d = await getDocument({ data: b.slice() }).promise;
  assert.ok(d.numPages >= 2);
  for (let i = 1; i <= d.numPages; i++) assert.ok((await (await d.getPage(i)).getTextContent()).items.some((t: any) => t.str === 'Amount'), `header on page ${i}`);
});
