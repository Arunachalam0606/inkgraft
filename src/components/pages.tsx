import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { useCallback, useState, type ReactNode } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { openPdf, readBytes } from '../lib/pdf';
import { Thumb } from './ui';

export interface LoadedPdf { file: File; bytes: Uint8Array; doc: PDFDocumentProxy; count: number }

/** Load one PDF for page tools: bytes for pdf-lib, a pdf.js doc for thumbnails. */
export function useSinglePdf() {
  const [pdf, setPdf] = useState<LoadedPdf>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const open = useCallback(async (file: File) => {
    setError(undefined); setLoading(true);
    try {
      const bytes = await readBytes(file);
      const doc = await openPdf(bytes);
      setPdf({ file, bytes, doc, count: doc.numPages });
    } catch (e) {
      setError((e as Error).name === 'PasswordException' ? 'This PDF is password-protected. Use “Remove Password” first.' : 'That file couldn’t be opened as a PDF.');
    } finally { setLoading(false); }
  }, []);
  const reset = useCallback(() => { void pdf?.doc.loadingTask.destroy(); setPdf(undefined); }, [pdf]);
  return { pdf, error, loading, open, reset, setError };
}

/** Grid of page thumbnails; click toggles selection. `badge` and `overlay` decorate a page. */
export function PageGrid({ doc, count, selected, onToggle, rotation, dim, badge }: {
  doc: PDFDocumentProxy; count: number; selected?: Set<number>; onToggle?: (page: number, e: React.MouseEvent) => void;
  rotation?: (page: number) => number; dim?: (page: number) => boolean; badge?: (page: number) => ReactNode;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-4">
      {Array.from({ length: count }, (_, i) => i + 1).map((n) => {
        const on = selected?.has(n);
        return (
          <motion.button
            key={n} type="button" onClick={(e) => onToggle?.(n, e)} aria-pressed={on} aria-label={`Page ${n}`}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: dim?.(n) ? 0.35 : 1, y: 0, scale: on ? 0.97 : 1 }}
            transition={{ duration: 0.35, delay: Math.min(n, 24) * 0.015, ease: [0.16, 1, 0.3, 1] }}
            className={`group relative rounded-xl p-2 text-left transition-colors ${on ? 'bg-accent/12 ring-2 ring-accent' : 'hover:bg-surface-2'}`}
          >
            <Thumb doc={doc} page={n} rotation={rotation?.(n) ?? 0} />
            <span className="mt-2 flex items-center justify-between px-1 text-[12px] text-muted">
              <span className="tabular-nums">{n}</span>{badge?.(n)}
            </span>
            {on && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 22 }}
                className="absolute top-3 right-3 grid size-6 place-items-center rounded-full bg-accent text-accent-fg shadow-lg">
                <Check className="size-3.5" strokeWidth={3} />
              </motion.span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

/** Selection with shift-click ranges. */
export function useSelection() {
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [last, setLast] = useState<number>();
  const toggle = (n: number, e?: React.MouseEvent) => {
    setSel((cur) => {
      const next = new Set(cur);
      if (e?.shiftKey && last) { const [a, b] = [Math.min(last, n), Math.max(last, n)]; for (let i = a; i <= b; i++) next.add(i); }
      else if (next.has(n)) next.delete(n); else next.add(n);
      return next;
    });
    setLast(n);
  };
  return { sel, setSel, toggle };
}
