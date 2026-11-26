// Page-level PDF operations on raw bytes (pdf-lib). Pure: no DOM, so tests run them in Node.
import { PDFDocument, degrees } from '@cantoo/pdf-lib';

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
