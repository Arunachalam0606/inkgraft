import { motion } from 'motion/react';
import { useState } from 'react';
import { Button, Done, Dropzone, ErrorNote, FileChip, Thumb } from '../components/ui';
import { useSinglePdf } from '../components/pages';
import { baseName, download, formatBytes, renderPage } from '../lib/pdf';
import { addTextLayer, type OcrWord } from '../lib/ops';
import { ocrWorker } from '../lib/raster';

const SCALE = 2.5; // 180 DPI: enough for Tesseract on typical scans without huge canvases

interface TWord { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }

export default function Ocr() {
  const { pdf, error, open, reset, setError } = useSinglePdf();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ page: number; pct: number; label: string }>();
  const [done, setDone] = useState<string>();
  const [sample, setSample] = useState<string>();

  const run = async () => {
    if (!pdf) return;
    setBusy(true); setError(undefined); setSample(undefined);
    let current = 1;
    const worker = await ocrWorker((m) => {
      if (m.status === 'recognizing text') setStatus({ page: current, pct: m.progress, label: 'Reading text' });
      else if (/loading|initializ/i.test(m.status)) setStatus({ page: current, pct: m.progress, label: 'Loading the text engine (first time only)' });
    });
    try {
      const pages: { page: number; words: OcrWord[] }[] = [];
      let skipped = 0, firstWords = '';
      for (let n = 1; n <= pdf.count; n++) {
        current = n;
        const pg = await pdf.doc.getPage(n);
        if ((await pg.getTextContent()).items.some((i) => 'str' in i && i.str.trim())) { skipped++; continue; } // already has real text
        const vp = pg.getViewport({ scale: SCALE });
        const canvas = await renderPage(pdf.doc, n, { scale: SCALE });
        const { data } = await worker.recognize(canvas, {}, { blocks: true });
        canvas.width = canvas.height = 0;
        const words = ((data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words))) as TWord[])
          .filter((w) => w.confidence > 35 && w.text.trim());
        pages.push({
          page: n - 1,
          words: words.map((w) => {
            const [ax, ay] = vp.convertToPdfPoint(w.bbox.x0, w.bbox.y1);
            const [bx, by] = vp.convertToPdfPoint(w.bbox.x1, w.bbox.y0);
            return { text: w.text, x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay) };
          }),
        });
        if (!firstWords) firstWords = words.slice(0, 18).map((w) => w.text).join(' ');
      }
      if (!pages.length) { setError('Every page already has selectable text — nothing to do.'); return; }
      const { bytes, count } = await addTextLayer(pdf.bytes, pages);
      const name = `${baseName(pdf.file.name)}-searchable.pdf`;
      download(bytes, name);
      setSample(firstWords);
      setDone(`${count} words on ${pages.length} page${pages.length > 1 ? 's' : ''}${skipped ? ` · ${skipped} already had text` : ''} · ${formatBytes(bytes.length)} · ${name}`);
    } catch (e) { setError(`Couldn’t read the pages: ${(e as Error).message}`); }
    finally { await worker.terminate(); setBusy(false); setStatus(undefined); }
  };
  const again = () => { reset(); setDone(undefined); setSample(undefined); };

  if (!pdf) return <><Dropzone onFiles={([f]) => open(f)} hint="Scanned or photographed PDFs · English · stays on this device" /><ErrorNote error={error} /></>;
  const overall = status ? (status.page - 1 + status.pct) / pdf.count : 0;
  return (
    <div>
      <FileChip file={pdf.file} extra={` · ${pdf.count} pages`} onRemove={again} />
      <div className="mt-6 max-w-[640px] space-y-4 rounded-2xl border border-line bg-surface p-5">
        <p className="text-[14px] text-muted">Recognises the text on each scanned page and adds it as an invisible layer, so you can search, select and copy — the pages look exactly the same.</p>
        <Button busy={busy} onClick={run} className="w-full">Make searchable</Button>
        {status && (
          <div aria-live="polite">
            <div className="mb-1.5 flex justify-between text-[12px] text-muted"><span>{status.label} · page {status.page} of {pdf.count}</span><span className="tabular-nums">{Math.round(overall * 100)}%</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(overall * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${overall * 100}%` }} />
            </div>
          </div>
        )}
      </div>
      <ErrorNote error={error} />
      <Done show={!!done} title="Searchable — downloading" detail={done} onAgain={again} />
      {sample && (
        <motion.blockquote initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 max-w-[640px] rounded-xl border border-line bg-bg p-4 font-mono text-[12.5px] leading-relaxed text-muted">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-faint">First words found</span>{sample}…
        </motion.blockquote>
      )}
      <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4">
        {Array.from({ length: Math.min(pdf.count, 12) }, (_, i) => <Thumb key={i} doc={pdf.doc} page={i + 1} />)}
      </div>
    </div>
  );
}
