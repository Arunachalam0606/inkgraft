import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight, RotateCw, Trash2, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Done, Dropzone, ErrorNote, FileChip, Thumb } from '../components/ui';
import { useSinglePdf } from '../components/pages';
import { baseName, download, formatBytes } from '../lib/pdf';
import { buildFrom } from '../lib/ops';

interface Card { page: number; rotate: number }
const move = <T,>(list: T[], from: number, to: number) => { const c = [...list]; const [x] = c.splice(from, 1); c.splice(to, 0, x); return c; };

export default function Organize() {
  const { pdf, error, open, reset, setError } = useSinglePdf();
  const [cards, setCards] = useState<Card[]>([]);
  const [drag, setDrag] = useState<number>();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string>();

  const load = async (f: File) => { await open(f); setDone(undefined); };
  useEffect(() => { setCards(pdf ? Array.from({ length: pdf.count }, (_, i) => ({ page: i + 1, rotate: 0 })) : []); }, [pdf]);

  const original = pdf && cards.length === pdf.count && cards.every((c, i) => c.page === i + 1 && c.rotate % 360 === 0);
  const save = async () => {
    if (!pdf) return;
    setBusy(true);
    try {
      const bytes = await buildFrom(pdf.bytes, cards.map((c) => ({ index: c.page - 1, rotate: c.rotate })));
      const name = `${baseName(pdf.file.name)}-organized.pdf`;
      download(bytes, name);
      setDone(`${cards.length} pages · ${formatBytes(bytes.length)} · ${name}`);
    } catch (e) { setError(`Couldn’t save: ${(e as Error).message}`); } finally { setBusy(false); }
  };
  const again = () => { reset(); setCards([]); setDone(undefined); };

  if (!pdf) return <><Dropzone onFiles={([f]) => load(f)} /><ErrorNote error={error} /></>;
  return (
    <div>
      <FileChip file={pdf.file} extra={` · ${pdf.count} pages`} onRemove={again} />
      <div className="sticky top-14 z-10 mt-6 flex items-center gap-2 rounded-2xl border border-line bg-surface/90 p-3 backdrop-blur-xl lg:top-2">
        <span className="mr-auto px-2 text-[13px] text-muted">{cards.length} pages · drag to reorder</span>
        <Button variant="ghost" disabled={!!original} onClick={() => setCards(Array.from({ length: pdf.count }, (_, i) => ({ page: i + 1, rotate: 0 })))}><Undo2 className="size-4" />Reset</Button>
        <Button busy={busy} disabled={!!original || !cards.length} onClick={save}>Download</Button>
      </div>
      <ErrorNote error={error} />
      <Done show={!!done} title="Saved — downloading" detail={done} onAgain={again} />
      <motion.ul layout className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
        <AnimatePresence>
          {cards.map((c, i) => (
            <motion.li
              key={c.page} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: drag === i ? 0.4 : 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              draggable onDragStart={() => setDrag(i)} onDragEnd={() => setDrag(undefined)}
              onDragOver={(e) => { e.preventDefault(); if (drag !== undefined && drag !== i) { setCards((cs) => move(cs, drag, i)); setDrag(i); } }}
              className="group relative cursor-grab rounded-xl p-2 hover:bg-surface-2 active:cursor-grabbing"
            >
              <Thumb doc={pdf.doc} page={c.page} rotation={c.rotate} />
              <div className="mt-2 flex items-center justify-between px-1 text-[12px] text-muted">
                <span className="tabular-nums">{i + 1}{c.page !== i + 1 && <span className="text-faint"> · was {c.page}</span>}</span>
                <span className="flex gap-0.5 opacity-60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <button aria-label={`Move page ${c.page} earlier`} disabled={i === 0} onClick={() => setCards((cs) => move(cs, i, i - 1))} className="rounded p-1 hover:bg-bg hover:text-fg disabled:opacity-30"><ArrowLeft className="size-3.5" /></button>
                  <button aria-label={`Move page ${c.page} later`} disabled={i === cards.length - 1} onClick={() => setCards((cs) => move(cs, i, i + 1))} className="rounded p-1 hover:bg-bg hover:text-fg disabled:opacity-30"><ArrowRight className="size-3.5" /></button>
                  <button aria-label={`Rotate page ${c.page}`} onClick={() => setCards((cs) => cs.map((x, k) => (k === i ? { ...x, rotate: x.rotate + 90 } : x)))} className="rounded p-1 hover:bg-bg hover:text-fg"><RotateCw className="size-3.5" /></button>
                  <button aria-label={`Delete page ${c.page}`} disabled={cards.length === 1} onClick={() => setCards((cs) => cs.filter((_, k) => k !== i))} className="rounded p-1 hover:bg-bg hover:text-rose-400 disabled:opacity-30"><Trash2 className="size-3.5" /></button>
                </span>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>
    </div>
  );
}
