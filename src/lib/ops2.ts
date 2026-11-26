// Phase 2 page/document operations (pdf-lib, no DOM) — tested in tests/ops2.test.ts.
import { PDFDocument, PDFName, PDFRawStream, PDFDict, StandardFonts, rgb } from '@cantoo/pdf-lib';
import { load, unsupportedChars } from './ops.ts';

/** Alternate pages: A1 B1 A2 B2 … ; leftovers are appended. `reverseB` handles a back-sides scan made in reverse. */
export async function interleave(a: Uint8Array, b: Uint8Array, reverseB = false) {
  const [da, db] = await Promise.all([load(a), load(b)]);
  const out = await PDFDocument.create();
  const pa = await out.copyPages(da, da.getPageIndices());
  const pbRaw = await out.copyPages(db, db.getPageIndices());
  const pb = reverseB ? pbRaw.reverse() : pbRaw;
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { if (pa[i]) out.addPage(pa[i]); if (pb[i]) out.addPage(pb[i]); }
  return out.save();
}

/** Mirror pages horizontally, vertically or both (each page redrawn as a form XObject). */
export async function flip(bytes: Uint8Array, h: boolean, v: boolean) {
  const src = await load(bytes);
  const out = await PDFDocument.create();
  const embedded = await out.embedPages(src.getPages());
  for (const e of embedded) {
    const page = out.addPage([e.width, e.height]);
    page.drawPage(e, { x: h ? e.width : 0, y: v ? e.height : 0, xScale: h ? -1 : 1, yScale: v ? -1 : 1 });
  }
  return out.save();
}

/** N pages per A4 sheet (2, 4, 6, 9 or 16), reading order left→right, top→bottom, with a small gutter. */
export async function nUp(bytes: Uint8Array, per: 2 | 4 | 6 | 9 | 16, landscapeFor2 = true) {
  const grid: Record<number, [number, number]> = { 2: [2, 1], 4: [2, 2], 6: [2, 3], 9: [3, 3], 16: [4, 4] };
  const [cols, rows] = grid[per];
  const [W, H] = per === 2 && landscapeFor2 ? [841.89, 595.28] : [595.28, 841.89];
  const src = await load(bytes);
  const out = await PDFDocument.create();
  const embedded = await out.embedPages(src.getPages());
  const gap = 12, cw = (W - gap * (cols + 1)) / cols, ch = (H - gap * (rows + 1)) / rows;
  for (let i = 0; i < embedded.length; i += per) {
    const sheet = out.addPage([W, H]);
    embedded.slice(i, i + per).forEach((e, k) => {
      const c = k % cols, r = Math.floor(k / cols);
      const s = Math.min(cw / e.width, ch / e.height);
      const w = e.width * s, hh = e.height * s;
      const x = gap + c * (cw + gap) + (cw - w) / 2;
      const y = H - (gap + r * (ch + gap)) - ch + (ch - hh) / 2;
      sheet.drawPage(e, { x, y, xScale: s, yScale: s });
    });
  }
  return out.save();
}

/** Cut every page into left/right (or top/bottom) halves — for two-page book scans. */
export async function splitHalves(bytes: Uint8Array, vertical = true) {
  const src = await load(bytes);
  const out = await PDFDocument.create();
  for (let i = 0; i < src.getPageCount(); i++) {
    const [a, b] = await out.copyPages(src, [i, i]);
    const { x, y, width, height } = a.getMediaBox();
    if (vertical) { a.setCropBox(x, y, width / 2, height); b.setCropBox(x + width / 2, y, width / 2, height); }
    else { a.setCropBox(x, y + height / 2, width, height / 2); b.setCropBox(x, y, width, height / 2); }
    // keep MediaBox == CropBox so every viewer shows the same half
    for (const p of [a, b]) { const c = p.getCropBox(); p.setMediaBox(c.x, c.y, c.width, c.height); out.addPage(p); }
  }
  return out.save();
}

/** Trim margins given as fractions of each side (0–0.45). */
export async function cropMargins(bytes: Uint8Array, m: { top: number; right: number; bottom: number; left: number }) {
  const doc = await load(bytes);
  for (const p of doc.getPages()) {
    const { x, y, width, height } = p.getMediaBox();
    const box = [x + width * m.left, y + height * m.bottom, width * (1 - m.left - m.right), height * (1 - m.top - m.bottom)] as const;
    p.setCropBox(...box); p.setMediaBox(...box);
  }
  return doc.save();
}

/** Scale every page to fit A4 or Letter (orientation kept), centred. */
export async function fitTo(bytes: Uint8Array, size: 'a4' | 'letter') {
  const [W, H] = size === 'a4' ? [595.28, 841.89] : [612, 792];
  const src = await load(bytes);
  const out = await PDFDocument.create();
  for (const e of await out.embedPages(src.getPages())) {
    const land = e.width > e.height;
    const [pw, ph] = land ? [H, W] : [W, H];
    const s = Math.min(pw / e.width, ph / e.height);
    out.addPage([pw, ph]).drawPage(e, { x: (pw - e.width * s) / 2, y: (ph - e.height * s) / 2, xScale: s, yScale: s });
  }
  return out.save();
}

/** Make form fields and annotations part of the page; drop JavaScript actions. */
export async function flatten(bytes: Uint8Array) {
  const doc = await load(bytes);
  try { doc.getForm().flatten(); } catch { /* no form */ }
  for (const p of doc.getPages()) p.node.delete(PDFName.of('Annots'));
  doc.catalog.delete(PDFName.of('Names')); // embedded JavaScript and file attachments live here
  doc.catalog.delete(PDFName.of('OpenAction'));
  return doc.save();
}

export interface Meta { title: string; author: string; subject: string; keywords: string; creator: string; producer: string }
export async function readMeta(bytes: Uint8Array): Promise<Meta & { created?: string; modified?: string }> {
  const d = await PDFDocument.load(bytes, { updateMetadata: false });
  return {
    title: d.getTitle() ?? '', author: d.getAuthor() ?? '', subject: d.getSubject() ?? '', keywords: d.getKeywords() ?? '',
    creator: d.getCreator() ?? '', producer: d.getProducer() ?? '',
    created: d.getCreationDate()?.toISOString(), modified: d.getModificationDate()?.toISOString(),
  };
}
export async function writeMeta(bytes: Uint8Array, m: Meta, scrub = false) {
  const d = await PDFDocument.load(bytes, { updateMetadata: false });
  d.setTitle(m.title); d.setAuthor(m.author); d.setSubject(m.subject);
  d.setKeywords(m.keywords.split(',').map((k) => k.trim()).filter(Boolean));
  d.setCreator(m.creator); d.setProducer(m.producer);
  if (scrub) { d.setCreationDate(new Date(0)); d.setModificationDate(new Date(0)); d.catalog.delete(PDFName.of('Metadata')); }
  else d.setModificationDate(new Date());
  return d.save();
}

/** Template tokens: {n} page, {total} pages, {date} today, {file} name. */
export const fillTemplate = (t: string, v: { n: number; total: number; date: string; file: string }) =>
  t.replaceAll('{n}', String(v.n)).replaceAll('{total}', String(v.total)).replaceAll('{date}', v.date).replaceAll('{file}', v.file);

export interface Band { left: string; center: string; right: string }
/** Header and footer text in three slots each. */
export async function headerFooter(bytes: Uint8Array, header: Band, footer: Band, file: string, size = 9, margin = 24) {
  const doc = await load(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages(), total = pages.length, date = new Date().toLocaleDateString('en-GB');
  pages.forEach((p, i) => {
    const { width, height } = p.getSize();
    for (const [band, y] of [[header, height - margin - size], [footer, margin]] as const) {
      for (const slot of ['left', 'center', 'right'] as const) {
        const text = fillTemplate(band[slot], { n: i + 1, total, date, file });
        if (!text.trim()) continue;
        const w = font.widthOfTextAtSize(text, size);
        const x = slot === 'left' ? margin : slot === 'right' ? width - margin - w : (width - w) / 2;
        p.drawText(text, { x, y, size, font, color: rgb(0.25, 0.25, 0.28) });
      }
    }
  });
  return doc.save();
}

/** Bates numbers: PREFIX + zero-padded counter (continuing from `start`) + SUFFIX, bottom-right. Returns the next number. */
export async function bates(bytes: Uint8Array, o: { prefix: string; suffix: string; start: number; digits: number }) {
  const doc = await load(bytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  let n = o.start;
  for (const p of doc.getPages()) {
    const label = `${o.prefix}${String(n++).padStart(o.digits, '0')}${o.suffix}`;
    const { width } = p.getSize();
    const w = font.widthOfTextAtSize(label, 9);
    p.drawRectangle({ x: width - 24 - w - 4, y: 18, width: w + 8, height: 15, color: rgb(1, 1, 1), opacity: 0.85 });
    p.drawText(label, { x: width - 24 - w, y: 22, size: 9, font, color: rgb(0.08, 0.08, 0.1) });
  }
  return { bytes: await doc.save(), next: n };
}

export { unsupportedChars };

/** Where the bytes go: images, fonts, page content and everything else, from the raw object streams. */
export async function sizeReport(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const parts = { images: 0, fonts: 0, content: 0, other: 0 };
  const images: { name: string; w: number; h: number; bytes: number; filter: string }[] = [];
  let i = 0;
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const len = obj.contents.length, d = obj.dict as PDFDict;
    const sub = d.get(PDFName.of('Subtype'))?.toString(), type = d.get(PDFName.of('Type'))?.toString();
    if (sub === '/Image') {
      parts.images += len;
      images.push({ name: `Image ${++i} (${ref.objectNumber})`, w: +(d.get(PDFName.of('Width'))?.toString() ?? 0), h: +(d.get(PDFName.of('Height'))?.toString() ?? 0), bytes: len, filter: d.get(PDFName.of('Filter'))?.toString() ?? 'none' });
    } else if (d.has(PDFName.of('Length1')) || d.has(PDFName.of('Length2')) || sub === '/Type1C' || sub === '/CIDFontType0C' || sub === '/OpenType') parts.fonts += len;
    else if (type === '/XObject' || !type) parts.content += len;
    else parts.other += len;
  }
  const counted = parts.images + parts.fonts + parts.content + parts.other;
  parts.other += Math.max(0, bytes.length - counted); // object tables, dictionaries, metadata
  return { total: bytes.length, pages: doc.getPageCount(), parts, images: images.sort((a, b) => b.bytes - a.bytes) };
}

/** Greedy split so each part stays under `limit` bytes (a single oversized page becomes its own part). */
export async function splitBySize(bytes: Uint8Array, limit: number) {
  const src = await load(bytes);
  const parts: Uint8Array[] = [];
  let group: number[] = [];
  const build = async (idx: number[]) => { const o = await PDFDocument.create(); (await o.copyPages(src, idx)).forEach((p) => o.addPage(p)); return o.save(); };
  for (let i = 0; i < src.getPageCount(); i++) {
    const trial = await build([...group, i]);
    if (trial.length > limit && group.length) { parts.push(await build(group)); group = [i]; }
    else group.push(i);
  }
  if (group.length) parts.push(await build(group));
  return parts;
}
