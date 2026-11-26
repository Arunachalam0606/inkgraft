import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import JSZip from 'jszip';
import { OpTool } from '../components/OpTool';
import { Button, Done, Dropzone, ErrorNote, Field, FileChip, Group, Segmented, inputCls } from '../components/ui';
import { useSinglePdf } from '../components/pages';
import { baseName, download, formatBytes, readBytes } from '../lib/pdf';
import * as O from '../lib/ops2';

const pct = (n: number) => `${Math.round(n * 100)}%`;

// ---------- Alternate & Mix ----------
export function Interleave() {
  const [a, setA] = useState<File>();
  const [b, setB] = useState<File>();
  const [rev, setRev] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();
  const run = async () => {
    if (!a || !b) return;
    setBusy(true); setError(undefined);
    try { const out = await O.interleave(await readBytes(a), await readBytes(b), rev); download(out, 'interleaved.pdf'); setDone(`${formatBytes(out.length)} · interleaved.pdf`); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const slot = (label: string, f: File | undefined, set: (f?: File) => void) => (
    <div className="space-y-2"><p className="text-[13px] font-medium text-muted">{label}</p>
      {f ? <FileChip file={f} onRemove={() => set(undefined)} /> : <Dropzone onFiles={([x]) => set(x)} label={`Drop ${label.toLowerCase()}`} />}
    </div>
  );
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">{slot('First PDF (fronts)', a, setA)}{slot('Second PDF (backs)', b, setB)}</div>
      <div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-5">
        <label className="flex items-center gap-2.5 text-[14px] text-muted"><input type="checkbox" checked={rev} onChange={(e) => setRev(e.target.checked)} className="size-4 accent-[var(--accent)]" />Second file is in reverse order (scanned back-to-front)</label>
        <Button className="ml-auto" busy={busy} disabled={!a || !b} onClick={run}>Interleave</Button>
      </div>
      <ErrorNote error={error} />
      <Done show={!!done} title="Interleaved — downloading" detail={done} onAgain={() => { setA(undefined); setB(undefined); setDone(undefined); }} />
    </div>
  );
}

// ---------- Flip ----------
export function Flip() {
  const [dir, setDir] = useState<'h' | 'v' | 'both'>('h');
  const h = dir !== 'v', v = dir !== 'h';
  return <OpTool action="Flip pages" previewKey={dir} preview={(b) => O.flip(b, h, v)}
    options={() => <Group label="Mirror"><Segmented id="flip" value={dir} onChange={setDir} options={[{ value: 'h', label: 'Horizontally' }, { value: 'v', label: 'Vertically' }, { value: 'both', label: 'Both' }]} /></Group>}
    run={async (p) => ({ data: await O.flip(p.bytes, h, v), name: `${baseName(p.file.name)}-flipped.pdf` })} />;
}

// ---------- Pages per sheet ----------
export function NUp() {
  const [per, setPer] = useState<2 | 4 | 6 | 9 | 16>(4);
  return <OpTool action="Combine pages" previewKey={String(per)} preview={(b) => O.nUp(b, per)}
    options={(p) => <><Group label="Pages per sheet"><Segmented id="nup" value={per} onChange={setPer} options={[2, 4, 6, 9, 16].map((n) => ({ value: n as 2, label: String(n) }))} /></Group>
      <p className="text-[13px] text-muted">{p.count} pages → {Math.ceil(p.count / per)} A4 sheet{Math.ceil(p.count / per) > 1 ? 's' : ''}</p></>}
    run={async (p) => ({ data: await O.nUp(p.bytes, per), name: `${baseName(p.file.name)}-${per}up.pdf` })} />;
}

// ---------- Split pages in half ----------
export function SplitHalf() {
  const [cut, setCut] = useState<'v' | 'h'>('v');
  return <OpTool action="Split every page" previewKey={cut} preview={(b) => O.splitHalves(b, cut === 'v')}
    options={() => <Group label="Cut"><Segmented id="half" value={cut} onChange={setCut} options={[{ value: 'v', label: 'Left | Right' }, { value: 'h', label: 'Top / Bottom' }]} /></Group>}
    run={async (p) => ({ data: await O.splitHalves(p.bytes, cut === 'v'), name: `${baseName(p.file.name)}-halves.pdf`, detail: `${p.count} → ${p.count * 2} pages` })} />;
}

// ---------- Crop & resize ----------
export function Crop() {
  const [mode, setMode] = useState<'crop' | 'a4' | 'letter'>('crop');
  const [m, setM] = useState({ top: 0.05, right: 0.05, bottom: 0.05, left: 0.05 });
  const make = (b: Uint8Array) => (mode === 'crop' ? O.cropMargins(b, m) : O.fitTo(b, mode));
  return <OpTool action={mode === 'crop' ? 'Crop pages' : `Fit to ${mode.toUpperCase()}`} previewKey={JSON.stringify([mode, m])} preview={make}
    options={() => <>
      <Group label="Mode"><Segmented id="crop" value={mode} onChange={setMode} options={[{ value: 'crop', label: 'Trim margins' }, { value: 'a4', label: 'Fit to A4' }, { value: 'letter', label: 'Fit to Letter' }]} /></Group>
      {mode === 'crop' && (['top', 'right', 'bottom', 'left'] as const).map((k) => (
        <Field key={k} label={`${k[0].toUpperCase() + k.slice(1)} · ${pct(m[k])}`}>
          <input type="range" min={0} max={0.4} step={0.01} value={m[k]} onChange={(e) => setM({ ...m, [k]: +e.target.value })} className="w-full accent-[var(--accent)]" />
        </Field>))}
    </>}
    run={async (p) => ({ data: await make(p.bytes), name: `${baseName(p.file.name)}-${mode === 'crop' ? 'cropped' : mode}.pdf` })} />;
}

// ---------- PDFs to ZIP ----------
export function Zip() {
  const [files, setFiles] = useState<File[]>([]);
  const [done, setDone] = useState<string>();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    const zip = new JSZip(), seen = new Map<string, number>();
    for (const f of files) { const k = seen.get(f.name) ?? 0; seen.set(f.name, k + 1); zip.file(k ? `${baseName(f.name)} (${k}).pdf` : f.name, f); }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    download(blob, 'pdfs.zip', 'application/zip');
    setDone(`${files.length} files · ${formatBytes(files.reduce((s, f) => s + f.size, 0))} → ${formatBytes(blob.size)} · pdfs.zip`);
    setBusy(false);
  };
  return (
    <div>
      <Dropzone multiple onFiles={(f) => setFiles((c) => [...c, ...f])} label={files.length ? 'Add more PDFs' : undefined} />
      {files.length > 0 && <div className="mt-6 space-y-2">{files.map((f, i) => <FileChip key={i} file={f} onRemove={() => setFiles((c) => c.filter((_, k) => k !== i))} />)}
        <div className="flex justify-end pt-3"><Button busy={busy} onClick={run}>Create ZIP · {files.length} file{files.length > 1 ? 's' : ''}</Button></div></div>}
      <Done show={!!done} title="Zipped — downloading" detail={done} onAgain={() => { setFiles([]); setDone(undefined); }} />
    </div>
  );
}

// ---------- Why is my PDF big? ----------
export function WhyBig() {
  const { pdf, error, open, reset } = useSinglePdf();
  const [r, setR] = useState<Awaited<ReturnType<typeof O.sizeReport>>>();
  useEffect(() => { setR(undefined); if (pdf) O.sizeReport(pdf.bytes).then(setR).catch(() => undefined); }, [pdf]);
  if (!pdf) return <><Dropzone onFiles={([f]) => open(f)} /><ErrorNote error={error} /></>;
  const rows = r ? ([['Images', r.parts.images, '#7c93ff'], ['Fonts', r.parts.fonts, '#f59e0b'], ['Page content', r.parts.content, '#34d399'], ['Structure & other', r.parts.other, '#8f97a6']] as const) : [];
  const big = r && r.parts.images / r.total > 0.5;
  return (
    <div>
      <FileChip file={pdf.file} extra={` · ${pdf.count} pages`} onRemove={() => { reset(); setR(undefined); }} />
      {r && (
        <div className="mt-6 max-w-[720px] space-y-5 rounded-2xl border border-line bg-surface p-5">
          <div className="flex h-4 overflow-hidden rounded-full">
            {rows.map(([k, v, c], i) => <motion.span key={k} title={`${k}: ${formatBytes(v)}`} initial={{ width: 0 }} animate={{ width: `${(v / r.total) * 100}%` }} transition={{ duration: 0.8, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }} style={{ background: c }} />)}
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {rows.map(([k, v, c]) => <li key={k} className="flex items-center gap-2.5 text-[14px]"><span className="size-2.5 rounded-full" style={{ background: c }} /><span className="flex-1 text-muted">{k}</span><span className="tabular-nums">{formatBytes(v)}</span><span className="w-12 text-right text-faint tabular-nums">{pct(v / r.total)}</span></li>)}
          </ul>
          <p className="text-[14px]">{big ? <>Mostly <b>images</b> — <a className="text-ink underline underline-offset-4" href="/tools/compress">Compress</a> at Strong will shrink it a lot.</> : r.parts.fonts / r.total > 0.4 ? <>Mostly <b>embedded fonts</b> — Lossless compression may help a little; re-exporting with font subsetting helps most.</> : <>Nothing dominates. Lossless compression may trim the structure.</>}</p>
          {r.images.length > 0 && (
            <div><p className="mb-2 text-[13px] font-medium text-muted">Largest images</p>
              <ul className="space-y-1 text-[13px]">{r.images.slice(0, 8).map((im) => <li key={im.name} className="flex gap-3"><span className="flex-1 text-muted">{im.name} · {im.w}×{im.h} · {im.filter.replace('/', '')}</span><span className="tabular-nums">{formatBytes(im.bytes)}</span></li>)}</ul>
            </div>)}
        </div>
      )}
    </div>
  );
}

// ---------- Headers & footers ----------
export function HeaderFooter() {
  const [h, setH] = useState<O.Band>({ left: '', center: '', right: '{date}' });
  const [f, setF] = useState<O.Band>({ left: '{file}', center: '', right: 'Page {n} of {total}' });
  const all = Object.values(h).join('') + Object.values(f).join('');
  const bad = O.unsupportedChars(all);
  const band = (label: string, v: O.Band, set: (b: O.Band) => void) => (
    <Group label={label}><div className="grid grid-cols-3 gap-2">{(['left', 'center', 'right'] as const).map((k) => <input key={k} aria-label={`${label} ${k}`} value={v[k]} onChange={(e) => set({ ...v, [k]: e.target.value })} placeholder={k} className={inputCls} />)}</div></Group>
  );
  return <OpTool action="Add headers & footers" previewKey={JSON.stringify([h, f])} preview={(b) => O.headerFooter(b, h, f, 'document.pdf')}
    note={bad.length ? <span className="text-rose-400">The built-in font can’t draw {bad.slice(0, 3).join(' ')}.</span> : <>Tokens: <code>{'{n}'}</code> page, <code>{'{total}'}</code> pages, <code>{'{date}'}</code>, <code>{'{file}'}</code></>}
    options={() => <>{band('Header', h, setH)}{band('Footer', f, setF)}</>}
    run={async (p) => ({ data: await O.headerFooter(p.bytes, h, f, p.file.name), name: `${baseName(p.file.name)}-hf.pdf` })} />;
}

// ---------- Bates numbering ----------
export function Bates() {
  const [prefix, setPrefix] = useState('ABC');
  const [start, setStart] = useState(1);
  const [digits, setDigits] = useState(6);
  const [next, setNext] = useState<number>();
  return <OpTool action="Stamp Bates numbers" previewKey={`${prefix}${start}${digits}`} preview={async (b) => (await O.bates(b, { prefix, suffix: '', start, digits })).bytes}
    note={next !== undefined ? <>Next file should start at <b className="tabular-nums">{next}</b>.</> : 'Stamped bottom-right on every page.'}
    options={() => <div className="flex flex-wrap gap-4">
      <Field label="Prefix"><input value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))} className={`${inputCls} max-w-36`} /></Field>
      <Field label="Start at"><input type="number" min={0} value={start} onChange={(e) => setStart(+e.target.value)} className={`${inputCls} max-w-28`} /></Field>
      <Field label="Digits"><input type="number" min={1} max={10} value={digits} onChange={(e) => setDigits(+e.target.value)} className={`${inputCls} max-w-24`} /></Field>
    </div>}
    run={async (p) => { const r = await O.bates(p.bytes, { prefix, suffix: '', start, digits }); setNext(r.next); return { data: r.bytes, name: `${baseName(p.file.name)}-bates.pdf`, detail: `${prefix}${String(start).padStart(digits, '0')}–${prefix}${String(r.next - 1).padStart(digits, '0')}` }; }} />;
}

// ---------- Flatten ----------
export function Flatten() {
  return <OpTool action="Flatten PDF" note="Form fields become fixed text, annotations are removed, and embedded scripts and attachments are dropped."
    run={async (p) => ({ data: await O.flatten(p.bytes), name: `${baseName(p.file.name)}-flat.pdf` })} />;
}

// ---------- Metadata ----------
export function Metadata() {
  const { pdf, error, open, reset, setError } = useSinglePdf();
  const [m, setM] = useState<O.Meta>();
  const [dates, setDates] = useState<string>();
  const [scrub, setScrub] = useState(false);
  const [done, setDone] = useState<string>();
  useEffect(() => { if (pdf) O.readMeta(pdf.bytes).then(({ created, modified, ...rest }) => { setM(rest); setDates([created && `Created ${new Date(created).toLocaleString()}`, modified && `modified ${new Date(modified).toLocaleString()}`].filter(Boolean).join(' · ')); }).catch((e) => setError(String(e))); }, [pdf, setError]);
  if (!pdf) return <><Dropzone onFiles={([f]) => open(f)} /><ErrorNote error={error} /></>;
  const save = async () => { if (!m) return; const out = await O.writeMeta(pdf.bytes, m, scrub); const n = `${baseName(pdf.file.name)}-meta.pdf`; download(out, n); setDone(`${formatBytes(out.length)} · ${n}`); };
  return (
    <div>
      <FileChip file={pdf.file} extra={` · ${pdf.count} pages`} onRemove={() => { reset(); setM(undefined); setDone(undefined); }} />
      {m && <div className="mt-6 max-w-[640px] space-y-4 rounded-2xl border border-line bg-surface p-5">
        {(Object.keys(m) as (keyof O.Meta)[]).map((k) => <Field key={k} label={k[0].toUpperCase() + k.slice(1)}><input value={m[k]} onChange={(e) => setM({ ...m, [k]: e.target.value })} className={inputCls} /></Field>)}
        {dates && <p className="text-[12px] text-faint">{dates}</p>}
        <label className="flex items-center gap-2.5 text-[14px] text-muted"><input type="checkbox" checked={scrub} onChange={(e) => setScrub(e.target.checked)} className="size-4 accent-[var(--accent)]" />Also wipe dates and the XMP metadata block (privacy)</label>
        <Button onClick={save} className="w-full">Save metadata</Button>
      </div>}
      <Done show={!!done} title="Saved — downloading" detail={done} onAgain={() => { reset(); setDone(undefined); }} />
    </div>
  );
}

// ---------- GST filing prep: split by size ----------
export function GstFiling() {
  const [mb, setMb] = useState(5);
  return <OpTool action={`Split into parts under ${mb} MB`}
    note="Indian GST and income-tax portals cap uploads (often 2 or 5 MB). Compress first if a single page is already over the limit."
    options={() => <Group label="Limit per file"><Segmented id="gst-mb" value={mb} onChange={setMb} options={[1, 2, 5, 10].map((n) => ({ value: n, label: `${n} MB` }))} /></Group>}
    run={async (p) => {
      const parts = await O.splitBySize(p.bytes, mb * 1024 * 1024 * 0.98);
      if (parts.length === 1) return { data: parts[0], name: `${baseName(p.file.name)}-part1.pdf`, detail: 'already under the limit' };
      const zip = new JSZip();
      parts.forEach((b, i) => zip.file(`${baseName(p.file.name)}-part${i + 1}.pdf`, b));
      const over = parts.filter((b) => b.length > mb * 1024 * 1024).length;
      return { data: await zip.generateAsync({ type: 'blob' }), name: `${baseName(p.file.name)}-parts.zip`, type: 'application/zip', detail: `${parts.length} parts${over ? ` · ${over} single page${over > 1 ? 's' : ''} still over — compress first` : ''}` };
    }} />;
}
