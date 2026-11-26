import { useState, type ReactNode } from 'react';
import { Button, Done, Dropzone, ErrorNote, FileChip } from './ui';
import { PreviewPane, friendly, usePreview, useSinglePdf, type LoadedPdf } from './pages';
import { download, formatBytes } from '../lib/pdf';

export interface OpResult { data: Uint8Array | Blob; name: string; type?: string; detail?: string }

/**
 * The common single-PDF tool: drop a file, set options, run, download.
 * `run` returns the file to save; `preview` (optional) renders page 1 of a PDF result live.
 */
export function OpTool({ options, run, action, preview, previewKey = '', note, after }: {
  options?: (pdf: LoadedPdf) => ReactNode;
  run: (pdf: LoadedPdf) => Promise<OpResult>;
  action: string;
  preview?: (bytes: Uint8Array) => Promise<Uint8Array>;
  previewKey?: string;
  note?: ReactNode;
  after?: (pdf: LoadedPdf) => ReactNode;
}) {
  const { pdf, error, open, reset, setError } = useSinglePdf();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string>();
  const live = usePreview(preview ? pdf : undefined, preview ?? (async (b) => b), previewKey);

  const go = async () => {
    if (!pdf) return;
    setBusy(true); setError(undefined);
    try {
      const r = await run(pdf);
      download(r.data, r.name, r.type);
      const size = r.data instanceof Blob ? r.data.size : r.data.length;
      setDone(`${r.detail ? `${r.detail} · ` : ''}${formatBytes(size)} · ${r.name}`);
    } catch (e) { setError(friendly(e)); } finally { setBusy(false); }
  };
  const again = () => { reset(); setDone(undefined); };

  if (!pdf) return <><Dropzone onFiles={([f]) => open(f)} /><ErrorNote error={error} /></>;
  const panel = (
    <div className="space-y-5 rounded-2xl border border-line bg-surface p-5">
      {options?.(pdf)}
      {note && <div className="text-[13px] text-muted">{note}</div>}
      <Button busy={busy} onClick={go} className="w-full">{action}</Button>
      <ErrorNote error={live.err || error} />
    </div>
  );
  return (
    <div>
      <FileChip file={pdf.file} extra={` · ${pdf.count} pages`} onRemove={again} />
      <div className={`mt-6 grid gap-6 ${preview ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]' : 'max-w-[640px]'}`}>
        {panel}
        {preview && <PreviewPane url={live.url} />}
      </div>
      <Done show={!!done} title="Done — downloading" detail={done} onAgain={again} />
      {after?.(pdf)}
    </div>
  );
}
