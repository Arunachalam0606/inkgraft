import { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { Button, Done, Dropzone, ErrorNote, FileChip, Field, Segmented, inputCls } from '../components/ui';
import { PageGrid, useSinglePdf } from '../components/pages';
import { baseName, download, formatBytes, parseRanges } from '../lib/pdf';
import { chunks, split } from '../lib/ops';

type Mode = 'every' | 'each' | 'ranges';
const HUES = ['#7c93ff', '#f59e0b', '#34d399', '#f472b6', '#22d3ee', '#a78bfa', '#fb7185', '#a3e635'];

/** "1-3, 4-6; 9" -> one group per comma/semicolon-separated part (0-based page indices). */
function groupsFromRanges(text: string, count: number) {
  return text.split(/[,;]/).map((p) => p.trim()).filter(Boolean).map((p) => parseRanges(p, count).map((n) => n - 1));
}

export default function Split() {
  const { pdf, error, open, reset, setError } = useSinglePdf();
  const [mode, setMode] = useState<Mode>('every');
  const [every, setEvery] = useState(2);
  const [ranges, setRanges] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string>();

  const plan = useMemo(() => {
    if (!pdf) return { groups: [] as number[][], err: '' };
    try {
      if (mode === 'each') return { groups: chunks(pdf.count, 1), err: '' };
      if (mode === 'every') return { groups: chunks(pdf.count, Math.max(1, every || 1)), err: '' };
      return { groups: ranges.trim() ? groupsFromRanges(ranges, pdf.count) : [], err: '' };
    } catch (e) { return { groups: [], err: (e as Error).message }; }
  }, [pdf, mode, every, ranges]);

  useEffect(() => setDone(undefined), [plan]); // a finished result is stale once the settings change

  const partOf = useMemo(() => { const m = new Map<number, number>(); plan.groups.forEach((g, i) => g.forEach((p) => m.set(p + 1, i))); return m; }, [plan]);

  const run = async () => {
    if (!pdf || !plan.groups.length) return;
    setBusy(true); setError(undefined);
    try {
      const parts = await split(pdf.bytes, plan.groups);
      const stem = baseName(pdf.file.name);
      const label = (g: number[]) => (g.length === 1 ? `p${g[0] + 1}` : `p${g[0] + 1}-${g[g.length - 1] + 1}`);
      if (parts.length === 1) { download(parts[0], `${stem}-${label(plan.groups[0])}.pdf`); setDone(`1 file · ${formatBytes(parts[0].length)}`); return; }
      const zip = new JSZip();
      parts.forEach((bytes, i) => zip.file(`${stem}-${String(i + 1).padStart(2, '0')}-${label(plan.groups[i])}.pdf`, bytes));
      const blob = await zip.generateAsync({ type: 'blob' });
      download(blob, `${stem}-split.zip`, 'application/zip');
      setDone(`${parts.length} files in ${stem}-split.zip · ${formatBytes(blob.size)}`);
    } catch (e) { setError(`Couldn’t split: ${(e as Error).message}`); } finally { setBusy(false); }
  };
  const again = () => { reset(); setDone(undefined); setRanges(''); };

  if (!pdf) return <><Dropzone onFiles={([f]) => open(f)} /><ErrorNote error={error} /></>;
  return (
    <div>
      <FileChip file={pdf.file} extra={` · ${pdf.count} pages`} onRemove={again} />
      <div className="mt-6 space-y-4 rounded-2xl border border-line bg-surface p-5">
        <Segmented id="split" value={mode} onChange={setMode} options={[{ value: 'every', label: 'Every N pages' }, { value: 'each', label: 'Each page' }, { value: 'ranges', label: 'Custom ranges' }]} />
        {mode === 'every' && (
          <Field label="Pages per file">
            <input type="number" min={1} max={pdf.count} value={every} onChange={(e) => setEvery(+e.target.value)} className={`${inputCls} max-w-[140px]`} />
          </Field>
        )}
        {mode === 'ranges' && (
          <Field label="One file per range" hint="Separate files with commas: 1-3, 4-6, 7-">
            <input value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="1-3, 4-6, 7-" className={inputCls} />
          </Field>
        )}
        <div className="flex items-center justify-between gap-4">
          <span className="text-[13px] text-muted">{plan.groups.length ? `${plan.groups.length} file${plan.groups.length > 1 ? 's' : ''}${plan.groups.length > 1 ? ' · downloaded as a ZIP' : ''}` : ' '}</span>
          <Button busy={busy} onClick={run} disabled={!plan.groups.length}>Split PDF</Button>
        </div>
      </div>
      <ErrorNote error={plan.err || error} />
      <Done show={!!done} title="Split — downloading" detail={done} onAgain={again} />
      <div className="mt-6">
        <PageGrid doc={pdf.doc} count={pdf.count} dim={(n) => !partOf.has(n)}
          badge={(n) => partOf.has(n) ? <span className="rounded-full px-2 py-0.5 text-[11px] font-medium text-black" style={{ background: HUES[partOf.get(n)! % HUES.length] }}>File {partOf.get(n)! + 1}</span> : null} />
      </div>
    </div>
  );
}
