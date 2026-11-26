import { useState } from 'react';
import { Button, Done, Dropzone, ErrorNote, Field, FileChip, Group, Segmented, inputCls } from '../components/ui';
import { PreviewPane, friendly, usePreview, useSinglePdf } from '../components/pages';
import { baseName, download, formatBytes } from '../lib/pdf';
import { unsupportedChars, watermark, type WatermarkOpts } from '../lib/ops';

const COLORS: Record<string, [number, number, number]> = { grey: [0.45, 0.47, 0.5], red: [0.85, 0.15, 0.2], blue: [0.18, 0.31, 0.85] };

export default function Watermark() {
  const { pdf, error, open, reset, setError } = useSinglePdf();
  const [text, setText] = useState('CONFIDENTIAL');
  const [size, setSize] = useState(56);
  const [opacity, setOpacity] = useState(0.18);
  const [angle, setAngle] = useState(45);
  const [color, setColor] = useState('grey');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string>();
  const opts: WatermarkOpts = { text: text.trim() || ' ', size, opacity, angle, color: COLORS[color] };
  const bad = unsupportedChars(text);
  const badMsg = bad.length ? `The built-in PDF font can’t draw ${bad.slice(0, 3).join(' ')} — use Latin letters, digits and punctuation.` : undefined;
  const preview = usePreview(pdf, (b) => watermark(b, opts), JSON.stringify(opts));

  const run = async () => {
    if (!pdf || !text.trim()) return;
    setBusy(true); setError(undefined);
    try {
      const bytes = await watermark(pdf.bytes, opts);
      const name = `${baseName(pdf.file.name)}-watermarked.pdf`;
      download(bytes, name);
      setDone(`${pdf.count} pages stamped · ${formatBytes(bytes.length)} · ${name}`);
    } catch (e) { setError(friendly(e)); } finally { setBusy(false); }
  };
  const again = () => { reset(); setDone(undefined); };

  if (!pdf) return <><Dropzone onFiles={([f]) => open(f)} /><ErrorNote error={error} /></>;
  return (
    <div>
      <FileChip file={pdf.file} extra={` · ${pdf.count} pages`} onRemove={again} />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="space-y-5 rounded-2xl border border-line bg-surface p-5">
          <Field label="Text"><input value={text} maxLength={60} onChange={(e) => setText(e.target.value)} className={inputCls} /></Field>
          <Field label={`Size · ${size} pt`}><input type="range" min={16} max={140} value={size} onChange={(e) => setSize(+e.target.value)} className="w-full accent-[var(--accent)]" /></Field>
          <Field label={`Opacity · ${Math.round(opacity * 100)}%`}><input type="range" min={0.05} max={0.8} step={0.01} value={opacity} onChange={(e) => setOpacity(+e.target.value)} className="w-full accent-[var(--accent)]" /></Field>
          <Group label="Angle"><Segmented id="wm-angle" value={angle} onChange={setAngle} options={[{ value: 0, label: '0°' }, { value: 30, label: '30°' }, { value: 45, label: '45°' }, { value: 90, label: '90°' }]} /></Group>
          <Group label="Colour"><Segmented id="wm-color" value={color} onChange={setColor} options={[{ value: 'grey', label: 'Grey' }, { value: 'red', label: 'Red' }, { value: 'blue', label: 'Blue' }]} /></Group>
          <Button busy={busy} disabled={!text.trim() || !!preview.err || !!badMsg} onClick={run} className="w-full">Add watermark to {pdf.count} page{pdf.count > 1 ? 's' : ''}</Button>
          <ErrorNote error={badMsg || preview.err || error} />
        </div>
        <PreviewPane url={preview.url} />
      </div>
      <Done show={!!done} title="Watermarked — downloading" detail={done} onAgain={again} />
    </div>
  );
}
