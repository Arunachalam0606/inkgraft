import { useEffect, useState } from 'react';
import { Button, Done, Dropzone, ErrorNote, Group, Segmented } from '../components/ui';
import { PreviewPane } from '../components/pages';
import { download, formatBytes, openPdf, renderPage } from '../lib/pdf';
import { inline, parseCsv, parseMarkdown, render, textBlocks, type Block } from '../lib/compose';
import { unsupportedChars } from '../lib/ops';

type Kind = 'txt' | 'md' | 'html' | 'csv';
const META: Record<Kind, { accept: string; label: string; sample: string; out: string }> = {
  txt: { accept: '.txt,text/plain', label: 'a .txt file', out: 'text.pdf', sample: 'Meeting notes — 26 Nov 2026\n\nAttendees: Sam, Priya\n\n1. Renew the support contract for November.\n2. Send the bill by Friday.' },
  md: { accept: '.md,.markdown,text/markdown', label: 'a Markdown file', out: 'document.pdf', sample: '# Project update\n\nThe **Scan Editor** now clones letters from the scan.\n\n## Next\n\n- Camera scanner\n- GST invoice\n  - CGST / SGST split\n\n> Everything runs on your device.\n\n| Tool | Status |\n|---|---|\n| Merge | Ready |\n| OCR | Ready |' },
  html: { accept: '.html,.htm,text/html', label: 'an HTML file', out: 'page.pdf', sample: '<h1>Receipt</h1><p>Thank you for your <b>payment</b>.</p><ul><li>Plan: Pro</li><li>Paid: Rs. 1,200</li></ul><table><tr><th>Item</th><th>Amount</th></tr><tr><td>Pro plan</td><td>1,200</td></tr></table>' },
  csv: { accept: '.csv,text/csv', label: 'a CSV file', out: 'table.pdf', sample: 'Date,Description,Amount\n2026-11-01,Office rent,"25,000"\n2026-11-05,Internet,1199\n2026-11-12,"Printer ink, black",850' },
};

/** HTML → blocks with DOMParser (it builds an inert document: no scripts run, nothing loads). */
function htmlBlocks(html: string): Block[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out: Block[] = [];
  const runsOf = (el: Element) => {
    let md = '';
    el.childNodes.forEach((n) => {
      if (n.nodeType === 3) md += n.textContent;
      else if (n instanceof Element) {
        const t = n.textContent ?? '';
        md += /^(B|STRONG)$/.test(n.tagName) ? `**${t}**` : /^(I|EM)$/.test(n.tagName) ? `*${t}*` : n.tagName === 'CODE' ? `\`${t}\`` : n.tagName === 'A' && n.getAttribute('href') ? `${t} (${n.getAttribute('href')})` : n.tagName === 'BR' ? ' ' : t;
      }
    });
    return inline(md.replace(/\s+/g, ' ').trim());
  };
  const walk = (el: Element, depth = 0) => {
    for (const c of Array.from(el.children)) {
      const tag = c.tagName;
      if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|HEAD)$/.test(tag)) continue;
      if (/^H[1-6]$/.test(tag)) out.push({ kind: tag === 'H1' ? 'h1' : tag === 'H2' ? 'h2' : 'h3', runs: runsOf(c) });
      else if (tag === 'P') out.push({ kind: 'p', runs: runsOf(c) });
      else if (tag === 'PRE') out.push({ kind: 'code', text: c.textContent ?? '' });
      else if (tag === 'BLOCKQUOTE') out.push({ kind: 'quote', runs: runsOf(c) });
      else if (tag === 'HR') out.push({ kind: 'hr' });
      else if (tag === 'UL' || tag === 'OL') Array.from(c.children).forEach((li, i) => { out.push({ kind: 'li', runs: runsOf(li), marker: tag === 'OL' ? `${i + 1}.` : '•', depth }); const sub = li.querySelector(':scope > ul, :scope > ol'); if (sub) walk(li, depth + 1); });
      else if (tag === 'TABLE') out.push({ kind: 'table', rows: Array.from(c.querySelectorAll('tr')).map((tr) => Array.from(tr.children).map((td) => (td.textContent ?? '').trim())), header: !!c.querySelector('th') });
      else if (c.children.length) walk(c, depth);
      else if (c.textContent?.trim()) out.push({ kind: 'p', runs: inline(c.textContent.trim()) });
    }
  };
  walk(doc.body);
  return out;
}

function blocksFor(kind: Kind, text: string): { blocks: Block[]; landscape: boolean; mono: boolean } {
  if (kind === 'md') return { blocks: parseMarkdown(text), landscape: false, mono: false };
  if (kind === 'html') return { blocks: htmlBlocks(text), landscape: false, mono: false };
  if (kind === 'csv') { const rows = parseCsv(text); return { blocks: [{ kind: 'table', rows, header: true }], landscape: Math.max(0, ...rows.map((r) => r.length)) > 6, mono: false }; }
  return { blocks: textBlocks(text), landscape: false, mono: true };
}

export function TextConvert({ kind }: { kind: Kind }) {
  const meta = META[kind];
  const [text, setText] = useState('');
  const [name, setName] = useState(meta.out);
  const [orient, setOrient] = useState<'auto' | 'portrait' | 'landscape'>('auto');
  const [preview, setPreview] = useState<string>();
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();
  const [busy, setBusy] = useState(false);
  const bad = unsupportedChars(text.replace(/[\n\r\t]/g, ''));

  const build = async () => {
    const b = blocksFor(kind, text);
    return render(b.blocks, { title: name.replace(/\.pdf$/, ''), landscape: orient === 'auto' ? b.landscape : orient === 'landscape', mono: b.mono });
  };
  useEffect(() => {
    if (!text.trim()) { setPreview(undefined); return; }
    let alive = true;
    const t = setTimeout(async () => {
      try { const doc = await openPdf(await build()); const c = await renderPage(doc, 1, { width: 520 }); void doc.loadingTask.destroy(); if (alive) { setPreview(c.toDataURL('image/jpeg', 0.85)); setError(undefined); } }
      catch (e) { if (alive) setError((e as Error).message); }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [text, orient]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setBusy(true);
    try { const out = await build(); const n = name.endsWith('.pdf') ? name : `${name}.pdf`; download(out, n); setDone(`${(await openPdf(out)).numPages} page(s) · ${formatBytes(out.length)} · ${n}`); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <div className="space-y-4">
        <Dropzone accept={meta.accept} label={`Drop ${meta.label}, or type below`} onFiles={async ([f]) => { setText(await f.text()); setName(f.name.replace(/\.[^.]+$/, '') + '.pdf'); setDone(undefined); }} />
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-muted">Content</span>
          <button onClick={() => setText(meta.sample)} className="text-[12px] text-ink underline underline-offset-4">Try a sample</button>
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} aria-label="Content to convert"
          className="h-72 w-full resize-y rounded-2xl border border-line-strong bg-bg p-4 font-mono text-[13px] leading-relaxed outline-none focus:border-accent" placeholder={meta.sample.split('\n')[0]} />
        <div className="flex flex-wrap items-end gap-4">
          <Group label="Orientation"><Segmented id={`or-${kind}`} value={orient} onChange={setOrient} options={[{ value: 'auto', label: 'Auto' }, { value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }]} /></Group>
          <Button className="ml-auto" busy={busy} disabled={!text.trim()} onClick={save}>Create PDF</Button>
        </div>
        {bad.length > 0 && <p className="text-[13px] text-amber-400">The built-in PDF fonts can’t draw {bad.slice(0, 4).join(' ')} — those characters will show as “?”.</p>}
        <ErrorNote error={error} />
        <Done show={!!done} title="Created — downloading" detail={done} onAgain={() => { setText(''); setDone(undefined); }} />
      </div>
      <PreviewPane url={preview} />
    </div>
  );
}

export const Txt = () => <TextConvert kind="txt" />;
export const Md = () => <TextConvert kind="md" />;
export const Html = () => <TextConvert kind="html" />;
export const Csv = () => <TextConvert kind="csv" />;
