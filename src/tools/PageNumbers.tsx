import { useState } from 'react';
import { Button, Done, Dropzone, ErrorNote, Field, FileChip, Group, Segmented, inputCls } from '../components/ui';
import { PreviewPane, friendly, usePreview, useSinglePdf } from '../components/pages';
import { baseName, download, formatBytes } from '../lib/pdf';
import { pageNumbers, unsupportedChars, type Corner, type NumberOpts } from '../lib/ops';

const SPOTS: Corner[] = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];

export default function PageNumbers() {
  const { pdf, error, open, reset, setError } = useSinglePdf();
  const [position, setPosition] = useState<Corner>('bottom-center');
  const [format, setFormat] = useState('{n}');
  const [start, setStart] = useState(1);
  const [size, setSize] = useState(11);
  const [skipFirst, setSkipFirst] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string>();
  const opts: NumberOpts = { position, format: format || '{n}', start: Math.max(0, start || 0), size, margin: 28, skipFirst };
  const bad = unsupportedChars(format);
  const badMsg = bad.length ? `The built-in PDF font can’t draw ${bad.slice(0, 3).join(' ')} — use Latin letters, digits and punctuation.` : undefined;
  const preview = usePreview(pdf, (b) => pageNumbers(b, opts), JSON.stringify(opts), skipFirst && pdf && pdf.count > 1 ? 2 : 1);

  const run = async () => {
    if (!pdf) return;
    setBusy(true); setError(undefined);
    try {
      const bytes = await pageNumbers(pdf.bytes, opts);
      const name = `${baseName(pdf.file.name)}-numbered.pdf`;
      download(bytes, name);
      setDone(`${pdf.count - (skipFirst ? 1 : 0)} pages numbered · ${formatBytes(bytes.length)} · ${name}`);
    } catch (e) { setError(friendly(e)); } finally { setBusy(false); }
  };
  const again = () => { reset(); setDone(undefined); };

  if (!pdf) return <><Dropzone onFiles={([f]) => open(f)} /><ErrorNote error={error} /></>;
  return (
    <div>
      <FileChip file={pdf.file} extra={` · ${pdf.count} pages`} onRemove={again} />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="space-y-5 rounded-2xl border border-line bg-surface p-5">
          <Group label="Position">
            {/* a tiny page with six spots */}
            <div className="grid w-[132px] grid-cols-3 gap-1.5 rounded-xl border border-line bg-bg p-2" role="radiogroup">
              {SPOTS.map((s) => (
                <button key={s} role="radio" aria-checked={position === s} aria-label={s.replace('-', ' ')} onClick={() => setPosition(s)}
                  className={`h-7 rounded-md transition-colors ${s.startsWith('top') ? '' : 'mt-8'} ${position === s ? 'bg-accent' : 'bg-surface-2 hover:bg-line-strong'}`} />
              ))}
            </div>
          </Group>
          <Group label="Format">
            <Segmented id="pn-fmt" value={format} onChange={setFormat} options={[{ value: '{n}', label: '1' }, { value: 'Page {n}', label: 'Page 1' }, { value: 'Page {n} of {total}', label: 'Page 1 of N' }, { value: '{n} / {total}', label: '1 / N' }]} />
          </Group>
          <div className="flex gap-4">
            <Field label="Start at"><input type="number" min={0} value={start} onChange={(e) => setStart(+e.target.value)} className={`${inputCls} max-w-24`} /></Field>
            <Field label="Size"><input type="number" min={6} max={36} value={size} onChange={(e) => setSize(+e.target.value)} className={`${inputCls} max-w-24`} /></Field>
          </div>
          <label className="flex items-center gap-2.5 text-[14px] text-muted">
            <input type="checkbox" checked={skipFirst} onChange={(e) => setSkipFirst(e.target.checked)} className="size-4 accent-[var(--accent)]" />Don’t number the first page (cover)
          </label>
          <Button busy={busy} disabled={!!badMsg} onClick={run} className="w-full">Add page numbers</Button>
          <ErrorNote error={badMsg || preview.err || error} />
        </div>
        <PreviewPane url={preview.url} label={`Preview · page ${skipFirst && pdf.count > 1 ? 2 : 1}`} />
      </div>
      <Done show={!!done} title="Numbered — downloading" detail={done} onAgain={again} />
    </div>
  );
}
