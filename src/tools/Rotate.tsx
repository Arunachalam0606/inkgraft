import { RotateCcw, RotateCw, Repeat } from 'lucide-react';
import { useState } from 'react';
import { Button, Done, Dropzone, ErrorNote, FileChip } from '../components/ui';
import { PageGrid, useSelection, useSinglePdf } from '../components/pages';
import { baseName, download, formatBytes } from '../lib/pdf';
import { buildFrom } from '../lib/ops';

export default function Rotate() {
  const { pdf, error, open, reset, setError } = useSinglePdf();
  const { sel, setSel, toggle } = useSelection();
  const [rot, setRot] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string>();

  const turn = (by: number) => {
    if (!pdf) return;
    const pages = sel.size ? [...sel] : Array.from({ length: pdf.count }, (_, i) => i + 1);
    setRot((r) => { const n = { ...r }; pages.forEach((p) => { n[p] = (n[p] ?? 0) + by; }); return n; });
  };
  const changed = Object.values(rot).some((v) => v % 360 !== 0);

  const save = async () => {
    if (!pdf) return;
    setBusy(true);
    try {
      const bytes = await buildFrom(pdf.bytes, Array.from({ length: pdf.count }, (_, i) => ({ index: i, rotate: rot[i + 1] ?? 0 })));
      const name = `${baseName(pdf.file.name)}-rotated.pdf`;
      download(bytes, name);
      setDone(`${Object.values(rot).filter((v) => v % 360).length} pages turned · ${formatBytes(bytes.length)} · ${name}`);
    } catch (e) { setError(`Couldn’t rotate: ${(e as Error).message}`); } finally { setBusy(false); }
  };
  const again = () => { reset(); setSel(new Set()); setRot({}); setDone(undefined); };

  if (!pdf) return <><Dropzone onFiles={([f]) => open(f)} /><ErrorNote error={error} /></>;
  const target = sel.size ? `${sel.size} selected` : 'all pages';
  return (
    <div>
      <FileChip file={pdf.file} extra={` · ${pdf.count} pages`} onRemove={again} />
      <div className="sticky top-14 z-10 mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface/90 p-3 backdrop-blur-xl lg:top-2">
        <span className="mr-auto px-2 text-[13px] text-muted">Rotate {target}</span>
        <Button variant="ghost" onClick={() => turn(-90)}><RotateCcw className="size-4" />Left</Button>
        <Button variant="ghost" onClick={() => turn(90)}><RotateCw className="size-4" />Right</Button>
        <Button variant="ghost" onClick={() => turn(180)}><Repeat className="size-4" />180°</Button>
        <Button busy={busy} onClick={save} disabled={!changed}>Download</Button>
      </div>
      <ErrorNote error={error} />
      <Done show={!!done} title="Rotated — downloading" detail={done} onAgain={again} />
      <p className="mt-6 mb-3 text-[13px] text-faint">Select pages to rotate only those · with none selected, every page turns</p>
      <PageGrid doc={pdf.doc} count={pdf.count} selected={sel} onToggle={toggle} rotation={(n) => rot[n] ?? 0}
        badge={(n) => (rot[n] ?? 0) % 360 ? <span className="text-ink tabular-nums">{(((rot[n] % 360) + 360) % 360)}°</span> : null} />
    </div>
  );
}
