import { AnimatePresence, motion } from 'motion/react';
import { FileUp, Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { formatBytes, renderPage } from '../lib/pdf';

const ease = [0.16, 1, 0.3, 1] as const;

/** Drop zone with an animated dashed frame. Rejects files that don't match `accept`. */
export function Dropzone({ onFiles, accept = 'application/pdf,.pdf', multiple = false, label, hint }: {
  onFiles: (files: File[]) => void; accept?: string; multiple?: boolean; label?: string; hint?: string;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const take = (list: FileList | null) => {
    if (!list?.length) return;
    const ok = [...list].filter((f) => accept.split(',').some((a) => (a.startsWith('.') ? f.name.toLowerCase().endsWith(a) : a.endsWith('/*') ? f.type.startsWith(a.slice(0, -1)) : f.type === a)));
    if (ok.length) onFiles(multiple ? ok : ok.slice(0, 1));
  };
  return (
    <motion.button
      type="button" onClick={() => input.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}
      animate={{ scale: over ? 1.01 : 1 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`group relative flex w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border border-dashed px-6 py-16 text-center transition-colors ${over ? 'border-accent bg-accent/5' : 'border-line-strong bg-surface hover:border-accent/60'}`}
    >
      <motion.span animate={{ y: over ? -6 : 0, rotate: over ? -6 : 0 }} className="grid size-16 place-items-center rounded-2xl border border-line bg-bg shadow-[0_10px_40px_-12px_var(--glow)]">
        <FileUp className="size-7 text-ink" strokeWidth={1.6} />
      </motion.span>
      <span className="text-[17px] font-medium tracking-tight">{label ?? (multiple ? 'Drop PDFs here or click to choose' : 'Drop a PDF here or click to choose')}</span>
      <span className="text-[13px] text-muted">{hint ?? 'Stays on this device — nothing is uploaded.'}</span>
      <input ref={input} type="file" hidden accept={accept} multiple={multiple} onChange={(e) => { take(e.target.files); e.target.value = ''; }} />
      <span className="pointer-events-none absolute inset-0 -z-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 [background:radial-gradient(400px_circle_at_50%_0%,var(--glow),transparent_70%)]" />
    </motion.button>
  );
}

export function Button({ children, onClick, disabled, busy, variant = 'primary', className = '', type = 'button' }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; busy?: boolean; variant?: 'primary' | 'ghost'; className?: string; type?: 'button' | 'submit';
}) {
  const base = variant === 'primary'
    ? 'bg-fg text-bg hover:opacity-90 shadow-[0_8px_30px_-10px_var(--glow)]'
    : 'border border-line-strong text-fg hover:bg-surface-2';
  return (
    <motion.button type={type} whileTap={{ scale: 0.97 }} onClick={onClick} disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40 ${base} ${className}`}>
      {busy && <Loader2 className="size-4 animate-spin" />}{children}
    </motion.button>
  );
}

export function FileChip({ file, onRemove, extra }: { file: File; onRemove?: () => void; extra?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
      <span className="grid size-9 place-items-center rounded-lg bg-surface-2 text-[10px] font-semibold tracking-wide text-muted">PDF</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium">{file.name}</span>
        <span className="text-[12px] text-faint">{formatBytes(file.size)}{extra}</span>
      </span>
      {onRemove && <button onClick={onRemove} aria-label={`Remove ${file.name}`} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg"><X className="size-4" /></button>}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[12px] text-faint">{hint}</span>}
    </label>
  );
}

/** Label for a set of controls (a <label> would name only the first button inside). */
export function Group({ label, children }: { label: string; children: ReactNode }) {
  const id = `g-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div role="group" aria-labelledby={id}>
      <span id={id} className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>
      {children}
    </div>
  );
}

export const inputCls = 'w-full rounded-xl border border-line-strong bg-bg px-3.5 py-2.5 text-[14px] outline-none transition-colors placeholder:text-faint focus:border-accent';

export function Segmented<T extends string | number>({ value, options, onChange, id }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; id: string }) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-bg p-1" role="radiogroup">
      {options.map((o) => (
        <button key={String(o.value)} role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={`relative rounded-lg px-3.5 py-1.5 text-[13px] transition-colors ${value === o.value ? 'text-bg' : 'text-muted hover:text-fg'}`}>
          {value === o.value && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-lg bg-fg" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Lazily rendered page thumbnail. */
export function Thumb({ doc, page, rotation = 0, width = 150 }: { doc: PDFDocumentProxy; page: number; rotation?: number; width?: number }) {
  const [url, setUrl] = useState<string>();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    const io = new IntersectionObserver(async ([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const c = await renderPage(doc, page, { width });
      if (alive) setUrl(c.toDataURL('image/jpeg', 0.82));
    }, { rootMargin: '300px' });
    if (ref.current) io.observe(ref.current);
    return () => { alive = false; io.disconnect(); };
  }, [doc, page, width]);
  return (
    <div ref={ref} className="grid aspect-[3/4] place-items-center overflow-hidden rounded-lg bg-white shadow-[0_1px_2px_rgb(0_0_0/0.2),0_8px_24px_-12px_rgb(0_0_0/0.35)]">
      {url
        ? <motion.img src={url} alt={`Page ${page}`} initial={{ opacity: 0 }} animate={{ opacity: 1, rotate: rotation, scale: Math.abs(rotation) % 180 === 90 ? 0.74 : 1 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }} className="max-h-full max-w-full object-contain" />
        : <span className="size-5 animate-pulse rounded-full bg-black/10" />}
    </div>
  );
}

/** Success panel shown after a download is produced. */
export function Done({ show, title, detail, onAgain }: { show: boolean; title: string; detail?: ReactNode; onAgain: () => void }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease }}
          className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface px-5 py-4" role="status">
          <motion.svg viewBox="0 0 24 24" className="size-8 shrink-0 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <motion.circle cx="12" cy="12" r="10" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, ease }} />
            <motion.path d="M7.5 12.5l3 3 6-6.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.35, ease }} />
          </motion.svg>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{title}</span>
            {detail && <span className="block text-[13px] text-muted">{detail}</span>}
          </span>
          <Button variant="ghost" onClick={onAgain}>Start over</Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ErrorNote({ error }: { error?: string }) {
  return (
    <AnimatePresence>
      {error && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="mt-3 text-[13px] text-rose-400">{error}</motion.p>}
    </AnimatePresence>
  );
}
