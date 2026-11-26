import { useState } from 'react';
import JSZip from 'jszip';
import { Button, Group, Done, Dropzone, ErrorNote, Field, FileChip, Segmented, Thumb, inputCls } from '../components/ui';
import { useSinglePdf } from '../components/pages';
import { baseName, download, formatBytes, parseRanges, renderPage } from '../lib/pdf';

type Fmt = 'jpeg' | 'png';

export default function PdfToImages() {
  const { pdf, error, open, reset, setError } = useSinglePdf();
  const [fmt, setFmt] = useState<Fmt>('jpeg');
  const [dpi, setDpi] = useState(150);
  const [range, setRange] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState<string>();

  const run = async () => {
    if (!pdf) return;
    let pages: number[];
    try { pages = range.trim() ? parseRanges(range, pdf.count) : Array.from({ length: pdf.count }, (_, i) => i + 1); }
    catch (e) { setError((e as Error).message); return; }
    setBusy(true); setError(undefined); setProgress(0);
    try {
      const stem = baseName(pdf.file.name), ext = fmt === 'jpeg' ? 'jpg' : 'png';
      const blobs: Blob[] = [];
      for (const [i, n] of pages.entries()) {
        const canvas = await renderPage(pdf.doc, n, { scale: dpi / 72 });
        blobs.push(await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), `image/${fmt}`, 0.9)));
        canvas.width = canvas.height = 0; // free the bitmap right away on big documents
        setProgress((i + 1) / pages.length);
      }
      if (blobs.length === 1) { download(blobs[0], `${stem}-p${pages[0]}.${ext}`, `image/${fmt}`); setDone(`1 image · ${formatBytes(blobs[0].size)}`); return; }
      const zip = new JSZip();
      blobs.forEach((b, i) => zip.file(`${stem}-p${String(pages[i]).padStart(3, '0')}.${ext}`, b));
      const out = await zip.generateAsync({ type: 'blob' });
      download(out, `${stem}-${ext}.zip`, 'application/zip');
      setDone(`${blobs.length} images at ${dpi} DPI · ${formatBytes(out.size)} ZIP`);
    } catch (e) { setError(`Couldn’t render: ${(e as Error).message}`); } finally { setBusy(false); }
  };
  const again = () => { reset(); setDone(undefined); setRange(''); };

  if (!pdf) return <><Dropzone onFiles={([f]) => open(f)} /><ErrorNote error={error} /></>;
  return (
    <div>
      <FileChip file={pdf.file} extra={` · ${pdf.count} pages`} onRemove={again} />
      <div className="mt-6 flex flex-wrap items-end gap-6 rounded-2xl border border-line bg-surface p-5">
        <Group label="Format"><Segmented id="fmt" value={fmt} onChange={setFmt} options={[{ value: 'jpeg', label: 'JPG' }, { value: 'png', label: 'PNG' }]} /></Group>
        <Group label="Resolution"><Segmented id="dpi" value={dpi} onChange={setDpi} options={[{ value: 72, label: '72 DPI' }, { value: 150, label: '150' }, { value: 300, label: '300' }]} /></Group>
        <Field label="Pages"><input value={range} onChange={(e) => setRange(e.target.value)} placeholder={`All ${pdf.count}`} className={`${inputCls} w-40`} /></Field>
        <Button className="ml-auto" busy={busy} onClick={run}>Convert</Button>
      </div>
      {busy && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
      <ErrorNote error={error} />
      <Done show={!!done} title="Converted — downloading" detail={done} onAgain={again} />
      <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4">
        {Array.from({ length: Math.min(pdf.count, 24) }, (_, i) => <Thumb key={i} doc={pdf.doc} page={i + 1} />)}
      </div>
      {pdf.count > 24 && <p className="mt-3 text-[13px] text-faint">Showing the first 24 of {pdf.count} pages.</p>}
    </div>
  );
}
