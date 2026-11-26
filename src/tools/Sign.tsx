import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Eraser, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button, Done, Dropzone, ErrorNote, FileChip, Group, Segmented, inputCls } from '../components/ui';
import { useSinglePdf } from '../components/pages';
import { baseName, download, formatBytes, renderPage } from '../lib/pdf';
import { stampImage } from '../lib/ops';

const INKS = { black: '#111318', blue: '#1d3fbf' } as const;
type Ink = keyof typeof INKS;
// a placed signature: page (1-based) and box as fractions of the rendered page
interface Placed { id: number; page: number; fx: number; fy: number; fw: number }
let seq = 0;

/** Crop a canvas to its inked pixels and return a PNG blob and aspect ratio. */
async function trimToPng(src: HTMLCanvasElement) {
  const { width: w, height: h } = src;
  const d = src.getContext('2d')!.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) return null;
  const pad = 6, cw = x1 - x0 + 1 + pad * 2, ch = y1 - y0 + 1 + pad * 2;
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  c.getContext('2d')!.drawImage(src, x0 - pad, y0 - pad, cw, ch, 0, 0, cw, ch);
  const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'));
  return { blob, url: URL.createObjectURL(blob), aspect: ch / cw };
}

function DrawPad({ ink, onChange }: { ink: Ink; onChange: (c: HTMLCanvasElement | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number; mx: number; my: number } | null>(null);
  const [empty, setEmpty] = useState(true);
  useEffect(() => {
    const c = ref.current!; const r = c.getBoundingClientRect();
    c.width = r.width * 2; c.height = r.height * 2;
  }, []);
  const pt = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return { x: (e.clientX - r.left) * 2, y: (e.clientY - r.top) * 2 }; };
  const down = (e: React.PointerEvent) => { ref.current!.setPointerCapture(e.pointerId); const p = pt(e); last.current = { ...p, mx: p.x, my: p.y }; };
  const move = (e: React.PointerEvent) => {
    if (!last.current) return;
    const ctx = ref.current!.getContext('2d')!, p = pt(e), l = last.current;
    const mx = (l.x + p.x) / 2, my = (l.y + p.y) / 2;
    ctx.strokeStyle = INKS[ink]; ctx.lineCap = ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, 6 - Math.hypot(p.x - l.x, p.y - l.y) / 12); // faster strokes come out thinner, like a pen
    ctx.beginPath(); ctx.moveTo(l.mx, l.my); ctx.quadraticCurveTo(l.x, l.y, mx, my); ctx.stroke();
    last.current = { ...p, mx, my };
    if (empty) setEmpty(false);
  };
  const up = () => { if (last.current) { last.current = null; onChange(ref.current); } };
  const clear = () => { const c = ref.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setEmpty(true); onChange(null); };
  return (
    <div className="relative">
      <canvas ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="Signature pad: draw with mouse, pen or finger"
        className="h-44 w-full touch-none rounded-xl border border-line-strong bg-white" />
      {empty && <span className="pointer-events-none absolute inset-0 grid place-items-center text-[14px] text-neutral-400">Sign here</span>}
      <span className="pointer-events-none absolute right-6 bottom-10 left-6 border-b border-dashed border-neutral-300" />
      <button onClick={clear} className="absolute top-2 right-2 flex items-center gap-1 rounded-lg bg-neutral-100 px-2 py-1 text-[12px] text-neutral-600 hover:bg-neutral-200"><Eraser className="size-3.5" />Clear</button>
    </div>
  );
}

function typed(name: string, ink: Ink) {
  const c = document.createElement('canvas'); c.width = 1400; c.height = 360;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = INKS[ink]; ctx.font = 'italic 200px "Instrument Serif", Georgia, serif'; ctx.textBaseline = 'middle';
  ctx.fillText(name, 30, 180, 1340);
  return c;
}

export default function Sign() {
  const { pdf, error, open, reset, setError } = useSinglePdf();
  const [mode, setMode] = useState<'draw' | 'type'>('draw');
  const [ink, setInk] = useState<Ink>('black');
  const [name, setName] = useState('');
  const [drawn, setDrawn] = useState<HTMLCanvasElement | null>(null);
  const [sig, setSig] = useState<{ blob: Blob; url: string; aspect: number } | null>(null);
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<string>();
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string>();
  const box = useRef<HTMLDivElement>(null);

  // rebuild the signature image whenever its source changes
  useEffect(() => {
    let alive = true;
    void (async () => {
      const src = mode === 'draw' ? drawn : name.trim() ? (await document.fonts.load('italic 200px "Instrument Serif"'), typed(name.trim(), ink)) : null;
      const out = src ? await trimToPng(src) : null;
      if (alive) setSig((old) => { if (old) URL.revokeObjectURL(old.url); return out; });
    })();
    return () => { alive = false; };
  }, [mode, drawn, name, ink]);

  useEffect(() => {
    if (!pdf) return;
    let alive = true;
    renderPage(pdf.doc, page, { width: 760 }).then((c) => { if (alive) setPreview(c.toDataURL('image/jpeg', 0.85)); });
    return () => { alive = false; };
  }, [pdf, page]);

  const place = () => setPlaced((p) => [...p, { id: seq++, page, fx: 0.55, fy: 0.78, fw: 0.3 }]);

  const save = async () => {
    if (!pdf || !sig || !placed.length) return;
    setBusy(true); setError(undefined);
    try {
      const png = new Uint8Array(await sig.blob.arrayBuffer());
      const places = await Promise.all(placed.map(async (p) => {
        const vp = (await pdf.doc.getPage(p.page)).getViewport({ scale: 1 });
        const w = p.fw * vp.width, h = w * sig.aspect;
        // viewport (top-left origin, rotation applied) -> PDF user space
        const [ax, ay] = vp.convertToPdfPoint(p.fx * vp.width, p.fy * vp.height);
        const [bx, by] = vp.convertToPdfPoint(p.fx * vp.width + w, p.fy * vp.height + h);
        return { page: p.page - 1, x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay) };
      }));
      const out = await stampImage(pdf.bytes, png, places);
      const fileName = `${baseName(pdf.file.name)}-signed.pdf`;
      download(out, fileName);
      setDone(`${placed.length} signature${placed.length > 1 ? 's' : ''} placed · ${formatBytes(out.length)} · ${fileName}`);
    } catch (e) { setError(`Couldn’t sign: ${(e as Error).message}`); } finally { setBusy(false); }
  };
  const again = () => { reset(); setPlaced([]); setDone(undefined); setPage(1); };

  if (!pdf) return <><Dropzone onFiles={([f]) => open(f)} /><ErrorNote error={error} /></>;
  const here = placed.filter((p) => p.page === page);
  return (
    <div>
      <FileChip file={pdf.file} extra={` · ${pdf.count} pages`} onRemove={again} />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="space-y-5 rounded-2xl border border-line bg-surface p-5 lg:sticky lg:top-6 lg:self-start">
          <Segmented id="sig-mode" value={mode} onChange={setMode} options={[{ value: 'draw', label: 'Draw' }, { value: 'type', label: 'Type' }]} />
          {mode === 'draw' ? <DrawPad key={ink} ink={ink} onChange={setDrawn} />
            : <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Type your name" aria-label="Your name" className={inputCls} />}
          {mode === 'type' && sig && <div className="grid h-24 place-items-center rounded-xl bg-white p-3"><img src={sig.url} alt="Typed signature" className="max-h-full" /></div>}
          <Group label="Ink"><Segmented id="sig-ink" value={ink} onChange={setInk} options={[{ value: 'black', label: 'Black' }, { value: 'blue', label: 'Blue' }]} /></Group>
          <Button variant="ghost" disabled={!sig} onClick={place} className="w-full"><Plus className="size-4" />Place on page {page}</Button>
          <Button busy={busy} disabled={!sig || !placed.length} onClick={save} className="w-full">Sign & download</Button>
          <p className="text-[12px] text-faint">A picture of your signature is added to the page. It isn’t a certificate-based digital signature.</p>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[13px] text-muted">Drag to position · drag the corner to resize</span>
            <span className="flex items-center gap-1 text-[13px]">
              <button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg p-1.5 hover:bg-surface-2 disabled:opacity-30"><ChevronLeft className="size-4" /></button>
              <span className="tabular-nums">Page {page} / {pdf.count}</span>
              <button aria-label="Next page" disabled={page >= pdf.count} onClick={() => setPage((p) => p + 1)} className="rounded-lg p-1.5 hover:bg-surface-2 disabled:opacity-30"><ChevronRight className="size-4" /></button>
            </span>
          </div>
          <div ref={box} className="relative overflow-hidden rounded-lg bg-white shadow-[0_20px_60px_-25px_rgb(0_0_0/0.6)]">
            {preview ? <img src={preview} alt={`Page ${page}`} className="block w-full select-none" draggable={false} /> : <div className="aspect-[3/4]" />}
            {sig && here.map((p) => (
              <SigBox key={p.id} p={p} url={sig.url} aspect={sig.aspect} container={box}
                onChange={(n) => setPlaced((all) => all.map((x) => (x.id === p.id ? n : x)))} onRemove={() => setPlaced((all) => all.filter((x) => x.id !== p.id))} />
            ))}
          </div>
          {placed.length > 0 && <p className="mt-3 text-[13px] text-muted">Placed on page{new Set(placed.map((p) => p.page)).size > 1 ? 's' : ''} {[...new Set(placed.map((p) => p.page))].sort((a, b) => a - b).join(', ')}</p>}
        </div>
      </div>
      <ErrorNote error={error} />
      <Done show={!!done} title="Signed — downloading" detail={done} onAgain={again} />
    </div>
  );
}

function SigBox({ p, url, aspect, container, onChange, onRemove }: {
  p: Placed; url: string; aspect: number; container: React.RefObject<HTMLDivElement | null>; onChange: (p: Placed) => void; onRemove: () => void;
}) {
  const drag = (e: React.PointerEvent, mode: 'move' | 'size') => {
    e.preventDefault(); e.stopPropagation();
    const r = container.current!.getBoundingClientRect(), sx = e.clientX, sy = e.clientY, start = { ...p };
    const mv = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / r.width, dy = (ev.clientY - sy) / r.height;
      if (mode === 'move') onChange({ ...start, fx: Math.min(1 - start.fw, Math.max(0, start.fx + dx)), fy: Math.min(1 - (start.fw * aspect * r.width) / r.height, Math.max(0, start.fy + dy)) });
      else onChange({ ...start, fw: Math.min(1 - start.fx, Math.max(0.05, start.fw + dx)) });
    };
    const upH = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', upH); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', upH);
  };
  const nudge = (e: React.KeyboardEvent) => {
    const k = { ArrowLeft: [-0.01, 0], ArrowRight: [0.01, 0], ArrowUp: [0, -0.01], ArrowDown: [0, 0.01] }[e.key];
    if (!k) return;
    e.preventDefault();
    onChange({ ...p, fx: Math.min(1 - p.fw, Math.max(0, p.fx + k[0])), fy: Math.max(0, p.fy + k[1]) });
  };
  return (
    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} tabIndex={0} onKeyDown={nudge} aria-label="Signature: arrow keys move it"
      onPointerDown={(e) => drag(e, 'move')} className="group absolute cursor-move touch-none outline-1 outline-dashed outline-accent/70 hover:outline-accent focus-visible:outline-2"
      style={{ left: `${p.fx * 100}%`, top: `${p.fy * 100}%`, width: `${p.fw * 100}%`, aspectRatio: `1 / ${aspect}` }}>
      <img src={url} alt="" className="pointer-events-none size-full" draggable={false} />
      <button onPointerDown={(e) => e.stopPropagation()} onClick={onRemove} aria-label="Remove signature" className="absolute -top-3 -right-3 grid size-6 place-items-center rounded-full bg-neutral-900 text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100"><X className="size-3.5" /></button>
      <span onPointerDown={(e) => drag(e, 'size')} aria-hidden className="absolute -right-1.5 -bottom-1.5 size-3.5 cursor-nwse-resize rounded-sm border-2 border-white bg-accent" />
    </motion.div>
  );
}
