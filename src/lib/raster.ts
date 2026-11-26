// Browser-side page rasterising and word positions (pdf.js + canvas + Tesseract).
import { PDFDocument } from '@cantoo/pdf-lib';
import { createWorker } from 'tesseract.js';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { renderPage } from './pdf';
import type { Word } from './pii';

/** Self-hosted Tesseract (the CSP allows no third-party scripts or data). */
export function ocrWorker(logger?: (m: { status: string; progress: number }) => void) {
  return createWorker('eng', 1, {
    workerPath: `${location.origin}/vendor/tesseract/worker.min.js`,
    corePath: `${location.origin}/vendor/tesseract/core`,
    langPath: `${location.origin}/vendor/tesseract/lang`,
    logger: logger ?? (() => undefined), // tesseract calls it unconditionally
  });
}

/** Rect in fractions of the rendered page (top-left origin), so it is independent of DPI. */
export interface FRect { x: number; y: number; w: number; h: number }

/**
 * Re-render every page as a JPEG and rebuild the PDF from those images. Boxes are painted solid black, so
 * nothing under them survives (no text layer, no vector content). `filter` is a canvas CSS filter.
 */
export async function rasterize(doc: PDFDocumentProxy, o: { dpi?: number; quality?: number; filter?: string; boxes?: Record<number, FRect[]>; onPage?: (n: number) => void } = {}) {
  const out = await PDFDocument.create();
  const dpi = o.dpi ?? 150;
  for (let n = 1; n <= doc.numPages; n++) {
    const vp = (await doc.getPage(n)).getViewport({ scale: 1 });
    let canvas = await renderPage(doc, n, { scale: dpi / 72 });
    if (o.filter) {
      const f = document.createElement('canvas'); f.width = canvas.width; f.height = canvas.height;
      const ctx = f.getContext('2d')!; ctx.filter = o.filter; ctx.drawImage(canvas, 0, 0);
      canvas.width = 0; canvas = f;
    }
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000';
    for (const r of o.boxes?.[n] ?? []) ctx.fillRect(r.x * canvas.width, r.y * canvas.height, r.w * canvas.width, r.h * canvas.height);
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', o.quality ?? 0.85));
    canvas.width = canvas.height = 0;
    const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
    out.addPage([vp.width, vp.height]).drawImage(img, { x: 0, y: 0, width: vp.width, height: vp.height });
    o.onPage?.(n);
  }
  return out.save();
}

/** Words with boxes in page fractions, from the PDF's own text (items split on spaces, widths by character share). */
export async function textWords(doc: PDFDocumentProxy, n: number): Promise<Word[]> {
  const page = await doc.getPage(n);
  const vp = page.getViewport({ scale: 1 });
  const items = (await page.getTextContent()).items as { str: string; transform: number[]; width: number; height: number }[];
  const out: Word[] = [];
  for (const it of items) {
    if (!it.str.trim()) continue;
    const [x0, yBase] = vp.convertToViewportPoint(it.transform[4], it.transform[5]);
    const h = Math.max(it.height, Math.hypot(it.transform[2], it.transform[3])) * vp.scale;
    const per = it.width / Math.max(1, it.str.length);
    let i = 0;
    for (const part of it.str.split(/(\s+)/)) {
      if (part.trim()) out.push({ text: part, x: (x0 + i * per) / vp.width, y: (yBase - h * 0.85) / vp.height, w: (part.length * per) / vp.width, h: (h * 1.1) / vp.height });
      i += part.length;
    }
  }
  return out;
}

/** Words from OCR of the rendered page (for scans), same fraction units. */
export async function ocrWords(doc: PDFDocumentProxy, n: number, worker: Awaited<ReturnType<typeof ocrWorker>>): Promise<Word[]> {
  const c = await renderPage(doc, n, { scale: 2.5 });
  const { data } = await worker.recognize(c, {}, { blocks: true });
  const W = c.width, H = c.height; c.width = c.height = 0;
  type TW = { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } };
  return ((data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words))) as TW[])
    .filter((w) => w.confidence > 30 && w.text.trim())
    .map((w) => ({ text: w.text, x: w.bbox.x0 / W, y: w.bbox.y0 / H, w: (w.bbox.x1 - w.bbox.x0) / W, h: (w.bbox.y1 - w.bbox.y0) / H }));
}
