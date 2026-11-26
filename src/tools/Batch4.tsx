import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PDFDocument } from '@cantoo/pdf-lib';
import { OpTool } from '../components/OpTool';
import { Button, Done, Dropzone, ErrorNote, FileChip, Group, Segmented, inputCls } from '../components/ui';
import { useSinglePdf } from '../components/pages';
import { baseName, download, formatBytes, openPdf, readBytes, renderPage } from '../lib/pdf';
import { buildFrom } from '../lib/ops';
import { findPii, type PiiKind, type Word } from '../lib/pii';
import { ocrWorker, ocrWords, rasterize, textWords, type FRect } from '../lib/raster';

// ---------- Invert colours ----------
const FILTERS = {
  dark: { label: 'Dark mode', css: 'invert(1) hue-rotate(180deg)' },
  sepia: { label: 'Sepia', css: 'sepia(0.75) contrast(0.95) brightness(1.02)' },
  contrast: { label: 'High contrast', css: 'grayscale(1) contrast(1.8)' },
  gray: { label: 'Greyscale', css: 'grayscale(1)' },
} as const;
type FilterKey = keyof typeof FILTERS;
const firstPageRaster = async (bytes: Uint8Array, filter: string) => {
  const one = await buildFrom(bytes, [{ index: 0 }]);
  const doc = await openPdf(one);
  try { return await rasterize(doc, { dpi: 90, filter }); } finally { void doc.loadingTask.destroy(); }
};
export function Invert() {
  const [f, setF] = useState<FilterKey>('dark');
  return <OpTool action={`Convert to ${FILTERS[f].label.toLowerCase()}`} previewKey={f} preview={(b) => firstPageRaster(b, FILTERS[f].css)}
    note="Pages are re-rendered as images, so text in the result isn’t selectable."
    options={() => <Group label="Style"><Segmented id="inv" value={f} onChange={setF} options={(Object.keys(FILTERS) as FilterKey[]).map((k) => ({ value: k, label: FILTERS[k].label }))} /></Group>}
    run={async (p) => ({ data: await rasterize(p.doc, { dpi: 150, filter: FILTERS[f].css }), name: `${baseName(p.file.name)}-${f}.pdf` })} />;
}

// ---------- Redaction (manual + automatic) ----------
interface Box extends FRect { id: number; page: number; label?: string; on: boolean }
let bid = 0;
const KINDS: PiiKind[] = ['Aadhaar', 'PAN', 'Card', 'Account', 'IFSC', 'Phone', 'Email'];

function PageCanvas({ doc, page, boxes, onAdd, onToggle }: { doc: Awaited<ReturnType<typeof openPdf>>; page: number; boxes: Box[]; onAdd: (r: FRect) => void; onToggle: (id: number) => void }) {
  const [url, setUrl] = useState<string>();
  const [draft, setDraft] = useState<FRect>();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { let a = true; renderPage(doc, page, { width: 820 }).then((c) => a && setUrl(c.toDataURL('image/jpeg', 0.85))); return () => { a = false; }; }, [doc, page]);
  const at = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }; };
  const start = useRef<{ x: number; y: number } | undefined>(undefined);
  return (
    <div ref={ref} className="relative cursor-crosshair touch-none overflow-hidden rounded-lg bg-white shadow-[0_20px_60px_-25px_rgb(0_0_0/0.6)] select-none"
      onPointerDown={(e) => { if ((e.target as HTMLElement).dataset.box) return; ref.current!.setPointerCapture(e.pointerId); start.current = at(e); setDraft({ ...start.current, w: 0, h: 0 }); }}
      onPointerMove={(e) => { if (!start.current) return; const p = at(e), s = start.current; setDraft({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) }); }}
      onPointerUp={() => { if (draft && draft.w > 0.005 && draft.h > 0.004) onAdd(draft); start.current = undefined; setDraft(undefined); }}>
      {url ? <img src={url} alt={`Page ${page}`} className="block w-full" draggable={false} /> : <div className="aspect-[3/4]" />}
      {boxes.map((b) => (
        <button key={b.id} data-box="1" onClick={() => onToggle(b.id)} title={b.label ? `${b.label} — click to ${b.on ? 'keep' : 'redact'}` : 'Click to remove'}
          className={`absolute transition-colors ${b.on ? 'bg-black/85 ring-1 ring-rose-400' : 'bg-transparent ring-2 ring-dashed ring-amber-400'}`}
          style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }} aria-label={b.label ?? 'Redaction box'} />
      ))}
      {draft && <span className="pointer-events-none absolute bg-black/60 ring-1 ring-rose-400" style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.w * 100}%`, height: `${draft.h * 100}%` }} />}
    </div>
  );
}

function RedactTool({ auto }: { auto: boolean }) {
  const { pdf, error, open, reset, setError } = useSinglePdf();
  const [page, setPage] = useState(1);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [words, setWords] = useState<Record<number, Word[]>>();
  const [scan, setScan] = useState<{ n: number; ocr: boolean }>();
  const [kinds, setKinds] = useState<PiiKind[]>(KINDS);
  const [term, setTerm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string>();

  // collect words on every page: the PDF's text, or OCR when a page has none (scans)
  const readWords = async () => {
    if (!pdf) return {};
    const all: Record<number, Word[]> = {};
    let worker: Awaited<ReturnType<typeof ocrWorker>> | undefined;
    try {
      for (let n = 1; n <= pdf.count; n++) {
        let w = await textWords(pdf.doc, n);
        const ocr = w.length < 3;
        setScan({ n, ocr });
        if (ocr) { worker ??= await ocrWorker(); w = await ocrWords(pdf.doc, n, worker); }
        all[n] = w;
      }
    } finally { await worker?.terminate(); setScan(undefined); }
    setWords(all);
    return all;
  };
  const detect = async () => {
    const all = words ?? (await readWords());
    const found: Box[] = [];
    for (const [n, w] of Object.entries(all)) for (const h of findPii(w, kinds)) for (const b of h.boxes) found.push({ id: bid++, page: +n, x: b.x - 0.002, y: b.y - 0.002, w: b.w + 0.004, h: b.h + 0.004, label: `${h.kind}: ${h.text}`, on: true });
    setBoxes((cur) => [...cur.filter((b) => !b.label?.match(/^(Aadhaar|PAN|Card|Account|IFSC|Phone|Email):/)), ...found]);
    if (!found.length) setError('No personal data of the selected kinds was found.'); else setError(undefined);
  };
  const findTerm = async () => {
    const q = term.trim().toLowerCase(); if (!q) return;
    const all = words ?? (await readWords());
    const found: Box[] = [];
    for (const [n, w] of Object.entries(all)) w.forEach((x) => { if (x.text.toLowerCase().includes(q)) found.push({ id: bid++, page: +n, x: x.x - 0.002, y: x.y - 0.002, w: x.w + 0.004, h: x.h + 0.004, label: `“${x.text}”`, on: true }); });
    setBoxes((c) => [...c, ...found]);
    setError(found.length ? undefined : `“${term}” wasn’t found.`);
  };
  useEffect(() => { if (pdf && auto) void detect(); }, [pdf]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = async () => {
    if (!pdf) return;
    setBusy(true);
    try {
      const byPage: Record<number, FRect[]> = {};
      boxes.filter((b) => b.on).forEach((b) => (byPage[b.page] ??= []).push(b));
      const out = await rasterize(pdf.doc, { dpi: 150, boxes: byPage });
      const name = `${baseName(pdf.file.name)}-redacted.pdf`;
      download(out, name);
      setDone(`${boxes.filter((b) => b.on).length} areas blacked out on ${Object.keys(byPage).length} page(s) · ${formatBytes(out.length)} · ${name}`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const again = () => { reset(); setBoxes([]); setWords(undefined); setDone(undefined); setPage(1); };

  const counts = useMemo(() => boxes.reduce<Record<string, number>>((a, b) => { const k = b.label?.split(':')[0] ?? 'Manual'; a[k] = (a[k] ?? 0) + (b.on ? 1 : 0); return a; }, {}), [boxes]);
  if (!pdf) return <><Dropzone onFiles={([f]) => open(f)} hint={auto ? 'Text PDFs and scans (scans are read with on-device OCR)' : undefined} /><ErrorNote error={error} /></>;
  const on = boxes.filter((b) => b.on).length;
  return (
    <div>
      <FileChip file={pdf.file} extra={` · ${pdf.count} pages`} onRemove={again} />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className="space-y-5 rounded-2xl border border-line bg-surface p-5 lg:sticky lg:top-6 lg:self-start">
          {auto && <>
            <Group label="Look for">
              <div className="flex flex-wrap gap-1.5">{KINDS.map((k) => (
                <button key={k} aria-pressed={kinds.includes(k)} onClick={() => setKinds((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]))}
                  className={`rounded-full border px-3 py-1 text-[12.5px] transition-colors ${kinds.includes(k) ? 'border-accent bg-accent/15 text-fg' : 'border-line text-muted'}`}>{k}</button>))}</div>
            </Group>
            <Button variant="ghost" onClick={detect} disabled={!!scan} className="w-full">Scan again</Button>
          </>}
          <div className="flex gap-2"><input value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && findTerm()} placeholder="Find text to black out" aria-label="Text to redact" className={inputCls} />
            <Button variant="ghost" onClick={findTerm} disabled={!term.trim() || !!scan}><Search className="size-4" /></Button></div>
          <p className="text-[13px] text-muted">Drag on the page to draw a box. Click a box to switch it off.</p>
          {scan && <p className="text-[13px] text-ink" aria-live="polite">{scan.ocr ? 'Reading scanned' : 'Reading'} page {scan.n} of {pdf.count}…</p>}
          {Object.keys(counts).length > 0 && <ul className="space-y-1 text-[13px]">{Object.entries(counts).map(([k, v]) => <li key={k} className="flex justify-between"><span className="text-muted">{k}</span><span className="tabular-nums">{v}</span></li>)}</ul>}
          <Button busy={busy} disabled={!on || !!scan} onClick={apply} className="w-full">Redact {on} area{on === 1 ? '' : 's'}</Button>
          <p className="text-[12px] text-faint">Pages are rebuilt as images with the boxes burned in, so the hidden text is truly gone — not just covered.</p>
          <ErrorNote error={error} />
        </div>
        <div>
          <div className="mb-3 flex items-center justify-between text-[13px]">
            <span className="text-muted">{boxes.filter((b) => b.page === page).length} box(es) on this page</span>
            <span className="flex items-center gap-1">
              <button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg p-1.5 hover:bg-surface-2 disabled:opacity-30"><ChevronLeft className="size-4" /></button>
              <span className="tabular-nums">Page {page} / {pdf.count}</span>
              <button aria-label="Next page" disabled={page >= pdf.count} onClick={() => setPage((p) => p + 1)} className="rounded-lg p-1.5 hover:bg-surface-2 disabled:opacity-30"><ChevronRight className="size-4" /></button>
            </span>
          </div>
          <PageCanvas doc={pdf.doc} page={page} boxes={boxes.filter((b) => b.page === page)}
            onAdd={(r) => setBoxes((c) => [...c, { ...r, id: bid++, page, on: true }])}
            onToggle={(id) => setBoxes((c) => c.flatMap((b) => (b.id !== id ? [b] : b.label ? [{ ...b, on: !b.on }] : [])))} />
        </div>
      </div>
      <Done show={!!done} title="Redacted — downloading" detail={done} onAgain={again} />
    </div>
  );
}
export const Redact = () => <RedactTool auto={false} />;
export const AutoRedact = () => <RedactTool auto />;

// ---------- Compare ----------
async function diffPage(a: Awaited<ReturnType<typeof openPdf>>, b: Awaited<ReturnType<typeof openPdf>>, n: number) {
  const [ca, cb] = await Promise.all([n <= a.numPages ? renderPage(a, n, { width: 600 }) : null, n <= b.numPages ? renderPage(b, n, { width: 600 }) : null]);
  const W = Math.max(ca?.width ?? 0, cb?.width ?? 0), H = Math.max(ca?.height ?? 0, cb?.height ?? 0);
  const grab = (c: HTMLCanvasElement | null) => { const x = document.createElement('canvas'); x.width = W; x.height = H; const g = x.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); if (c) g.drawImage(c, 0, 0); return g.getImageData(0, 0, W, H); };
  const da = grab(ca), db = grab(cb);
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const g = out.getContext('2d')!; const od = g.createImageData(W, H);
  let changed = 0;
  for (let i = 0; i < da.data.length; i += 4) {
    const d = Math.abs(da.data[i] - db.data[i]) + Math.abs(da.data[i + 1] - db.data[i + 1]) + Math.abs(da.data[i + 2] - db.data[i + 2]);
    const l = (db.data[i] + db.data[i + 1] + db.data[i + 2]) / 3;
    if (d > 60) { changed++; od.data[i] = 235; od.data[i + 1] = 40; od.data[i + 2] = 70; od.data[i + 3] = 255; }
    else { const f = 0.25 * l + 190; od.data[i] = od.data[i + 1] = od.data[i + 2] = f; od.data[i + 3] = 255; }
  }
  g.putImageData(od, 0, 0);
  return { url: out.toDataURL('image/png'), a: ca?.toDataURL('image/jpeg', 0.8), b: cb?.toDataURL('image/jpeg', 0.8), pct: changed / (W * H) };
}
export function Compare() {
  const [fa, setFa] = useState<File>();
  const [fb, setFb] = useState<File>();
  const [docs, setDocs] = useState<[Awaited<ReturnType<typeof openPdf>>, Awaited<ReturnType<typeof openPdf>>]>();
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<Awaited<ReturnType<typeof diffPage>>>();
  const [error, setError] = useState<string>();
  useEffect(() => { if (!fa || !fb) return; Promise.all([readBytes(fa).then(openPdf), readBytes(fb).then(openPdf)]).then((d) => { setDocs(d); setPage(1); }).catch(() => setError('One of the files couldn’t be opened.')); }, [fa, fb]);
  useEffect(() => { if (docs) { setRes(undefined); diffPage(docs[0], docs[1], page).then(setRes); } }, [docs, page]);
  const slot = (label: string, f: File | undefined, set: (f?: File) => void) => f ? <FileChip file={f} onRemove={() => { set(undefined); setDocs(undefined); }} /> : <Dropzone onFiles={([x]) => set(x)} label={`Drop the ${label}`} />;
  const pages = docs ? Math.max(docs[0].numPages, docs[1].numPages) : 0;
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">{slot('original', fa, setFa)}{slot('changed version', fb, setFb)}</div>
      <ErrorNote error={error} />
      {docs && (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <span className={res && res.pct > 0.0005 ? 'text-rose-400' : 'text-emerald-400'}>{res ? (res.pct > 0.0005 ? `${(res.pct * 100).toFixed(2)}% of this page changed` : 'No visible differences on this page') : 'Comparing…'}{docs[0].numPages !== docs[1].numPages && <span className="text-amber-400"> · page counts differ ({docs[0].numPages} vs {docs[1].numPages})</span>}</span>
            <span className="flex items-center gap-1">
              <button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg p-1.5 hover:bg-surface-2 disabled:opacity-30"><ChevronLeft className="size-4" /></button>
              <span className="tabular-nums">Page {page} / {pages}</span>
              <button aria-label="Next page" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg p-1.5 hover:bg-surface-2 disabled:opacity-30"><ChevronRight className="size-4" /></button>
            </span>
          </div>
          {res && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-4 md:grid-cols-3">
            {([['Original', res.a], ['Changed', res.b], ['Differences', res.url]] as const).map(([t, u]) => (
              <figure key={t}><figcaption className="mb-1.5 text-[12px] text-faint">{t}</figcaption>
                {u ? <img src={u} alt={`${t}, page ${page}`} className="w-full rounded-lg bg-white" /> : <div className="grid aspect-[3/4] place-items-center rounded-lg border border-dashed border-line text-[13px] text-faint">No page</div>}</figure>))}
          </motion.div>}
        </div>
      )}
    </div>
  );
}

// ---------- Repair ----------
export function Repair() {
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [done, setDone] = useState<string>();
  const run = async (f: File) => {
    setFile(f); setBusy(true); setLog([]); setDone(undefined);
    const say = (s: string) => setLog((l) => [...l, s]);
    const bytes = await readBytes(f);
    const name = `${baseName(f.name)}-repaired.pdf`;
    try {
      say('Rebuilding the file structure…');
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false, updateMetadata: false });
      const out = await PDFDocument.create();
      (await out.copyPages(doc, doc.getPageIndices())).forEach((p) => out.addPage(p));
      const saved = await out.save();
      say(`Rebuilt ${out.getPageCount()} pages. Checking it opens…`);
      const check = await openPdf(saved); await check.getPage(1); void check.loadingTask.destroy();
      download(saved, name); setDone(`Structure rebuilt · ${out.getPageCount()} pages · ${formatBytes(saved.length)} · ${name}`); setBusy(false); return;
    } catch (e) { say(`Structure rebuild failed (${(e as Error).message.slice(0, 80)}). Trying page by page…`); }
    try {
      const doc = await openPdf(bytes);
      say(`pdf.js can read ${doc.numPages} pages — re-rendering them…`);
      const saved = await rasterize(doc, { dpi: 150 });
      download(saved, name); setDone(`Recovered by re-rendering · ${doc.numPages} pages · ${formatBytes(saved.length)} · ${name} (text becomes image)`);
    } catch (e) { say(`Couldn’t recover this file: ${(e as Error).message.slice(0, 120)}`); }
    setBusy(false);
  };
  return (
    <div>
      {file ? <FileChip file={file} onRemove={() => { setFile(undefined); setLog([]); setDone(undefined); }} /> : <Dropzone onFiles={([f]) => run(f)} />}
      {log.length > 0 && <ol className="mt-6 max-w-[640px] space-y-1.5 rounded-2xl border border-line bg-surface p-5 font-mono text-[12.5px] text-muted">{log.map((l, i) => <motion.li key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}>{l}</motion.li>)}{busy && <li className="animate-pulse">…</li>}</ol>}
      <Done show={!!done} title="Repaired — downloading" detail={done} onAgain={() => { setFile(undefined); setLog([]); setDone(undefined); }} />
    </div>
  );
}

