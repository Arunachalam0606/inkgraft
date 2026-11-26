import { Reorder } from 'motion/react';
import { GripVertical, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Done, Dropzone, ErrorNote, Field, FileChip, inputCls } from '../components/ui';
import { useSinglePdf } from '../components/pages';
import { baseName, download, formatBytes } from '../lib/pdf';
import { STEP_LABEL, fillFields, readFields, runWorkflow, type FormField, type Step } from '../lib/ops3';

// ---------- Fill form ----------
export function FillForm() {
  const { pdf, error, open, reset, setError } = useSinglePdf();
  const [fields, setFields] = useState<FormField[]>();
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [lock, setLock] = useState(true);
  const [done, setDone] = useState<string>();
  useEffect(() => {
    setFields(undefined);
    if (pdf) readFields(pdf.bytes).then((f) => { setFields(f); setValues(Object.fromEntries(f.map((x) => [x.name, x.value]))); }).catch((e) => setError(String(e)));
  }, [pdf, setError]);
  if (!pdf) return <><Dropzone onFiles={([f]) => open(f)} hint="Fillable (AcroForm) PDFs · stays on this device" /><ErrorNote error={error} /></>;
  const save = async () => {
    try { const out = await fillFields(pdf.bytes, values, lock); const n = `${baseName(pdf.file.name)}-filled.pdf`; download(out, n); setDone(`${formatBytes(out.length)} · ${n}${lock ? ' · answers locked' : ''}`); }
    catch (e) { setError((e as Error).message); }
  };
  const pretty = (n: string) => n.replace(/[_.]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  return (
    <div>
      <FileChip file={pdf.file} extra={` · ${pdf.count} pages`} onRemove={() => { reset(); setDone(undefined); }} />
      {fields && fields.length === 0 && <p className="mt-6 text-muted">This PDF has no fillable fields. To type onto any page, use <a className="text-ink underline" href="/tools/edit-pdf">Edit PDF</a>.</p>}
      {fields && fields.length > 0 && (
        <div className="mt-6 max-w-[640px] space-y-4 rounded-2xl border border-line bg-surface p-5">
          <p className="text-[13px] text-muted">{fields.length} field{fields.length > 1 ? 's' : ''} found</p>
          {fields.map((f) => (
            <Field key={f.name} label={pretty(f.name) + (f.readOnly ? ' (read-only)' : '')}>
              {f.kind === 'text' && (f.multiline
                ? <textarea disabled={f.readOnly} value={String(values[f.name] ?? '')} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} rows={3} className={inputCls} />
                : <input disabled={f.readOnly} value={String(values[f.name] ?? '')} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} className={inputCls} />)}
              {f.kind === 'check' && <input type="checkbox" disabled={f.readOnly} checked={!!values[f.name]} onChange={(e) => setValues({ ...values, [f.name]: e.target.checked })} className="size-5 accent-[var(--accent)]" />}
              {(f.kind === 'choice' || f.kind === 'radio') && (
                <select disabled={f.readOnly} value={String(values[f.name] ?? '')} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} className={inputCls}>
                  <option value="">—</option>{f.options?.map((o) => <option key={o}>{o}</option>)}
                </select>)}
            </Field>
          ))}
          <label className="flex items-center gap-2.5 text-[14px] text-muted"><input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} className="size-4 accent-[var(--accent)]" />Lock answers (flatten) so every viewer shows them</label>
          <Button onClick={save} className="w-full">Save filled PDF</Button>
        </div>
      )}
      <ErrorNote error={error} />
      <Done show={!!done} title="Filled — downloading" detail={done} onAgain={() => { reset(); setDone(undefined); }} />
    </div>
  );
}

// ---------- Workflow builder ----------
interface Row { id: number; step: Step }
let rid = 0;
const DEFAULTS: Record<Step['kind'], Step> = {
  rotate: { kind: 'rotate', degrees: 90 }, watermark: { kind: 'watermark', text: 'CONFIDENTIAL', opacity: 0.18 },
  numbers: { kind: 'numbers', position: 'bottom-center', format: 'Page {n} of {total}' }, header: { kind: 'header', left: '{file}', center: '', right: '{date}', footer: false },
  bates: { kind: 'bates', prefix: 'DOC', start: 1 }, flatten: { kind: 'flatten' }, scrub: { kind: 'scrub' }, compact: { kind: 'compact' }, protect: { kind: 'protect', password: '' },
};

function StepFields({ s, set }: { s: Step; set: (s: Step) => void }) {
  const inp = (v: string, on: (v: string) => void, ph: string, w = 'flex-1') => <input value={v} onChange={(e) => on(e.target.value)} placeholder={ph} aria-label={ph} className={`${inputCls} ${w} py-1.5`} />;
  switch (s.kind) {
    case 'rotate': return <select value={s.degrees} onChange={(e) => set({ ...s, degrees: +e.target.value as 90 })} className={`${inputCls} w-28 py-1.5`}>{[90, 180, 270].map((d) => <option key={d} value={d}>{d}°</option>)}</select>;
    case 'watermark': return inp(s.text, (text) => set({ ...s, text }), 'Watermark text');
    case 'numbers': return inp(s.format, (format) => set({ ...s, format }), 'Format, e.g. Page {n} of {total}');
    case 'header': return <>{inp(s.left, (left) => set({ ...s, left }), 'Left')}{inp(s.right, (right) => set({ ...s, right }), 'Right')}<label className="flex items-center gap-1.5 text-[12px] text-muted"><input type="checkbox" checked={s.footer} onChange={(e) => set({ ...s, footer: e.target.checked })} />footer</label></>;
    case 'bates': return inp(s.prefix, (prefix) => set({ ...s, prefix: prefix.toUpperCase() }), 'Prefix', 'w-28');
    case 'protect': return <input type="password" value={s.password} onChange={(e) => set({ ...s, password: e.target.value })} placeholder="Password" aria-label="Password" autoComplete="new-password" className={`${inputCls} flex-1 py-1.5`} />;
    default: return <span className="text-[12px] text-faint">No options</span>;
  }
}

export function Workflow() {
  const { pdf, error, open, reset, setError } = useSinglePdf();
  const [rows, setRows] = useState<Row[]>([{ id: rid++, step: DEFAULTS.numbers }, { id: rid++, step: DEFAULTS.watermark }, { id: rid++, step: DEFAULTS.compact }]);
  const [at, setAt] = useState<number>();
  const [done, setDone] = useState<string>();
  if (!pdf) return <><Dropzone onFiles={([f]) => open(f)} /><ErrorNote error={error} /></>;
  const add = (k: Step['kind']) => setRows((r) => { const next = [...r.filter((x) => x.step.kind !== 'protect'), { id: rid++, step: DEFAULTS[k] }]; const p = r.find((x) => x.step.kind === 'protect'); return k !== 'protect' && p ? [...next, p] : next; });
  const run = async () => {
    setError(undefined); setDone(undefined);
    try {
      const out = await runWorkflow(pdf.bytes, rows.map((r) => r.step), pdf.file.name, setAt);
      const n = `${baseName(pdf.file.name)}-processed.pdf`; download(out, n);
      setDone(`${rows.length} steps · ${formatBytes(out.length)} · ${n}`);
    } catch (e) { setError((e as Error).message); } finally { setAt(undefined); }
  };
  const missingPw = rows.some((r) => r.step.kind === 'protect' && r.step.password.length < 4);
  return (
    <div>
      <FileChip file={pdf.file} extra={` · ${pdf.count} pages`} onRemove={() => { reset(); setDone(undefined); }} />
      <div className="mt-6 max-w-[760px] space-y-4 rounded-2xl border border-line bg-surface p-5">
        <p className="text-[13px] text-muted">Steps run top to bottom · drag to reorder</p>
        <Reorder.Group axis="y" values={rows} onReorder={setRows} className="space-y-2">
          {rows.map((r, i) => (
            <Reorder.Item key={r.id} value={r} className={`flex cursor-grab flex-wrap items-center gap-2 rounded-xl border bg-bg p-2.5 active:cursor-grabbing ${at === i ? 'border-accent' : 'border-line'}`}>
              <GripVertical className="size-4 text-faint" />
              <span className="grid size-6 place-items-center rounded-full bg-surface-2 text-[11px] tabular-nums">{i + 1}</span>
              <span className="w-36 text-[13.5px] font-medium">{STEP_LABEL[r.step.kind]}</span>
              <StepFields s={r.step} set={(step) => setRows((all) => all.map((x) => (x.id === r.id ? { ...x, step } : x)))} />
              <button aria-label={`Remove ${STEP_LABEL[r.step.kind]}`} onClick={() => setRows((all) => all.filter((x) => x.id !== r.id))} className="ml-auto rounded-lg p-1 text-faint hover:text-rose-400"><X className="size-4" /></button>
            </Reorder.Item>
          ))}
        </Reorder.Group>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(STEP_LABEL) as Step['kind'][]).map((k) => (
            <button key={k} onClick={() => add(k)} className="flex items-center gap-1 rounded-full border border-line px-3 py-1 text-[12.5px] text-muted hover:border-line-strong hover:text-fg"><Plus className="size-3" />{STEP_LABEL[k]}</button>
          ))}
        </div>
        <Button busy={at !== undefined} disabled={!rows.length || missingPw} onClick={run} className="w-full">{at !== undefined ? `Running step ${at + 1} of ${rows.length}…` : `Run ${rows.length} step${rows.length === 1 ? '' : 's'}`}</Button>
        {missingPw && <p className="text-[12px] text-amber-400">Set a password (4+ characters) for the protect step.</p>}
      </div>
      <ErrorNote error={error} />
      <Done show={!!done} title="Workflow done — downloading" detail={done} onAgain={() => { reset(); setDone(undefined); }} />
    </div>
  );
}
