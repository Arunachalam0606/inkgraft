// Text → PDF layout: blocks of styled runs, word-wrapped onto A4 with real (selectable) text. No DOM.
import { PDFDocument, PDFFont, StandardFonts, rgb } from '@cantoo/pdf-lib';
import { unsupportedChars } from './ops.ts';

export type Style = 'reg' | 'bold' | 'italic' | 'mono';
export interface Run { text: string; style: Style }
export type Block =
  | { kind: 'h1' | 'h2' | 'h3' | 'p' | 'quote'; runs: Run[] }
  | { kind: 'li'; runs: Run[]; marker: string; depth: number }
  | { kind: 'code'; text: string }
  | { kind: 'hr' }
  | { kind: 'table'; rows: string[][]; header: boolean };

/** Characters the standard fonts can't draw become "?" — callers warn up front via unsupportedChars. */
const safe = (s: string) => [...s.replace(/\t/g, '    ')].map((c) => (unsupportedChars(c).length ? '?' : c)).join('');

// ---------- inline markdown: **bold**, *italic* / _italic_, `code` ----------
export function inline(text: string): Run[] {
  const out: Run[] = [];
  const re = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index), style: 'reg' });
    const t = m[0];
    out.push(t.startsWith('`') ? { text: t.slice(1, -1), style: 'mono' } : t.startsWith('**') || t.startsWith('__') ? { text: t.slice(2, -2), style: 'bold' } : { text: t.slice(1, -1), style: 'italic' });
    last = m.index! + t.length;
  }
  if (last < text.length) out.push({ text: text.slice(last), style: 'reg' });
  // links [label](url) -> label (url)
  return out.map((r) => ({ ...r, text: r.text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)') }));
}

// ---------- markdown blocks ----------
export function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) { blocks.push({ kind: 'p', runs: inline(para.join(' ')) }); para = []; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) {
      flush(); const code: string[] = [];
      while (++i < lines.length && !/^```/.test(lines[i])) code.push(lines[i]);
      blocks.push({ kind: 'code', text: code.join('\n') }); continue;
    }
    let m;
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) { flush(); blocks.push({ kind: m[1].length === 1 ? 'h1' : m[1].length === 2 ? 'h2' : 'h3', runs: inline(m[2]) }); continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); blocks.push({ kind: 'hr' }); continue; }
    if ((m = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/))) { flush(); blocks.push({ kind: 'li', runs: inline(m[3]), marker: /\d/.test(m[2]) ? m[2].replace(')', '.') : '•', depth: Math.floor(m[1].length / 2) }); continue; }
    if ((m = line.match(/^>\s?(.*)$/))) { flush(); blocks.push({ kind: 'quote', runs: inline(m[1]) }); continue; }
    if (/^\|.*\|\s*$/.test(line)) {
      flush(); const rows: string[][] = [];
      for (; i < lines.length && /^\|.*\|\s*$/.test(lines[i]); i++) if (!/^\|[\s:|-]+\|\s*$/.test(lines[i])) rows.push(lines[i].trim().slice(1, -1).split('|').map((c) => c.trim()));
      i--; blocks.push({ kind: 'table', rows, header: true }); continue;
    }
    if (!line.trim()) { flush(); continue; }
    para.push(line.trim());
  }
  flush();
  return blocks;
}

/** RFC 4180-ish CSV: quotes, escaped quotes, commas/newlines inside quotes; auto-detects ; or tab separators. */
export function parseCsv(text: string): string[][] {
  const first = text.split('\n')[0] ?? '';
  const sep = [',', ';', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

export const textBlocks = (txt: string): Block[] => [{ kind: 'code', text: txt.replace(/\r\n?/g, '\n') }];

// ---------- layout ----------
interface Fonts { reg: PDFFont; bold: PDFFont; italic: PDFFont; mono: PDFFont }
const SIZES = { h1: 22, h2: 17, h3: 14, p: 11, quote: 11, li: 11, code: 9.5, table: 9 } as const;

export async function render(blocks: Block[], o: { title?: string; landscape?: boolean; mono?: boolean } = {}) {
  const doc = await PDFDocument.create();
  if (o.title) doc.setTitle(o.title);
  const F: Fonts = {
    reg: await doc.embedFont(o.mono ? StandardFonts.Courier : StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique), mono: await doc.embedFont(StandardFonts.Courier),
  };
  const [W, H] = o.landscape ? [841.89, 595.28] : [595.28, 841.89];
  const M = 56, width = W - 2 * M;
  let page = doc.addPage([W, H]), y = H - M;
  const ensure = (h: number) => { if (y - h < M) { page = doc.addPage([W, H]); y = H - M; } };
  const ink = rgb(0.11, 0.12, 0.14), muted = rgb(0.42, 0.44, 0.48);

  /** Word-wrap styled runs into lines of [run, x] pieces. */
  const wrap = (runs: Run[], size: number, maxW: number, base: Style = 'reg') => {
    const lines: { text: string; font: PDFFont; x: number }[][] = [[]];
    let x = 0;
    for (const r of runs) {
      const font = F[r.style === 'reg' ? base : r.style];
      for (const word of safe(r.text).split(/(\s+)/)) {
        if (!word) continue;
        const w = font.widthOfTextAtSize(word, size);
        if (/^\s+$/.test(word)) { if (x > 0) x += font.widthOfTextAtSize(' ', size); continue; }
        if (x + w > maxW && x > 0) { lines.push([]); x = 0; }
        lines[lines.length - 1].push({ text: word, font, x }); x += w;
      }
    }
    return lines;
  };
  const drawLines = (lines: ReturnType<typeof wrap>, size: number, x0: number, lead: number, color = ink) => {
    for (const line of lines) { ensure(lead); y -= lead; for (const p of line) page.drawText(p.text, { x: x0 + p.x, y, size, font: p.font, color }); }
  };

  for (const b of blocks) {
    if (b.kind === 'hr') { ensure(18); y -= 9; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: muted }); y -= 9; continue; }
    if (b.kind === 'code') {
      const size = SIZES.code, lead = size * 1.45;
      const src = safe(b.text).split('\n');
      const maxChars = Math.floor((width - 16) / F.mono.widthOfTextAtSize('M', size));
      const lines = src.flatMap((l) => (l.length ? (l.match(new RegExp(`.{1,${maxChars}}`, 'g')) ?? ['']) : ['']));
      y -= 6;
      for (const l of lines) { ensure(lead); y -= lead; page.drawRectangle({ x: M, y: y - 4, width, height: lead, color: rgb(0.95, 0.955, 0.965) }); page.drawText(l, { x: M + 8, y, size, font: F.mono, color: ink }); }
      y -= 10; continue;
    }
    if (b.kind === 'table') {
      const size = SIZES.table, lead = size * 1.6, cols = Math.max(...b.rows.map((r) => r.length));
      const natural = Array.from({ length: cols }, (_, c) => Math.max(30, ...b.rows.map((r) => F.reg.widthOfTextAtSize(safe(r[c] ?? ''), size) + 12)));
      const scale = Math.min(1, width / natural.reduce((a, v) => a + v, 0));
      const cw = natural.map((v) => v * scale);
      const drawRow = (r: string[], head: boolean, zebra: boolean): void => {
        const cells = r.map((c, k) => wrap([{ text: c ?? '', style: head ? 'bold' : 'reg' }], size, cw[k] - 10));
        const h = Math.max(1, ...cells.map((l) => l.length)) * lead + 4;
        const before = page;
        ensure(h);
        if (page !== before && b.header && !head) drawRow(b.rows[0], true, false); // repeat the header on each new page
        if (head || zebra) page.drawRectangle({ x: M, y: y - h, width, height: h, color: head ? rgb(0.9, 0.92, 0.97) : rgb(0.975, 0.977, 0.982) });
        let x = M;
        cells.forEach((lines, k) => { lines.forEach((line, li) => line.forEach((p) => page.drawText(p.text, { x: x + 5 + p.x, y: y - 2 - lead * (li + 1) + 3, size, font: p.font, color: ink }))); x += cw[k]; });
        y -= h;
      };
      y -= 6;
      b.rows.forEach((r, i) => drawRow(r, b.header && i === 0, i % 2 === 0 && i > 0));
      y -= 10; continue;
    }
    const size = SIZES[b.kind], lead = size * (b.kind.startsWith('h') ? 1.3 : 1.5);
    const base: Style = b.kind.startsWith('h') ? 'bold' : b.kind === 'quote' ? 'italic' : 'reg';
    y -= b.kind === 'h1' ? 14 : b.kind.startsWith('h') ? 10 : 4;
    if (b.kind === 'li') {
      const indent = 16 + b.depth * 16;
      const lines = wrap(b.runs, size, width - indent, base);
      ensure(lead);
      page.drawText(b.marker, { x: M + indent - 12, y: y - lead, size, font: F.reg, color: muted });
      drawLines(lines, size, M + indent, lead);
    } else if (b.kind === 'quote') {
      const top = y; drawLines(wrap(b.runs, size, width - 16, base), size, M + 14, lead, muted);
      page.drawLine({ start: { x: M + 3, y: Math.min(top, H - M) }, end: { x: M + 3, y: y - 4 }, thickness: 2, color: rgb(0.75, 0.78, 0.86) });
    } else drawLines(wrap(b.runs, size, width, base), size, M, lead);
    y -= b.kind === 'p' ? 6 : 2;
  }
  return doc.save();
}
