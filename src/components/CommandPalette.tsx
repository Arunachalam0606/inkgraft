import { AnimatePresence, motion } from 'motion/react';
import { CornerDownLeft, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, TOOLS, toolHref, type Tool } from '../lib/registry';
import { navigate } from '../lib/router';
import { pushRecent } from '../lib/prefs';

// subsequence match with a bonus for word starts: "mrg" -> Merge, "pdf jpg" -> PDF to JPG
export function score(tool: Tool, q: string) {
  if (!q) return 1;
  const hay = `${tool.name} ${tool.keywords ?? ''} ${tool.desc}`.toLowerCase();
  let total = 0;
  for (const part of q.toLowerCase().split(/\s+/).filter(Boolean)) {
    const name = tool.name.toLowerCase();
    if (name.startsWith(part)) { total += 6; continue; }
    if (new RegExp(`\\b${part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(hay)) { total += 3; continue; }
    let i = 0;
    for (const ch of part) { i = name.indexOf(ch, i); if (i < 0) break; i++; }
    if (i < 0) return 0;
    total += 1;
  }
  return total;
}

export function openTool(tool: Tool) {
  if (!tool.ready) return;
  pushRecent(tool.id);
  navigate(toolHref(tool));
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const results = useMemo(
    () => TOOLS.map((t) => ({ t, s: score(t, q) })).filter((r) => r.s > 0).sort((a, b) => Number(b.t.ready) - Number(a.t.ready) || b.s - a.s).map((r) => r.t),
    [q],
  );

  useEffect(() => { if (open) { setQ(''); setActive(0); requestAnimationFrame(() => input.current?.focus()); } }, [open]);
  useEffect(() => setActive(0), [q]);
  useEffect(() => { list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' }); }, [active]);

  const choose = (tool?: Tool) => { if (tool?.ready) { onClose(); openTool(tool); } };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-start justify-center px-4 pt-[12vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog" aria-modal aria-label="Search tools"
            className="relative w-full max-w-[620px] overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-[0_30px_80px_-20px_rgb(0_0_0/0.6)]"
            initial={{ y: -12, scale: 0.97, opacity: 0, filter: 'blur(6px)' }} animate={{ y: 0, scale: 1, opacity: 1, filter: 'blur(0px)' }}
            exit={{ y: -8, scale: 0.98, opacity: 0, filter: 'blur(4px)' }} transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-[18px] text-muted" />
              <input
                ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${TOOLS.length} tools…`} aria-label="Search tools"
                className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint focus-visible:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
                  if (e.key === 'Enter') choose(results[active]);
                  if (e.key === 'Escape') onClose();
                }}
              />
              <kbd className="rounded-md border border-line px-1.5 py-0.5 text-[11px] text-muted">Esc</kbd>
            </div>
            <div ref={list} className="max-h-[52vh] overflow-y-auto p-2">
              {results.length === 0 && <p className="px-3 py-10 text-center text-sm text-muted">No tool matches “{q}”.</p>}
              {results.map((tool, i) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.id} data-i={i} onMouseMove={() => setActive(i)} onClick={() => choose(tool)} disabled={!tool.ready}
                    className="relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left disabled:cursor-default"
                  >
                    {active === i && <motion.span layoutId="cmd-active" className="absolute inset-0 rounded-xl bg-surface-2" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                    <span className="relative grid size-9 place-items-center rounded-lg border border-line bg-bg"><Icon className="size-4" /></span>
                    <span className="relative min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-[14px] font-medium">{tool.name}{!tool.ready && <span className="rounded-full border border-line px-1.5 text-[10px] font-normal text-faint">Soon</span>}</span>
                      <span className="block truncate text-[12.5px] text-muted">{CATEGORIES.find((c) => c.id === tool.category)?.name} · {tool.desc}</span>
                    </span>
                    {active === i && tool.ready && <CornerDownLeft className="relative size-4 text-muted" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
