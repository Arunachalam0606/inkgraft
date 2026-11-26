import { motion } from 'motion/react';
import { Copy, Pause, Play, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import { OPS, type PDFDocumentProxy } from 'pdfjs-dist';
import { Button, Dropzone, ErrorNote, FileChip, Group, Segmented } from '../components/ui';
import { useSinglePdf } from '../components/pages';
import { baseName, download, formatBytes, readBytes } from '../lib/pdf';

/** Page text in reading order: pdf.js items joined, with line breaks where the baseline moves. */
export async function pageText(doc: PDFDocumentProxy, n: number) {
  const items = (await (await doc.getPage(n)).getTextContent()).items as { str: string; transform: number[]; hasEOL?: boolean }[];
  let out = '', lastY: number | undefined;
  for (const it of items) {
    const y = it.transform[5];
    if (lastY !== undefined && Math.abs(y - lastY) > 2 && !out.endsWith('\n')) out += '\n';
    out += it.str + (it.hasEOL ? '\n' : '');
    lastY = y;
  }
  return out.replace(/[ \t]+\n/g, '\n').trim();
}

// ---------- Extract text ----------
export function ExtractText() {
  const { pdf, error, open, reset } = useSinglePdf();
  const [text, setText] = useState<string>();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setText(undefined);
    if (!pdf) return;
    void (async () => { const parts: string[] = []; for (let n = 1; n <= pdf.count; n++) parts.push(`--- Page ${n} ---\n${await pageText(pdf.doc, n)}`); setText(parts.join('\n\n')); })();
  }, [pdf]);
  if (!pdf) return <><Dropzone onFiles={([f]) => open(f)} /><ErrorNote error={error} /></>;
  const empty = text !== undefined && !text.replace(/--- Page \d+ ---/g, '').trim();
  return (
    <div>
      <FileChip file={pdf.file} extra={` · ${pdf.count} pages`} onRemove={reset} />
      {empty && <p className="mt-4 text-[14px] text-amber-400">No selectable text — this looks like a scan. Run <a className="underline" href="/tools/ocr">Searchable PDF (OCR)</a> first.</p>}
      {text !== undefined && !empty && (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={() => download(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${baseName(pdf.file.name)}.txt`, 'text/plain')}>Download .txt</Button>
            <Button variant="ghost" onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}><Copy className="size-4" />{copied ? 'Copied' : 'Copy all'}</Button>
            <span className="ml-auto self-center text-[13px] text-faint">{text.split(/\s+/).filter(Boolean).length.toLocaleString()} words</span>
          </div>
          <motion.pre initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 max-h-[60vh] overflow-auto rounded-2xl border border-line bg-bg p-5 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-muted">{text}</motion.pre>
        </>
      )}
    </div>
  );
}

// ---------- Extract images ----------
interface Found { page: number; w: number; h: number; blob: Blob; url: string }
export function ExtractImages() {
  const { pdf, error, open, reset, setError } = useSinglePdf();
  const [found, setFound] = useState<Found[]>();
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    setFound(undefined);
    if (!pdf) return;
    let alive = true;
    void (async () => {
      const out: Found[] = [];
      try {
        for (let n = 1; n <= pdf.count && alive; n++) {
          const page = await pdf.doc.getPage(n);
          const ops = await page.getOperatorList();
          const names = new Set<string>();
          ops.fnArray.forEach((f, i) => { if (f === OPS.paintImageXObject) names.add(ops.argsArray[i][0]); });
          for (const name of names) {
            const img = await new Promise<{ width: number; height: number; bitmap?: ImageBitmap; data?: Uint8ClampedArray } | null>((res) => {
              const store = name.startsWith('g_') ? page.commonObjs : page.objs;
              try { store.get(name, res); } catch { res(null); }
            });
            if (!img || img.width < 24 || img.height < 24) continue; // skip masks, bullets and spacer pixels
            const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
            const ctx = c.getContext('2d')!;
            if (img.bitmap) ctx.drawImage(img.bitmap, 0, 0);
            else if (img.data) {
              const px = img.data.length / (img.width * img.height);
              const rgba = new Uint8ClampedArray(img.width * img.height * 4);
              for (let i = 0, j = 0; i < rgba.length; i += 4, j += px) { rgba[i] = img.data[j]; rgba[i + 1] = img.data[px >= 3 ? j + 1 : j]; rgba[i + 2] = img.data[px >= 3 ? j + 2 : j]; rgba[i + 3] = px === 4 ? img.data[j + 3] : 255; }
              ctx.putImageData(new ImageData(rgba, img.width, img.height), 0, 0);
            } else continue;
            const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'));
            out.push({ page: n, w: img.width, h: img.height, blob, url: URL.createObjectURL(blob) });
          }
          page.cleanup();
          setProgress(n / pdf.count);
        }
      } catch (e) { setError(`Couldn’t read images: ${(e as Error).message}`); }
      if (alive) setFound(out);
    })();
    return () => { alive = false; };
  }, [pdf, setError]);
  useEffect(() => () => found?.forEach((f) => URL.revokeObjectURL(f.url)), [found]);
  if (!pdf) return <><Dropzone onFiles={([f]) => open(f)} /><ErrorNote error={error} /></>;
  const zipAll = async () => {
    const zip = new JSZip();
    found!.forEach((f, i) => zip.file(`${baseName(pdf.file.name)}-p${f.page}-${i + 1}.png`, f.blob));
    download(await zip.generateAsync({ type: 'blob' }), `${baseName(pdf.file.name)}-images.zip`, 'application/zip');
  };
  return (
    <div>
      <FileChip file={pdf.file} extra={` · ${pdf.count} pages`} onRemove={reset} />
      {!found && <div className="mt-6 h-1.5 max-w-md overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-accent transition-[width]" style={{ width: `${progress * 100}%` }} /></div>}
      {found && found.length === 0 && <p className="mt-6 text-muted">No embedded images found.</p>}
      {found && found.length > 0 && (
        <>
          <div className="mt-6 flex items-center gap-3"><Button onClick={zipAll}>Download all · {found.length} PNG{found.length > 1 ? 's' : ''}</Button></div>
          <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
            {found.map((f, i) => (
              <motion.button key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 20) * 0.03 }}
                onClick={() => download(f.blob, `${baseName(pdf.file.name)}-p${f.page}-${i + 1}.png`, 'image/png')} className="group rounded-xl border border-line bg-surface p-2 text-left hover:border-accent/60">
                <span className="grid aspect-square place-items-center overflow-hidden rounded-lg bg-[repeating-conic-gradient(#ffffff10_0_25%,transparent_0_50%)] bg-[length:16px_16px]"><img src={f.url} alt={`Image from page ${f.page}`} className="max-h-full max-w-full object-contain" /></span>
                <span className="mt-1.5 block text-[12px] text-muted">p{f.page} · {f.w}×{f.h} · {formatBytes(f.blob.size)}</span>
              </motion.button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- PDF to audio (browser speech) ----------
export function PdfToAudio() {
  const { pdf, error, open, reset } = useSinglePdf();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voice, setVoice] = useState('');
  const [rate, setRate] = useState(1);
  const [state, setState] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [page, setPage] = useState(1);
  const stop = useRef(false);
  useEffect(() => {
    const load = () => { const v = speechSynthesis.getVoices(); setVoices(v); if (!voice && v.length) setVoice((v.find((x) => x.default) ?? v[0]).name); };
    load(); speechSynthesis.addEventListener('voiceschanged', load);
    return () => { speechSynthesis.removeEventListener('voiceschanged', load); speechSynthesis.cancel(); };
  }, [voice]);
  if (!pdf) return <><Dropzone onFiles={([f]) => open(f)} hint="Uses your browser’s built-in voices · stays on this device" /><ErrorNote error={error} /></>;
  const play = async () => {
    if (state === 'paused') { speechSynthesis.resume(); setState('playing'); return; }
    stop.current = false; setState('playing');
    for (let n = page; n <= pdf.count && !stop.current; n++) {
      setPage(n);
      const text = await pageText(pdf.doc, n);
      // speak in sentence-sized chunks: long utterances get cut off in some browsers
      for (const chunk of text.match(/[^.!?\n]+[.!?]?/g) ?? []) {
        if (stop.current) break;
        await new Promise<void>((res) => { const u = new SpeechSynthesisUtterance(chunk.trim()); u.voice = voices.find((v) => v.name === voice) ?? null; u.rate = rate; u.onend = u.onerror = () => res(); speechSynthesis.speak(u); });
      }
    }
    setState('idle');
  };
  return (
    <div>
      <FileChip file={pdf.file} extra={` · ${pdf.count} pages`} onRemove={() => { stop.current = true; speechSynthesis.cancel(); reset(); }} />
      <div className="mt-6 max-w-[640px] space-y-5 rounded-2xl border border-line bg-surface p-5">
        <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-muted">Voice</span>
          <select value={voice} onChange={(e) => setVoice(e.target.value)} className="w-full rounded-xl border border-line-strong bg-bg px-3.5 py-2.5 text-[14px]">
            {voices.map((v) => <option key={v.name} value={v.name}>{v.name} · {v.lang}</option>)}
          </select>
        </label>
        <Group label={`Speed · ${rate}×`}><Segmented id="rate" value={rate} onChange={setRate} options={[0.8, 1, 1.25, 1.5].map((r) => ({ value: r, label: `${r}×` }))} /></Group>
        <div className="flex items-center gap-2">
          {state === 'playing' ? <Button onClick={() => { speechSynthesis.pause(); setState('paused'); }}><Pause className="size-4" />Pause</Button> : <Button onClick={play}><Play className="size-4" />{state === 'paused' ? 'Resume' : `Read from page ${page}`}</Button>}
          <Button variant="ghost" disabled={state === 'idle'} onClick={() => { stop.current = true; speechSynthesis.cancel(); setState('idle'); }}><Square className="size-4" />Stop</Button>
          {state !== 'idle' && <span className="ml-auto flex items-center gap-2 text-[13px] text-muted"><span className="flex h-4 items-end gap-0.5">{[0, 1, 2, 3].map((i) => <motion.span key={i} className="w-1 rounded-full bg-accent" animate={{ height: state === 'playing' ? ['30%', '100%', '45%'] : '30%' }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.12 }} />)}</span>Page {page}</span>}
        </div>
        <p className="text-[12px] text-faint">Browsers don’t let web pages record their speech, so this reads aloud rather than saving an audio file. Scanned PDFs need OCR first.</p>
      </div>
    </div>
  );
}

// ---------- Fingerprint ----------
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');
export function Fingerprint() {
  const [file, setFile] = useState<File>();
  const [hashes, setHashes] = useState<[string, string][]>();
  const [check, setCheck] = useState('');
  const [copied, setCopied] = useState<string>();
  useEffect(() => {
    setHashes(undefined);
    if (!file) return;
    void (async () => {
      const b = await readBytes(file);
      const algs = ['SHA-256', 'SHA-384', 'SHA-512', 'SHA-1'] as const;
      setHashes(await Promise.all(algs.map(async (a) => [a, hex(await crypto.subtle.digest(a, b as BufferSource))] as [string, string])));
    })();
  }, [file]);
  if (!file) return <Dropzone accept="" onFiles={([f]) => setFile(f)} label="Drop any file" hint="Hashed on this device with Web Crypto" />;
  const match = check.trim() && hashes?.find(([, h]) => h === check.trim().toLowerCase());
  return (
    <div>
      <FileChip file={file} onRemove={() => { setFile(undefined); setCheck(''); }} />
      <div className="mt-6 max-w-[760px] space-y-3">
        {hashes?.map(([a, h]) => (
          <div key={a} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
            <span className="w-16 shrink-0 text-[12px] font-medium text-muted">{a}</span>
            <code className="min-w-0 flex-1 truncate font-mono text-[12.5px]" title={h}>{h}</code>
            <button onClick={async () => { await navigator.clipboard.writeText(h); setCopied(a); setTimeout(() => setCopied(undefined), 1200); }} aria-label={`Copy ${a}`} className="rounded-lg p-1.5 text-muted hover:text-fg">{copied === a ? '✓' : <Copy className="size-4" />}</button>
          </div>
        ))}
        <label className="block pt-3"><span className="mb-1.5 block text-[13px] font-medium text-muted">Compare with a hash you were given</span>
          <input value={check} onChange={(e) => setCheck(e.target.value)} placeholder="Paste a SHA hash" className="w-full rounded-xl border border-line-strong bg-bg px-3.5 py-2.5 font-mono text-[13px] outline-none focus:border-accent" /></label>
        {check.trim() && <p className={`text-[14px] font-medium ${match ? 'text-emerald-400' : 'text-rose-400'}`} role="status">{match ? `✓ Matches ${match[0]} — the file is unchanged.` : '✗ No match — the file differs from the one that hash came from.'}</p>}
      </div>
    </div>
  );
}
