import { AnimatePresence, motion } from 'motion/react';
import { Camera, ImagePlus, RotateCw, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PDFDocument } from '@cantoo/pdf-lib';
import { Button, Done, ErrorNote, Group, Segmented } from '../components/ui';
import { download, formatBytes } from '../lib/pdf';
import { enhance, warp, type Pt } from '../lib/warp';

type Mode = 'color' | 'gray' | 'doc';
interface Shot { id: number; img: HTMLCanvasElement; corners: Pt[]; mode: Mode; rotate: number; thumb: string }
let sid = 0;
const MAX = 2000; // longest side kept from a photo: enough for 150 DPI A4, light on memory

const fromSource = (src: CanvasImageSource, w: number, h: number) => {
  const k = Math.min(1, MAX / Math.max(w, h)), c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
  return c;
};
const defaultCorners = (c: HTMLCanvasElement): Pt[] => { const ix = c.width * 0.06, iy = c.height * 0.06; return [[ix, iy], [c.width - ix, iy], [c.width - ix, c.height - iy], [ix, c.height - iy]]; };

/** Straighten, clean up and rotate one shot into an A4-shaped canvas. */
function render(s: Shot, W = 1240, H = 1754) {
  const ctx = s.img.getContext('2d')!;
  const src = ctx.getImageData(0, 0, s.img.width, s.img.height);
  const px = enhance(warp(src, s.corners, W, H), W, H, s.mode);
  const flat = document.createElement('canvas'); flat.width = W; flat.height = H;
  flat.getContext('2d')!.putImageData(new ImageData(px, W, H), 0, 0);
  if (!(s.rotate % 360)) return flat;
  const side = s.rotate % 180 !== 0, out = document.createElement('canvas');
  out.width = side ? H : W; out.height = side ? W : H;
  const o = out.getContext('2d')!; o.translate(out.width / 2, out.height / 2); o.rotate((s.rotate * Math.PI) / 180); o.drawImage(flat, -W / 2, -H / 2);
  return out;
}

function CornerEditor({ shot, onChange }: { shot: Shot; onChange: (c: Pt[]) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const url = useRef(shot.img.toDataURL('image/jpeg', 0.8));
  const drag = (i: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    const r = ref.current!.getBoundingClientRect(), kx = shot.img.width / r.width, ky = shot.img.height / r.height;
    const mv = (m: PointerEvent) => onChange(shot.corners.map((p, k) => (k === i ? [Math.min(shot.img.width, Math.max(0, (m.clientX - r.left) * kx)), Math.min(shot.img.height, Math.max(0, (m.clientY - r.top) * ky))] : p)) as Pt[]);
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };
  const pct = (p: Pt) => [(p[0] / shot.img.width) * 100, (p[1] / shot.img.height) * 100];
  const poly = shot.corners.map((p) => pct(p).join(',')).join(' ');
  return (
    <div ref={ref} className="relative touch-none overflow-hidden rounded-lg select-none">
      <img src={url.current} alt="Captured page" className="block w-full" draggable={false} />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full">
        <polygon points={poly} fill="rgb(124 147 255 / 0.14)" stroke="#7c93ff" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
      </svg>
      {shot.corners.map((p, i) => { const [x, y] = pct(p); return (
        <button key={i} onPointerDown={drag(i)} aria-label={`Corner ${['top left', 'top right', 'bottom right', 'bottom left'][i]}`}
          className="absolute size-7 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-white bg-accent shadow-lg active:cursor-grabbing" style={{ left: `${x}%`, top: `${y}%` }} />
      ); })}
    </div>
  );
}

export function Scanner() {
  const [shots, setShots] = useState<Shot[]>([]);
  const [cur, setCur] = useState<number>();
  const [cam, setCam] = useState<MediaStream>();
  const [preview, setPreview] = useState<string>();
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();
  const [busy, setBusy] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const files = useRef<HTMLInputElement>(null);
  const shot = shots.find((s) => s.id === cur);

  useEffect(() => { if (video.current && cam) video.current.srcObject = cam; }, [cam]);
  useEffect(() => () => cam?.getTracks().forEach((t) => t.stop()), [cam]);
  useEffect(() => {
    if (!shot) { setPreview(undefined); return; }
    const t = setTimeout(() => setPreview(render(shot, 620, 877).toDataURL('image/jpeg', 0.85)), 120);
    return () => clearTimeout(t);
  }, [shot]);

  const add = (c: HTMLCanvasElement) => { const s: Shot = { id: sid++, img: c, corners: defaultCorners(c), mode: 'doc', rotate: 0, thumb: c.toDataURL('image/jpeg', 0.5) }; setShots((x) => [...x, s]); setCur(s.id); };
  const startCam = async () => {
    setError(undefined);
    try { setCam(await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })); }
    catch { setError('Camera unavailable or permission denied — you can add photos instead.'); }
  };
  const capture = () => { const v = video.current!; add(fromSource(v, v.videoWidth, v.videoHeight)); };
  const addFiles = async (list: FileList | null) => { for (const f of Array.from(list ?? [])) { const b = await createImageBitmap(f); add(fromSource(b, b.width, b.height)); } };
  const upd = (patch: Partial<Shot>) => setShots((all) => all.map((s) => (s.id === cur ? { ...s, ...patch } : s)));

  const save = async () => {
    setBusy(true);
    try {
      const doc = await PDFDocument.create();
      for (const s of shots) {
        const c = render(s);
        const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', s.mode === 'color' ? 0.82 : 0.75));
        const img = await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
        const [w, h] = c.width > c.height ? [841.89, 595.28] : [595.28, 841.89];
        doc.addPage([w, h]).drawImage(img, { x: 0, y: 0, width: w, height: h });
      }
      const out = await doc.save();
      download(out, 'scan.pdf'); setDone(`${shots.length} page${shots.length > 1 ? 's' : ''} · ${formatBytes(out.length)} · scan.pdf`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {cam ? <Button onClick={() => { cam.getTracks().forEach((t) => t.stop()); setCam(undefined); }} variant="ghost"><X className="size-4" />Close camera</Button>
          : <Button onClick={startCam}><Camera className="size-4" />Use camera</Button>}
        <Button variant="ghost" onClick={() => files.current?.click()}><ImagePlus className="size-4" />Add photos</Button>
        <input ref={files} type="file" accept="image/*" multiple hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }} />
        {shots.length > 0 && <Button className="ml-auto" busy={busy} onClick={save}>Save PDF · {shots.length} page{shots.length > 1 ? 's' : ''}</Button>}
      </div>
      <ErrorNote error={error} />
      <AnimatePresence>
        {cam && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="relative overflow-hidden rounded-2xl bg-black">
            <video ref={video} autoPlay playsInline muted className="block max-h-[60vh] w-full object-contain" />
            <button onClick={capture} aria-label="Capture page" className="absolute bottom-5 left-1/2 grid size-16 -translate-x-1/2 place-items-center rounded-full border-4 border-white/80 bg-white/20 backdrop-blur transition-transform active:scale-90"><span className="size-11 rounded-full bg-white" /></button>
          </motion.div>
        )}
      </AnimatePresence>
      {shots.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
          {shots.map((s, i) => (
            <button key={s.id} onClick={() => setCur(s.id)} className={`relative w-20 shrink-0 overflow-hidden rounded-lg border-2 ${s.id === cur ? 'border-accent' : 'border-transparent'}`} aria-label={`Page ${i + 1}`}>
              <img src={s.thumb} alt="" className="aspect-[3/4] w-full object-cover" /><span className="absolute bottom-0.5 left-1 text-[11px] font-semibold text-white drop-shadow">{i + 1}</span>
            </button>
          ))}
        </div>
      )}
      {shot && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-[13px] text-muted">Drag the four corners onto the edges of the paper</p>
            <CornerEditor key={shot.id} shot={shot} onChange={(corners) => upd({ corners })} />
          </div>
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <Group label="Filter"><Segmented id="scan-mode" value={shot.mode} onChange={(mode) => upd({ mode })} options={[{ value: 'doc', label: 'Document' }, { value: 'gray', label: 'Grey' }, { value: 'color', label: 'Colour' }]} /></Group>
              <Button variant="ghost" onClick={() => upd({ rotate: shot.rotate + 90 })}><RotateCw className="size-4" />Rotate</Button>
              <Button variant="ghost" onClick={() => { setShots((all) => all.filter((x) => x.id !== shot.id)); setCur(shots.find((x) => x.id !== shot.id)?.id); }}><Trash2 className="size-4" />Remove</Button>
            </div>
            <div className="grid min-h-[300px] place-items-center rounded-2xl border border-line bg-surface-2 p-3">
              {preview ? <img src={preview} alt="Straightened page" className="max-h-[70vh] rounded shadow-lg" /> : <span className="size-6 animate-pulse rounded-full bg-line-strong" />}
            </div>
          </div>
        </div>
      )}
      {!shots.length && !cam && <p className="text-[14px] text-muted">Photograph each page flat on a darker surface, then fine-tune the corners. Everything — the camera feed included — stays on this device.</p>}
      <Done show={!!done} title="Scanned — downloading" detail={done} onAgain={() => { setShots([]); setCur(undefined); setDone(undefined); }} />
    </div>
  );
}
