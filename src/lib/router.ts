import { useSyncExternalStore } from 'react';

// Tiny history router: the site has three route shapes, a router dependency is not worth it.
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
window.addEventListener('popstate', notify);

export function navigate(to: string) {
  if (to === location.pathname) return;
  // standalone pages (the Scan Editor) live outside the React app
  if (to.startsWith('/editor/')) { location.href = to; return; }
  history.pushState(null, '', to);
  window.scrollTo({ top: 0 });
  notify();
}

export function usePath() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => location.pathname);
}
