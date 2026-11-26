// Page-level PDF operations on raw bytes (pdf-lib). Pure: no DOM, so tests run them in Node.
import { PDFDocument, StandardFonts, degrees, rgb } from '@cantoo/pdf-lib';

export interface PageSpec { index: number; rotate?: number } // 0-based source page, extra rotation in degrees

export async function load(bytes: Uint8Array, password?: string) {
  return PDFDocument.load(bytes, password ? { password } : {});
}

/** A new PDF made of the given pages, in the given order, each optionally turned by `rotate` degrees. */
export async function buildFrom(bytes: Uint8Array, pages: PageSpec[]) {
  const src = await load(bytes);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, pages.map((p) => p.index));
  copied.forEach((page, i) => {
    const extra = pages[i].rotate ?? 0;
    if (extra) page.setRotation(degrees((((page.getRotation().angle + extra) % 360) + 360) % 360));
    out.addPage(page);
  });
  return out.save();
}

export const pageCount = async (bytes: Uint8Array) => (await load(bytes)).getPageCount();

/** Split into consecutive chunks of `size` pages. */
export function chunks(count: number, size: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < count; i += size) out.push(Array.from({ length: Math.min(size, count - i) }, (_, k) => i + k));
  return out;
}

export async function split(bytes: Uint8Array, groups: number[][]) {
  return Promise.all(groups.map((g) => buildFrom(bytes, g.map((index) => ({ index })))));
}

// ---------- stamping ----------

export interface WatermarkOpts { text: string; size: number; opacity: number; angle: number; color: [number, number, number] }

/** Text across the middle of every page, at an angle, semi-transparent. */
export async function watermark(bytes: Uint8Array, o: WatermarkOpts) {
  const doc = await load(bytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const rad = (o.angle * Math.PI) / 180;
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const w = font.widthOfTextAtSize(o.text, o.size), h = font.heightAtSize(o.size);
    // start point so the rotated text's centre lands on the page centre
    const x = width / 2 - (Math.cos(rad) * w) / 2 + (Math.sin(rad) * h) / 2;
    const y = height / 2 - (Math.sin(rad) * w) / 2 - (Math.cos(rad) * h) / 2;
    page.drawText(o.text, { x, y, size: o.size, font, color: rgb(...o.color), opacity: o.opacity, rotate: degrees(o.angle) });
  }
  return doc.save();
}

export type Corner = 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left';
export interface NumberOpts { position: Corner; format: string; start: number; size: number; margin: number; skipFirst?: boolean }

/** "{n}" and "{total}" in `format` become the page number and the count of numbered pages. */
export const formatNumber = (format: string, n: number, total: number) => format.replaceAll('{n}', String(n)).replaceAll('{total}', String(total));

export async function pageNumbers(bytes: Uint8Array, o: NumberOpts) {
  const doc = await load(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const numbered = o.skipFirst ? pages.slice(1) : pages;
  const total = numbered.length + o.start - 1;
  numbered.forEach((page, i) => {
    const label = formatNumber(o.format, o.start + i, total);
    const { width, height } = page.getSize();
    const w = font.widthOfTextAtSize(label, o.size);
    const [v, hz] = o.position.split('-');
    const x = hz === 'left' ? o.margin : hz === 'right' ? width - o.margin - w : (width - w) / 2;
    const y = v === 'top' ? height - o.margin - o.size : o.margin;
    page.drawText(label, { x, y, size: o.size, font, color: rgb(0.2, 0.2, 0.22) });
  });
  return doc.save();
}

// The 14 standard PDF fonts use WinAnsi: Latin-1 plus a few typographic extras. pdf-lib would print "?" for anything else.
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
export const unsupportedChars = (text: string) => [...new Set([...text].filter((c) => !(c.charCodeAt(0) <= 0xff || WIN_ANSI_EXTRA.has(c))))];

// ---------- security ----------
export interface Perms { printing: boolean; copying: boolean; modifying: boolean }

/** AES-256 with the user's open password; a random owner password locks the permission flags. */
export async function protect(bytes: Uint8Array, password: string, perms: Perms) {
  const doc = await load(bytes);
  const owner = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');
  doc.encrypt({
    userPassword: password, ownerPassword: owner, algorithm: 'AES-256',
    permissions: { printing: perms.printing ? 'highResolution' : undefined, copying: perms.copying, modifying: perms.modifying, annotating: perms.modifying, fillingForms: true, contentAccessibility: true, documentAssembly: perms.modifying },
  });
  return doc.save();
}

/** Open with the password and save without encryption. Throws `WrongPassword` on a bad password. */
export async function unlock(bytes: Uint8Array, password: string) {
  let doc;
  try { doc = await load(bytes, password); }
  catch (e) { throw /password/i.test(String(e)) ? Object.assign(new Error('That password doesn’t open this PDF.'), { name: 'WrongPassword' }) : e; }
  // saving the decrypted document in place keeps a stale /Encrypt in the trailer: rebuild from its pages instead
  const out = await PDFDocument.create();
  (await out.copyPages(doc, doc.getPageIndices())).forEach((p) => out.addPage(p));
  const title = doc.getTitle(), author = doc.getAuthor();
  if (title) out.setTitle(title);
  if (author) out.setAuthor(author);
  return out.save();
}

export async function isEncrypted(bytes: Uint8Array) {
  try { await PDFDocument.load(bytes); return false; } catch (e) { if (/encrypted/i.test(String(e))) return true; throw e; }
}

// ---------- images on pages (signatures) ----------
export interface Placement { page: number; x: number; y: number; w: number; h: number } // 0-based page, PDF user-space rect

export async function stampImage(bytes: Uint8Array, png: Uint8Array, places: Placement[]) {
  const doc = await load(bytes);
  const img = await doc.embedPng(png);
  const pages = doc.getPages();
  for (const p of places) pages[p.page].drawImage(img, { x: p.x, y: p.y, width: p.w, height: p.h });
  return doc.save();
}

// ---------- OCR text layer ----------
export interface OcrWord { text: string; x: number; y: number; w: number; h: number } // PDF user space, (x, y) = bottom-left

/** Invisible (opacity 0) text over each word, horizontally fitted to its box, so the page becomes searchable and copyable. */
export async function addTextLayer(bytes: Uint8Array, pages: { page: number; words: OcrWord[] }[]) {
  const doc = await load(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const all = doc.getPages();
  let count = 0;
  for (const { page, words } of pages) {
    for (const w of words) {
      const text = [...w.text].map((c) => (unsupportedChars(c).length ? '?' : c)).join('').trim();
      if (!text || w.w <= 0 || w.h <= 0) continue;
      const unit = font.widthOfTextAtSize(text, 1);
      // fit the word's width (what selection highlights follow); clamp only absurd sizes from bad OCR boxes
      const size = Math.max(w.h * 0.5, Math.min(w.h * 2.2, w.w / unit));
      all[page].drawText(text, { x: w.x, y: w.y + w.h * 0.18, size, font, opacity: 0 });
      count++;
    }
  }
  return { bytes: await doc.save(), count };
}
