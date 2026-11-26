import { motion } from 'motion/react';
import { useState } from 'react';
import { PDFDocument } from '@cantoo/pdf-lib';
import { Button, Done, Dropzone, ErrorNote, FileChip, Group, Segmented } from '../components/ui';
import { useSinglePdf } from '../components/pages';
import { baseName, download, formatBytes, renderPage } from '../lib/pdf';

type Level = 'lossless' | 'strong' | 'extreme';
const LEVELS: Record<Level, { dpi: number; q: number; note: string }> = {
  lossless: { dpi: 0, q: 0, note: 'Rewrites the file structure. Text stays selectable; savings are usually small.' },
  strong: { dpi: 150, q: 0.68, note: 'Re-renders each page as a 150 DPI image. Big savings on scans; text becomes part of the image.' },
  extreme: { dpi: 96, q: 0.5, note: 'Smallest file, 96 DPI. Fine for screen reading; text becomes part of the image.' },
};

export default function Compress() {
  const { pdf, error, open, reset, setError } = useSinglePdf();
  const [level, setLevel] = useState<Level>('strong');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ before: number; after: number; kept: boolean }>();

  const run = async () => {
    if (!pdf) return;
    setBusy(true); setError(undefined); setProgress(0);
    try {
      let out: Uint8Array;
      if (level === 'lossless') {
        out = await (await PDFDocument.load(pdf.bytes)).save({ useObjectStreams: true });
      } else {
        const { dpi, q } = LEVELS[level];
        const doc = await PDFDocument.create();
        for (let n = 1; n <= pdf.count; n++) {
          const page = await pdf.doc.getPage(n);
          const vp = page.getViewport({ scale: 1 }); // points, rotation applied
          const canvas = await renderPage(pdf.doc, n, { scale: dpi / 72 });
          const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', q));
          canvas.width = canvas.height = 0;
          const img = await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
          doc.addPage([vp.width, vp.height]).drawImage(img, { x: 0, y: 0, width: vp.width, height: vp.height });
          setProgress(n / pdf.count);
        }
        out = await doc.save();
      }
      const kept = out.length >= pdf.bytes.length;
      const name = `${baseName(pdf.file.name)}-compressed.pdf`;
      download(kept ? pdf.bytes : out, name);
      setResult({ before: pdf.bytes.length, after: kept ? pdf.bytes.length : out.length, kept });
    } catch (e) { setError(`Couldn’t compress: ${(e as Error).message}`); } finally { setBusy(false); }
  };
  const again = () => { reset(); setResult(undefined); };

  if (!pdf) return <><Dropzone onFiles={([f]) => open(f)} /><ErrorNote error={error} /></>;
  const saved = result ? 1 - result.after / result.before : 0;
  return (
    <div>
      <FileChip file={pdf.file} extra={` · ${pdf.count} pages`} onRemove={again} />
      <div className="mt-6 max-w-[640px] space-y-4 rounded-2xl border border-line bg-surface p-5">
        <Group label="Compression"><Segmented id="cmp" value={level} onChange={(v) => { setLevel(v); setResult(undefined); }} options={[{ value: 'lossless', label: 'Lossless' }, { value: 'strong', label: 'Strong' }, { value: 'extreme', label: 'Extreme' }]} /></Group>
        <p className="text-[13px] text-muted">{LEVELS[level].note}</p>
        <Button busy={busy} onClick={run} className="w-full">Compress</Button>
        {busy && level !== 'lossless' && (
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
          </div>
        )}
      </div>
      <ErrorNote error={error} />
      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 max-w-[640px] rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-baseline justify-between text-[14px]">
            <span className="text-muted">{formatBytes(result.before)} → <span className="text-fg">{formatBytes(result.after)}</span></span>
            <span className={`text-[22px] font-semibold tracking-tight ${result.kept ? 'text-muted' : 'text-emerald-400'}`}>{result.kept ? '0%' : `−${Math.round(saved * 100)}%`}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
            <motion.div className="h-full rounded-full bg-emerald-400" initial={{ width: '100%' }} animate={{ width: `${(result.after / result.before) * 100}%` }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} />
          </div>
          {result.kept && <p className="mt-3 text-[13px] text-muted">This file is already well compressed — you got the original back. Try a stronger level.</p>}
        </motion.div>
      )}
      <Done show={!!result} title="Done — downloading" detail={`${baseName(pdf.file.name)}-compressed.pdf`} onAgain={again} />
    </div>
  );
}
