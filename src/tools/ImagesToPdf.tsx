import { Reorder, motion } from 'motion/react';
import { X } from 'lucide-react';
import { useState } from 'react';
import { PDFDocument } from '@cantoo/pdf-lib';
import { Button, Group, Done, Dropzone, ErrorNote, Segmented } from '../components/ui';
import { download, formatBytes } from '../lib/pdf';

type Size = 'fit' | 'a4' | 'letter';
const SIZES = { a4: [595.28, 841.89], letter: [612, 792] } as const;
interface Img { id: string; file: File; url: string }
let seq = 0;

/** pdf-lib embeds JPEG and PNG; anything else (WebP, GIF, BMP) goes through a canvas to PNG. */
async function embed(doc: PDFDocument, file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (file.type === 'image/jpeg') return doc.embedJpg(bytes);
  if (file.type === 'image/png') return doc.embedPng(bytes);
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas');
  c.width = bmp.width; c.height = bmp.height;
  c.getContext('2d')!.drawImage(bmp, 0, 0);
  const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'));
  return doc.embedPng(new Uint8Array(await blob.arrayBuffer()));
}

export default function ImagesToPdf() {
  const [imgs, setImgs] = useState<Img[]>([]);
  const [size, setSize] = useState<Size>('a4');
  const [margin, setMargin] = useState(24);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();

  const add = (files: File[]) => { setDone(undefined); setImgs((cur) => [...cur, ...files.map((file) => ({ id: `i${seq++}`, file, url: URL.createObjectURL(file) }))]); };

  const make = async () => {
    setBusy(true); setError(undefined);
    try {
      const doc = await PDFDocument.create();
      for (const it of imgs) {
        const img = await embed(doc, it.file);
        const landscape = img.width > img.height;
        const [pw, ph] = size === 'fit' ? [img.width * 0.75, img.height * 0.75] : landscape ? [SIZES[size][1], SIZES[size][0]] : SIZES[size];
        const m = size === 'fit' ? 0 : margin;
        const k = Math.min((pw - 2 * m) / img.width, (ph - 2 * m) / img.height);
        const w = img.width * k, h = img.height * k;
        doc.addPage([pw, ph]).drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
      }
      const bytes = await doc.save();
      download(bytes, 'images.pdf');
      setDone(`${imgs.length} page${imgs.length > 1 ? 's' : ''} · ${formatBytes(bytes.length)} · images.pdf`);
    } catch (e) { setError(`Couldn’t build the PDF: ${(e as Error).message}`); } finally { setBusy(false); }
  };

  return (
    <div>
      <Dropzone multiple accept="image/jpeg,image/png,image/webp,image/gif,image/bmp" onFiles={add}
        label={imgs.length ? 'Add more images' : 'Drop images here or click to choose'} hint="JPG, PNG, WebP, GIF or BMP · stays on this device" />
      {imgs.length > 0 && (
        <>
          <div className="mt-6 flex flex-wrap items-end gap-6 rounded-2xl border border-line bg-surface p-5">
            <Group label="Page size"><Segmented id="img-size" value={size} onChange={setSize} options={[{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'Letter' }, { value: 'fit', label: 'Fit image' }]} /></Group>
            {size !== 'fit' && <Group label="Margin"><Segmented id="img-margin" value={margin} onChange={setMargin} options={[{ value: 0, label: 'None' }, { value: 24, label: 'Small' }, { value: 56, label: 'Large' }]} /></Group>}
            <Button className="ml-auto" busy={busy} onClick={make}>Create PDF · {imgs.length} page{imgs.length > 1 ? 's' : ''}</Button>
          </div>
          <p className="mt-6 mb-3 text-[13px] text-faint">Drag to set the page order</p>
          <Reorder.Group axis="x" values={imgs} onReorder={setImgs} className="flex flex-wrap gap-4">
            {imgs.map((it, i) => (
              <Reorder.Item key={it.id} value={it} whileDrag={{ scale: 1.05, zIndex: 10 }} className="group relative w-[140px] cursor-grab active:cursor-grabbing">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="grid aspect-[3/4] place-items-center overflow-hidden rounded-xl border border-line bg-white p-2">
                  <img src={it.url} alt={it.file.name} draggable={false} className="max-h-full max-w-full object-contain" />
                </motion.div>
                <span className="mt-1.5 block truncate px-1 text-[12px] text-muted">{i + 1} · {it.file.name}</span>
                <button aria-label={`Remove ${it.file.name}`} onClick={() => { URL.revokeObjectURL(it.url); setImgs((c) => c.filter((x) => x.id !== it.id)); }}
                  className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"><X className="size-3.5" /></button>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </>
      )}
      <ErrorNote error={error} />
      <Done show={!!done} title="PDF created — downloading" detail={done} onAgain={() => { imgs.forEach((i) => URL.revokeObjectURL(i.url)); setImgs([]); setDone(undefined); }} />
    </div>
  );
}
