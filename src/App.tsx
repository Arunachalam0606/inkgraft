import { AnimatePresence, motion } from 'motion/react';
import { Menu, X } from 'lucide-react';
import { Suspense, lazy, useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { CommandPalette } from './components/CommandPalette';
import { Logo } from './components/Logo';
import Dashboard from './pages/Dashboard';
import ListPage from './pages/ListPage';
import { usePath } from './lib/router';
import { recent, starred } from './lib/prefs';
import { toolById } from './lib/registry';

const ToolPage = lazy(() => import('./pages/ToolPage'));

function Route({ path, onSearch }: { path: string; onSearch: () => void }) {
  const stars = starred.use();
  const recents = recent.use();
  if (path === '/recent') return <ListPage title="Recent" ids={recents} empty="Tools you open show up here, on this device only." />;
  if (path === '/starred') return <ListPage title="Starred" ids={stars} empty="Star a tool with the ☆ on its row to keep it here." />;
  const m = path.match(/^\/tools\/([a-z0-9-]+)\/?$/);
  const tool = m && toolById(m[1]);
  if (tool?.ready) return <Suspense fallback={<div className="p-10 text-muted">Loading…</div>}><ToolPage tool={tool} /></Suspense>;
  return <Dashboard onSearch={onSearch} />;
}

export default function App() {
  const path = usePath();
  const [palette, setPalette] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => setDrawer(false), [path]);

  return (
    <div className="grain min-h-dvh lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="sticky top-0 hidden h-dvh border-r border-line bg-bg lg:block">
        <Sidebar onSearch={() => setPalette(true)} />
      </aside>

      {/* phone / tablet header + drawer */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Logo />
        <button onClick={() => setDrawer(true)} className="rounded-lg p-2 text-muted hover:text-fg" aria-label="Open menu"><Menu className="size-5" /></button>
      </header>
      <AnimatePresence>
        {drawer && (
          <motion.div className="fixed inset-0 z-40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDrawer(false)} />
            <motion.aside className="absolute inset-y-0 left-0 w-[300px] max-w-[86vw] border-r border-line bg-bg"
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 380, damping: 38 }}>
              <button onClick={() => setDrawer(false)} className="absolute top-5 right-3 rounded-lg p-2 text-muted hover:text-fg" aria-label="Close menu"><X className="size-5" /></button>
              <Sidebar onSearch={() => { setDrawer(false); setPalette(true); }} onNavigate={() => setDrawer(false)} />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="min-w-0">
        <AnimatePresence mode="wait">
          <motion.div key={path} initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
            <Route path={path} onSearch={() => setPalette(true)} />
          </motion.div>
        </AnimatePresence>
        <footer className="border-t border-line px-6 py-8 text-[13px] text-faint sm:px-10">
          inkgraft runs entirely in your browser — files are processed on your device and never uploaded. ·{' '}
          <a className="underline decoration-line-strong underline-offset-4 hover:text-fg" href="https://github.com/Arunachalam0606/inkgraft" target="_blank" rel="noreferrer">Open source</a>
        </footer>
      </main>

      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}
