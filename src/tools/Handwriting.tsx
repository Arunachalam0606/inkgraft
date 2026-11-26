import '@fontsource/caveat/400.css';
import '@fontsource/caveat/600.css';
import { useEffect, useRef, useState } from 'react';
import { PDFDocument } from '@cantoo/pdf-lib';
import { Button, Done, Group, Segmented } from '../components/ui';
import { download, formatBytes } from '../lib/pdf';

type Paper = 'ruled' | 'grid' | 'plain';
const INK = { blue: '#1f3a9e', black: '#1b1c20' } as const;
const W = 1240, H = 1754; // A4 at 150 DPI

/** Small deterministic PRNG so the preview doesn't jump on every keystroke. */
function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; }; }

/** Lay the text out like handwriting on paper; returns one canvas per page. */
function writePages(text: string, o: { paper: Paper; ink: string; size: number; messy: number }) {
  const line = o.size * 1.55, left = 170, right = W - 90, top = 210;
  const pages: HTMLCanvasElement[] = [];
  let ctx!: CanvasRenderingContext2D, y = 0;
  const rand = rng(7);
  const newPage = () => {
    const c = document.createElement('canvas'); c.width = W; c.height = H; ctx = c.getContext('2d')!; pages.push(c);
    ctx.fillStyle = '#fdfcf7'; ctx.fillRect(0, 0, W, H);
    if (o.paper === 'ruled') {
      ctx.strokeStyle = '#a9c4e8'; ctx.lineWidth = 1.4;
      for (let ly = top + line * 0.25; ly < H - 80; ly += line) { ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke(); }
      ctx.strokeStyle = '#e8a3a3'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(left - 30, 0); ctx.lineTo(left - 30, H); ctx.stroke();
    } else if (o.paper === 'grid') {
      ctx.strokeStyle = '#dfe5ee'; ctx.lineWidth = 1;
      for (let g = 0; g < W; g += 40) { ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, H); ctx.stroke(); }
      for (let g = 0; g < H; g += 40) { ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(W, g); ctx.stroke(); }
    }
    y = top;
  };
  newPage();
  const font = (k: number) => `${600} ${Math.round(o.size * k)}px Caveat, cursive`;
  for (const para of text.replace(/\r/g, '').split('\n')) {
    let x = left + (rand() - 0.5) * 6 * o.messy;
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const k = 1 + (rand() - 0.5) * 0.08 * o.messy;
      ctx.font = font(k);
      const w = ctx.measureText(word).width;
      if (x + w > right && x > left + 10) { y += line; x = left + (rand() - 0.5) * 6 * o.messy; }
      if (y > H - 120) { newPage(); x = left; ctx.font = font(k); }
      ctx.save();
      ctx.translate(x, y + (rand() - 0.5) * 4 * o.messy);
      ctx.rotate(((rand() - 0.5) * 1.6 * o.messy * Math.PI) / 180);
      ctx.fillStyle = o.ink; ctx.globalAlpha = 0.86 + rand() * 0.14; // ink density varies a little
      ctx.fillText(word, 0, 0);
      ctx.restore();
      x += w + o.size * (0.28 + rand() * 0.08 * o.messy);
    }
    y += line;
    if (y > H - 120) newPage();
  }
  return pages;
}

const SAMPLE = 'Dear Priya,\n\nThank you for the lovely notes from the workshop. I have copied the key points below so we can review them on Monday.\n\n1. Ship the scan editor\n2. Test the GST invoice with real bills\n3. Keep everything private and on-device\n\nSee you soon,\nSam';

export function Handwriting() {
  const [text, setText] = useState(SAMPLE);
  const [paper, setPaper] = useState<Paper>('ruled');
  const [ink, setInk] = useState<keyof typeof INK>('blue');
  const [size, setSize] = useState(46);
  const [messy, setMessy] = useState(1);
  const [ready, setReady] = useState(false);
  const [pages, setPages] = useState(0);
  const [done, setDone] = useState<string>();
  const preview = useRef<HTMLCanvasElement>(null);

  useEffect(() => { void document.fonts.load('600 40px Caveat').then(() => setReady(true)); }, []);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      const out = writePages(text || ' ', { paper, ink: INK[ink], size, messy });
      setPages(out.length);
      const c = preview.current!; c.width = W / 2; c.height = H / 2;
      c.getContext('2d')!.drawImage(out[0], 0, 0, W / 2, H / 2);
    }, 150);
    return () => clearTimeout(t);
  }, [text, paper, ink, size, messy, ready]);

  const save = async () => {
    const doc = await PDFDocument.create();
    for (const c of writePages(text, { paper, ink: INK[ink], size, messy })) {
      const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.88));
      const img = await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      doc.addPage([595.28, 841.89]).drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
    }
    const out = await doc.save();
    download(out, 'handwritten.pdf'); setDone(`${doc.getPageCount()} page(s) · ${formatBytes(out.length)} · handwritten.pdf`);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <div className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} aria-label="Text to write" className="w-full resize-y rounded-xl border border-line-strong bg-bg p-4 text-[14px] leading-relaxed outline-none focus:border-accent" />
        <div className="flex flex-wrap gap-4">
          <Group label="Paper"><Segmented id="paper" value={paper} onChange={setPaper} options={[{ value: 'ruled', label: 'Ruled' }, { value: 'grid', label: 'Grid' }, { value: 'plain', label: 'Plain' }]} /></Group>
          <Group label="Ink"><Segmented id="ink" value={ink} onChange={setInk} options={[{ value: 'blue', label: 'Blue' }, { value: 'black', label: 'Black' }]} /></Group>
        </div>
        <label className="block text-[13px] text-muted">Size · {size}px<input type="range" min={32} max={64} value={size} onChange={(e) => setSize(+e.target.value)} className="mt-1 w-full accent-[var(--accent)]" /></label>
        <label className="block text-[13px] text-muted">Messiness · {Math.round(messy * 100)}%<input type="range" min={0} max={2} step={0.1} value={messy} onChange={(e) => setMessy(+e.target.value)} className="mt-1 w-full accent-[var(--accent)]" /></label>
        <Button onClick={save} disabled={!text.trim() || !ready} className="w-full">Download PDF · {pages} page{pages === 1 ? '' : 's'}</Button>
        <p className="text-[12px] text-faint">Uses the Caveat handwriting font with small random wobbles in baseline, angle, size and ink. Latin script.</p>
        <Done show={!!done} title="Written — downloading" detail={done} onAgain={() => setDone(undefined)} />
      </div>
      <div className="lg:sticky lg:top-6 lg:self-start"><p className="mb-2 text-[12px] text-faint">Preview · page 1</p><canvas ref={preview} aria-label="Handwriting preview" className="w-full rounded-lg shadow-[0_20px_60px_-25px_rgb(0_0_0/0.6)]" /></div>
    </div>
  );
}
