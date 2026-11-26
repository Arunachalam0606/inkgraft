import { Reorder } from 'motion/react';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { useState } from 'react';
import { PDFDocument } from '@cantoo/pdf-lib';
import { Button, Done, Dropzone, ErrorNote, FileChip } from '../components/ui';
import { download, formatBytes, readBytes } from '../lib/pdf';

interface Item { id: string; file: File; pages?: number }
let seq = 0;
const move = <T,>(list: T[], from: number, to: number) => { const c = [...list]; const [x] = c.splice(from, 1); c.splice(to, 0, x); return c; };

export async function mergePdfs(files: Uint8Array[]) {
  const out = await PDFDocument.create();
  for (const bytes of files) {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: false });
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return out.save();
}

export default function Merge() {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();

  const add = async (files: File[]) => {
    setError(undefined); setDone(undefined);
    const next = files.map((file) => ({ id: `m${seq++}`, file }));
    setItems((cur) => [...cur, ...next]);
    for (const it of next) {
      try {
        const doc = await PDFDocument.load(await readBytes(it.file), { ignoreEncryption: true });
        setItems((cur) => cur.map((c) => (c.id === it.id ? { ...c, pages: doc.getPageCount() } : c)));
      } catch { setError(`${it.file.name} couldn’t be read as a PDF.`); }
    }
  };

  const merge = async () => {
    setBusy(true); setError(undefined);
    try {
      const bytes = await mergePdfs(await Promise.all(items.map((i) => readBytes(i.file))));
      download(bytes, 'merged.pdf');
      setDone(`${items.reduce((s, i) => s + (i.pages ?? 0), 0)} pages · ${formatBytes(bytes.length)}`);
    } catch (e) {
      setError(/encrypt/i.test(String(e)) ? 'One of the files is password-protected. Remove its password first.' : `Couldn’t merge: ${(e as Error).message}`);
    } finally { setBusy(false); }
  };

  return (
    <div>
      <Dropzone multiple onFiles={add} label={items.length ? 'Add more PDFs' : undefined} />
      {items.length > 0 && (
        <>
          <p className="mt-8 mb-3 text-[13px] text-faint">Drag to set the order · {items.length} file{items.length > 1 ? 's' : ''}</p>
          <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-2">
            {items.map((it, i) => (
              <Reorder.Item key={it.id} value={it} whileDrag={{ scale: 1.02, boxShadow: '0 20px 50px -20px rgb(0 0 0 / 0.6)' }} className="flex cursor-grab items-center gap-2 active:cursor-grabbing">
                <GripVertical className="size-4 shrink-0 text-faint" />
                <div className="flex-1"><FileChip file={it.file} extra={it.pages ? ` · ${it.pages} pages` : ''} onRemove={() => setItems((c) => c.filter((x) => x.id !== it.id))} /></div>
                {/* keyboard alternative to dragging */}
                <span className="flex flex-col">
                  <button aria-label={`Move ${it.file.name} up`} disabled={i === 0} onClick={() => setItems((c) => move(c, i, i - 1))} className="rounded p-0.5 text-faint hover:text-fg disabled:opacity-30"><ChevronUp className="size-4" /></button>
                  <button aria-label={`Move ${it.file.name} down`} disabled={i === items.length - 1} onClick={() => setItems((c) => move(c, i, i + 1))} className="rounded p-0.5 text-faint hover:text-fg disabled:opacity-30"><ChevronDown className="size-4" /></button>
                </span>
              </Reorder.Item>
            ))}
          </Reorder.Group>
          <div className="mt-6 flex justify-end">
            <Button busy={busy} disabled={items.length < 2} onClick={merge}>{items.length < 2 ? 'Add at least 2 PDFs' : `Merge ${items.length} PDFs`}</Button>
          </div>
        </>
      )}
      <ErrorNote error={error} />
      <Done show={!!done} title="Merged — downloading merged.pdf" detail={done} onAgain={() => { setItems([]); setDone(undefined); }} />
    </div>
  );
}
