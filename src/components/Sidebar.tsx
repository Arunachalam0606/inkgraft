import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight, Clock, LayoutDashboard, Moon, Search, Star, Sun } from 'lucide-react';
import { useState } from 'react';
import { CATEGORIES, TOOLS, toolById, toolHref } from '../lib/registry';
import { navigate, usePath } from '../lib/router';
import { applyTheme, recent, starred, theme } from '../lib/prefs';
import { Logo } from './Logo';
import { openTool } from './CommandPalette';

// lucide dropped brand marks: GitHub's own mark, inline
const GithubMark = () => (
  <svg viewBox="0 0 16 16" className="size-[17px]" fill="currentColor" aria-hidden><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
);

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

function NavItem({ icon: Icon, label, active, onClick, count }: { icon: typeof Star; label: string; active?: boolean; onClick: () => void; count?: number }) {
  return (
    <button onClick={onClick} className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition-colors ${active ? 'text-fg' : 'text-muted hover:text-fg'}`}>
      {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-lg bg-surface-2" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
      <Icon className="relative size-[17px]" />
      <span className="relative flex-1 text-left">{label}</span>
      {count !== undefined && count > 0 && <span className="relative text-[12px] text-faint tabular-nums">{count}</span>}
    </button>
  );
}

export function Sidebar({ onSearch, onNavigate }: { onSearch: () => void; onNavigate?: () => void }) {
  const path = usePath();
  const stars = starred.use();
  const recents = recent.use();
  const th = theme.use();
  const [openCat, setOpenCat] = useState<string | null>(null);
  const go = (to: string) => { navigate(to); onNavigate?.(); };

  return (
    <nav aria-label="Main" className="flex h-full flex-col gap-1 overflow-y-auto px-3 pb-4 no-scrollbar">
      <button onClick={() => go('/')} className="mx-2 mt-5 mb-4 self-start" aria-label="inkgraft home"><Logo /></button>

      <button onClick={onSearch} className="group mb-3 flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-[14px] text-faint transition-colors hover:border-line-strong hover:text-muted">
        <Search className="size-4" /><span className="flex-1 text-left">Search tools</span>
        <kbd className="rounded-md border border-line px-1.5 text-[11px]">{isMac ? '⌘' : 'Ctrl'} K</kbd>
      </button>

      <NavItem icon={LayoutDashboard} label="Dashboard" active={path === '/'} onClick={() => go('/')} />
      <NavItem icon={Clock} label="Recent" active={path === '/recent'} onClick={() => go('/recent')} count={recents.length} />
      <NavItem icon={Star} label="Starred" active={path === '/starred'} onClick={() => go('/starred')} count={stars.length} />

      <p className="mt-6 mb-1 px-3 text-[12px] font-medium text-faint">Tools</p>
      {CATEGORIES.map((c) => {
        const tools = TOOLS.filter((t) => t.category === c.id);
        const open = openCat === c.id;
        return (
          <div key={c.id}>
            <button
              onClick={() => setOpenCat(open ? null : c.id)} aria-expanded={open}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[14px] text-muted transition-colors hover:bg-surface hover:text-fg"
            >
              <span className="flex-1 text-left">{c.name}</span>
              <span className="text-[12px] text-faint tabular-nums">{tools.filter((t) => t.ready).length}/{tools.length}</span>
              <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}><ChevronRight className="size-4 text-faint" /></motion.span>
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
                  {tools.map((t) => (
                    <li key={t.id}>
                      <button
                        onClick={() => { if (t.ready) { openTool(t); onNavigate?.(); } }} disabled={!t.ready}
                        className={`ml-4 flex w-[calc(100%-1rem)] items-center gap-2 border-l border-line py-1.5 pl-4 text-left text-[13px] transition-colors ${path === toolHref(t) ? 'border-accent text-fg' : t.ready ? 'text-muted hover:text-fg' : 'text-faint'}`}
                      >
                        <span className="flex-1 truncate">{t.name}</span>
                        {!t.ready && <span className="mr-2 text-[10px]">Soon</span>}
                      </button>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {stars.length > 0 && (
        <>
          <p className="mt-6 mb-1 px-3 text-[12px] font-medium text-faint">Starred</p>
          {stars.map((id) => { const t = toolById(id); return t && <NavItem key={id} icon={t.icon} label={t.name} active={path === toolHref(t)} onClick={() => { openTool(t); onNavigate?.(); }} />; })}
        </>
      )}

      <div className="mt-auto flex items-center gap-1 pt-6">
        <button
          onClick={() => { const n = th === 'dark' ? 'light' : 'dark'; theme.set(n); applyTheme(n); }}
          className="flex flex-1 items-center gap-3 rounded-lg px-3 py-2 text-[14px] text-muted transition-colors hover:bg-surface hover:text-fg"
          aria-label={`Switch to ${th === 'dark' ? 'light' : 'dark'} theme`}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={th} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
              {th === 'dark' ? <Sun className="size-[17px]" /> : <Moon className="size-[17px]" />}
            </motion.span>
          </AnimatePresence>
          {th === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
        <a href="https://github.com/Arunachalam0606/inkgraft" target="_blank" rel="noreferrer" className="rounded-lg p-2 text-muted transition-colors hover:bg-surface hover:text-fg" aria-label="Source on GitHub"><GithubMark /></a>
      </div>
    </nav>
  );
}
