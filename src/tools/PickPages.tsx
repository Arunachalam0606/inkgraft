import { useState } from 'react';
import { Button, Done, Dropzone, ErrorNote, FileChip, inputCls } from '../components/ui';
import { PageGrid, useSelection, useSinglePdf } from '../components/pages';
import { baseName, download, formatBytes, parseRanges } from '../lib/pdf';
import { buildFrom } from '../lib/ops';

/** Extract keeps the chosen pages; Delete removes them. Pages are chosen by clicking or by typing a range. */
export function PickPages({ mode }: { mode: 'extract' | 'delete' }) {
  const { pdf, error, open, reset, setError } = useSinglePdf();
  const { sel, setSel, toggle } = useSelection();
  const [range, setRange] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string>();
  const del = mode === 'delete';

  const applyRange = (v: string) => {
    setRange(v);
    if (!pdf || !v.trim()) return;
    try { setSel(new Set(parseRanges(v, pdf.count))); setError(undefined); } catch (e) { setError((e as Error).message); }
  };

  const run = async () => {
    if (!pdf) return;
    const keep = Array.from({ length: pdf.count }, (_, i) => i + 1).filter((n) => (del ? !sel.has(n) : sel.has(n)));
    if (!keep.length) { setError(del ? 'That would delete every page.' : 'Pick at least one page.'); return; }
    setBusy(true);
    try {
      const bytes = await buildFrom(pdf.bytes, keep.map((n) => ({ index: n - 1 })));
      const name = `${baseName(pdf.file.name)}-${del ? 'trimmed' : 'pages'}.pdf`;
      download(bytes, name);
      setDone(`${keep.length} of ${pdf.count} pages kept · ${formatBytes(bytes.length)} · ${name}`);
    } catch (e) { setError(`Couldn’t build the PDF: ${(e as Error).message}`); } finally { setBusy(false); }
  };

  if (!pdf) return <><Dropzone onFiles={([f]) => open(f)} /><ErrorNote error={error} /></>;
  return (
    <div>
      <FileChip file={pdf.file} extra={` · ${pdf.count} pages`} onRemove={() => { reset(); setSel(new Set()); setDone(undefined); setRange(''); }} />
      <div className="sticky top-14 z-10 mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface/90 p-4 backdrop-blur-xl lg:top-2">
        <label className="min-w-[220px] flex-1">
          <span className="mb-1.5 block text-[13px] font-medium text-muted">{del ? 'Pages to delete' : 'Pages to extract'}</span>
          <input value={range} onChange={(e) => applyRange(e.target.value)} placeholder="Click pages, or type e.g. 1-3, 7" className={inputCls} />
        </label>
        <Button variant="ghost" onClick={() => { setSel(new Set()); setRange(''); }} disabled={!sel.size}>Clear</Button>
        <Button busy={busy} onClick={run} disabled={!sel.size}>
          {del ? `Delete ${sel.size || ''} page${sel.size === 1 ? '' : 's'}` : `Extract ${sel.size || ''} page${sel.size === 1 ? '' : 's'}`}
        </Button>
      </div>
      <ErrorNote error={error} />
      <Done show={!!done} title={del ? 'Pages removed — downloading' : 'Pages extracted — downloading'} detail={done} onAgain={() => { reset(); setSel(new Set()); setDone(undefined); setRange(''); }} />
      <p className="mt-6 mb-3 text-[13px] text-faint">Click to {del ? 'mark' : 'pick'} pages · Shift-click for a range</p>
      <PageGrid doc={pdf.doc} count={pdf.count} selected={sel} onToggle={toggle} dim={del ? (n) => sel.has(n) : undefined} />
    </div>
  );
}

export const Extract = () => <PickPages mode="extract" />;
export const Delete = () => <PickPages mode="delete" />;
