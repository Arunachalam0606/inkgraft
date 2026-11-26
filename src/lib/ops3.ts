// Forms and workflows (pdf-lib, no DOM) — tested in tests/ops3.test.ts.
import { PDFCheckBox, PDFDropdown, PDFOptionList, PDFRadioGroup, PDFTextField, PDFDocument } from '@cantoo/pdf-lib';
import { buildFrom, load, pageNumbers, protect, watermark, type Corner } from './ops.ts';
import { bates, flatten, headerFooter, writeMeta } from './ops2.ts';

// ---------- forms ----------
export type FieldKind = 'text' | 'check' | 'choice' | 'radio';
export interface FormField { name: string; kind: FieldKind; value: string | boolean; options?: string[]; multiline?: boolean; readOnly?: boolean }

export async function readFields(bytes: Uint8Array): Promise<FormField[]> {
  const form = (await load(bytes)).getForm();
  return form.getFields().flatMap((f): FormField[] => {
    const name = f.getName(), readOnly = f.isReadOnly();
    if (f instanceof PDFTextField) return [{ name, kind: 'text', value: f.getText() ?? '', multiline: f.isMultiline(), readOnly }];
    if (f instanceof PDFCheckBox) return [{ name, kind: 'check', value: f.isChecked(), readOnly }];
    if (f instanceof PDFDropdown || f instanceof PDFOptionList) return [{ name, kind: 'choice', value: f.getSelected()[0] ?? '', options: f.getOptions(), readOnly }];
    if (f instanceof PDFRadioGroup) return [{ name, kind: 'radio', value: f.getSelected() ?? '', options: f.getOptions(), readOnly }];
    return []; // signature and button fields are not fillable here
  });
}

export async function fillFields(bytes: Uint8Array, values: Record<string, string | boolean>, lock: boolean) {
  const doc = await load(bytes);
  const form = doc.getForm();
  for (const [name, v] of Object.entries(values)) {
    const f = form.getFieldMaybe(name);
    if (!f || f.isReadOnly()) continue;
    if (f instanceof PDFTextField) f.setText(String(v));
    else if (f instanceof PDFCheckBox) { if (v) f.check(); else f.uncheck(); }
    else if ((f instanceof PDFDropdown || f instanceof PDFOptionList) && v) f.select(String(v));
    else if (f instanceof PDFRadioGroup && v) f.select(String(v));
  }
  if (lock) form.flatten(); // answers become page content every viewer shows
  else form.updateFieldAppearances();
  return doc.save();
}

// ---------- workflows ----------
export type Step =
  | { kind: 'rotate'; degrees: 90 | 180 | 270 }
  | { kind: 'watermark'; text: string; opacity: number }
  | { kind: 'numbers'; position: Corner; format: string }
  | { kind: 'header'; left: string; center: string; right: string; footer: boolean }
  | { kind: 'bates'; prefix: string; start: number }
  | { kind: 'flatten' }
  | { kind: 'scrub' }
  | { kind: 'compact' }
  | { kind: 'protect'; password: string };

export const STEP_LABEL: Record<Step['kind'], string> = {
  rotate: 'Rotate all pages', watermark: 'Watermark', numbers: 'Page numbers', header: 'Header / footer', bates: 'Bates numbers',
  flatten: 'Flatten', scrub: 'Wipe metadata', compact: 'Compact (lossless)', protect: 'Password-protect',
};

/** Run steps in order; protect must be last (nothing can edit an encrypted file afterwards). */
export async function runWorkflow(bytes: Uint8Array, steps: Step[], file: string, onStep?: (i: number) => void) {
  const pi = steps.findIndex((s) => s.kind === 'protect');
  if (pi >= 0 && pi !== steps.length - 1) throw new Error('Password-protect has to be the last step.');
  let b = bytes;
  for (const [i, s] of steps.entries()) {
    onStep?.(i);
    switch (s.kind) {
      case 'rotate': { const n = (await PDFDocument.load(b)).getPageCount(); b = await buildFrom(b, Array.from({ length: n }, (_, index) => ({ index, rotate: s.degrees }))); break; }
      case 'watermark': b = await watermark(b, { text: s.text, size: 56, opacity: s.opacity, angle: 45, color: [0.45, 0.47, 0.5] }); break;
      case 'numbers': b = await pageNumbers(b, { position: s.position, format: s.format, start: 1, size: 10, margin: 26 }); break;
      case 'header': { const band = { left: s.left, center: s.center, right: s.right }, none = { left: '', center: '', right: '' }; b = await headerFooter(b, s.footer ? none : band, s.footer ? band : none, file); break; }
      case 'bates': b = (await bates(b, { prefix: s.prefix, suffix: '', start: s.start, digits: 6 })).bytes; break;
      case 'flatten': b = await flatten(b); break;
      case 'scrub': b = await writeMeta(b, { title: '', author: '', subject: '', keywords: '', creator: '', producer: '' }, true); break;
      case 'compact': b = await (await PDFDocument.load(b)).save({ useObjectStreams: true }); break;
      case 'protect': b = await protect(b, s.password, { printing: true, copying: false, modifying: false }); break;
    }
  }
  return b;
}
