import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy } from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** Open a PDF for rendering. pdf.js 5 has no eval path (CVE-2024-4367 class), and the CSP forbids 'unsafe-eval' anyway. */
export function openPdf(data: ArrayBuffer | Uint8Array, password?: string): Promise<PDFDocumentProxy> {
  // pdf.js transfers (detaches) the buffer it is given: hand it a copy so callers keep theirs
  const bytes = data instanceof Uint8Array ? data.slice() : new Uint8Array(data.slice(0));
  return pdfjs.getDocument({ data: bytes, password }).promise;
}

export const PasswordError = pdfjs.PasswordResponses;

/** Render one page (1-based) to a canvas whose width is about `width` CSS px (times devicePixelRatio). */
export async function renderPage(doc: PDFDocumentProxy, pageNo: number, opts: { width?: number; scale?: number; rotation?: number } = {}) {
  const page = await doc.getPage(pageNo);
  const base = page.getViewport({ scale: 1, rotation: ((page.rotate + (opts.rotation ?? 0)) % 360 + 360) % 360 });
  const scale = opts.scale ?? ((opts.width ?? 200) * Math.min(2, devicePixelRatio || 1)) / base.width;
  const vp = page.getViewport({ scale, rotation: base.rotation });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(vp.width);
  canvas.height = Math.ceil(vp.height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise;
  page.cleanup();
  return canvas;
}

export const readBytes = (file: File) => file.arrayBuffer().then((b) => new Uint8Array(b));

export function download(data: Uint8Array | Blob, name: string, type = 'application/pdf') {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export const baseName = (name: string) => name.replace(/\.[^.]+$/, '');

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export { parseRanges } from './ranges';
