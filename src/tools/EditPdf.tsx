import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Eraser, Highlighter, ImagePlus, Trash2, Type } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button, Done, Dropzone, ErrorNote, FileChip, Group, Segmented } from '../components/ui';
import { useSinglePdf } from '../components/pages';
import { baseName, download, formatBytes, renderPage } from '../lib/pdf';
import { applyEdits, type Edit } from '../lib/ops3';
import { unsupportedChars } from '../lib/ops';

type Kind = 'text' | 'white' | 'mark' | 'image';
interface El { id: number; page: number; kind: Kind; fx: number; fy: number; fw: number; fh: number; text?: string; size?: number; color?: string; bold?: boolean; img?: { url: string; png: Uint8Array } }
let eid = 0;
const COLORS = { black: '#15171c', blue: '#1d3fbf', red: '#c4232f' } as const;
const hexRgb = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];

export function EditPdf() {
  const { pdf, error, open, reset, setError } = useSinglePdf();
  const [page, setPage] = useState(1);
  const [url, setUrl] = useState<string>();
  const [pageW, setPageW] = useState(612); // PDF points, for font-size scaling
  const [els, setEls] = useState<El[]>([]);
  const [sel, setSel] = useState<number>();
  const [done, setDone] = useState<string>();
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(800);
  const fileIn = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pdf) return;
    let a = true;
    pdf.doc.getPage(page).then((p) => a && setPageW(p.getViewport({ scale: 1 }).width));
    renderPage(pdf.doc, page, { width: 900 }).then((c) => a && setUrl(c.toDataURL('image/jpeg', 0.88)));
    return () => { a = false; };
  }, [pdf, page]);
  useEffect(() => { const ro = new ResizeObserver(([e]) => setBoxW(e.contentRect.width)); if (box.current) ro.observe(box.current); return () => ro.disconnect(); }, [url]);

  const add = (kind: Kind, extra: Partial<El> = {}) => {
    const el: El = { id: eid++, page, kind, fx: 0.15, fy: 0.2, fw: kind === 'text' ? 0.4 : 0.3, fh: kind === 'text' ? 0.05 : 0.04, text: kind === 'text' ? 'Type here' : undefined, size: 14, color: COLORS.black, ...extra };
    setEls((c) => [...c, el]); setSel(el.id);
  };
  const addImage = async (f: File) => {
    const bmp = await createImageBitmap(f);
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; c.getContext('2d')!.drawImage(bmp, 0, 0);
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'));
    const aspect = bmp.height / bmp.width, fw = 0.3, ratio = boxW / (box.current?.clientHeight || boxW * 1.3);
    add('image', { fw, fh: fw * aspect * ratio, img: { url: URL.createObjectURL(blob), png: new Uint8Array(await blob.arrayBuffer()) } });
  };
  const upd = (id: number, patch: Partial<El>) => setEls((c) => c.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const cur = els.find((e) => e.id === sel);

  const save = async () => {
    if (!pdf) return;
    setBusy(true); setError(undefined);
    try {
      const edits: Edit[] = await Promise.all(els.map(async (e) => {
        const vp = (await pdf.doc.getPage(e.page)).getViewport({ scale: 1 });
        const [ax, ay] = vp.convertToPdfPoint(e.fx * vp.width, e.fy * vp.height);
        const [bx, by] = vp.convertToPdfPoint((e.fx + e.fw) * vp.width, (e.fy + e.fh) * vp.height);
        const r = { page: e.page - 1, x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay) };
        if (e.kind === 'text') return { ...r, kind: 'text', text: e.text, size: e.size, color: hexRgb(e.color ?? COLORS.black), bold: e.bold };
        if (e.kind === 'image') return { ...r, kind: 'image', png: e.img!.png };
        return { ...r, kind: 'rect', color: e.kind === 'white' ? [1, 1, 1] : [1, 0.86, 0.1], opacity: e.kind === 'white' ? 1 : 0.38 };
      }));
      const out = await applyEdits(pdf.bytes, edits);
      const n = `${baseName(pdf.file.name)}-edited.pdf`;
      download(out, n); setDone(`${els.length} change${els.length === 1 ? '' : 's'} · ${formatBytes(out.length)} · ${n}`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  if (!pdf) return <><Dropzone onFiles={([f]) => open(f)} /><ErrorNote error={error} /></>;
  const bad = els.flatMap((e) => (e.kind === 'text' ? unsupportedChars(e.text ?? '') : []));
  const k = boxW / pageW; // CSS px per PDF point
  const tools: [Kind, string, typeof Type][] = [['text', 'Text', Type], ['white', 'White-out', Eraser], ['mark', 'Highlight', Highlighter]];
  return (
    <div>
      <FileChip file={pdf.file} extra={` · ${pdf.count} pages`} onRemove={() => { reset(); setEls([]); setDone(undefined); }} />
      <div className="sticky top-14 z-20 mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface/90 p-2.5 backdrop-blur-xl lg:top-2">
        {tools.map(([kind, label, Icon]) => <Button key={kind} variant="ghost" onClick={() => add(kind)}><Icon className="size-4" />{label}</Button>)}
        <Button variant="ghost" onClick={() => fileIn.current?.click()}><ImagePlus className="size-4" />Image</Button>
        <input ref={fileIn} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void addImage(f); e.target.value = ''; }} />
        <span className="ml-auto flex items-center gap-1 text-[13px]">
          <button aria-label="Previous page" disabled={page <= 1} onClick={() => { setPage((p) => p - 1); setSel(undefined); }} className="rounded-lg p-1.5 hover:bg-surface-2 disabled:opacity-30"><ChevronLeft className="size-4" /></button>
          <span className="tabular-nums">{page} / {pdf.count}</span>
          <button aria-label="Next page" disabled={page >= pdf.count} onClick={() => { setPage((p) => p + 1); setSel(undefined); }} className="rounded-lg p-1.5 hover:bg-surface-2 disabled:opacity-30"><ChevronRight className="size-4" /></button>
        </span>
        <Button busy={busy} disabled={!els.length} onClick={save}>Save PDF</Button>
      </div>
      {cur && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3">
          {cur.kind === 'text' && <>
            <textarea value={cur.text} onChange={(e) => upd(cur.id, { text: e.target.value, fh: Math.max(cur.fh, (e.target.value.split('\n').length * (cur.size ?? 14) * 1.25 + 6) * k / (box.current?.clientHeight || 1)) })} rows={2} aria-label="Text" className="min-w-[220px] flex-1 rounded-lg border border-line-strong bg-bg px-2.5 py-1.5 text-[14px] outline-none focus:border-accent" />
            <label className="flex items-center gap-1.5 text-[13px] text-muted">Size<input type="number" min={6} max={72} value={cur.size} onChange={(e) => upd(cur.id, { size: +e.target.value })} className="w-16 rounded-lg border border-line-strong bg-bg px-2 py-1" /></label>
            <Group label="Colour"><Segmented id="ec" value={cur.color ?? COLORS.black} onChange={(c) => upd(cur.id, { color: c })} options={(Object.entries(COLORS) as [string, string][]).map(([n, v]) => ({ value: v, label: n }))} /></Group>
            <label className="flex items-center gap-1.5 text-[13px] text-muted"><input type="checkbox" checked={!!cur.bold} onChange={(e) => upd(cur.id, { bold: e.target.checked })} />Bold</label>
          </>}
          <Button variant="ghost" className="ml-auto" onClick={() => { setEls((c) => c.filter((e) => e.id !== cur.id)); setSel(undefined); }}><Trash2 className="size-4" />Delete</Button>
        </motion.div>
      )}
      {bad.length > 0 && <p className="mt-2 text-[13px] text-amber-400">The built-in font can’t draw {bad.slice(0, 3).join(' ')} — they’ll show as “?”.</p>}
      <ErrorNote error={error} />
      <div ref={box} onPointerDown={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'IMG') setSel(undefined); }}
        className="relative mt-4 overflow-hidden rounded-lg bg-white shadow-[0_20px_60px_-25px_rgb(0_0_0/0.6)] select-none">
        {url ? <img src={url} alt={`Page ${page}`} className="block w-full" draggable={false} /> : <div className="aspect-[3/4]" />}
        {els.filter((e) => e.page === page).map((e) => <Item key={e.id} e={e} k={k} on={sel === e.id} container={box} onSelect={() => setSel(e.id)} onChange={(p) => upd(e.id, p)} />)}
      </div>
      <Done show={!!done} title="Saved — downloading" detail={done} onAgain={() => { reset(); setEls([]); setDone(undefined); }} />
    </div>
  );
}

function Item({ e, k, on, container, onSelect, onChange }: { e: El; k: number; on: boolean; container: React.RefObject<HTMLDivElement | null>; onSelect: () => void; onChange: (p: Partial<El>) => void }) {
  const drag = (ev: React.PointerEvent, mode: 'move' | 'size') => {
    ev.stopPropagation(); ev.preventDefault(); onSelect();
    const r = container.current!.getBoundingClientRect(), sx = ev.clientX, sy = ev.clientY, s = { ...e };
    const mv = (m: PointerEvent) => {
      const dx = (m.clientX - sx) / r.width, dy = (m.clientY - sy) / r.height;
      if (mode === 'move') onChange({ fx: Math.min(1 - s.fw, Math.max(0, s.fx + dx)), fy: Math.min(1 - s.fh, Math.max(0, s.fy + dy)) });
      else onChange({ fw: Math.max(0.02, Math.min(1 - s.fx, s.fw + dx)), fh: Math.max(0.01, Math.min(1 - s.fy, s.fh + dy)) });
    };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };
  const style = { left: `${e.fx * 100}%`, top: `${e.fy * 100}%`, width: `${e.fw * 100}%`, height: `${e.fh * 100}%` };
  return (
    <div onPointerDown={(ev) => drag(ev, 'move')} style={style} tabIndex={0} aria-label={`${e.kind} element`}
      onKeyDown={(ev) => { const d = { ArrowLeft: [-0.005, 0], ArrowRight: [0.005, 0], ArrowUp: [0, -0.005], ArrowDown: [0, 0.005] }[ev.key]; if (d) { ev.preventDefault(); onChange({ fx: e.fx + d[0], fy: e.fy + d[1] }); } }}
      className={`absolute cursor-move touch-none ${on ? 'outline-2 outline-accent' : 'outline-1 outline-dashed outline-accent/40 hover:outline-accent/80'}`}>
      {e.kind === 'white' && <span className="block size-full bg-white" />}
      {e.kind === 'mark' && <span className="block size-full bg-yellow-300/40 mix-blend-multiply" />}
      {e.kind === 'image' && e.img && <img src={e.img.url} alt="" className="pointer-events-none size-full object-fill" draggable={false} />}
      {e.kind === 'text' && <span className="block size-full overflow-hidden leading-[1.2] whitespace-pre" style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: (e.size ?? 14) * k, color: e.color, fontWeight: e.bold ? 700 : 400 }}>{e.text}</span>}
      {on && <span onPointerDown={(ev) => drag(ev, 'size')} aria-hidden className="absolute -right-1.5 -bottom-1.5 size-3.5 cursor-nwse-resize rounded-sm border-2 border-white bg-accent" />}
    </div>
  );
}
