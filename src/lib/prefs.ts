import { useSyncExternalStore } from 'react';

// Per-viewer conveniences (starred tools, recent tools, theme). Storage can throw in private windows: fail soft.
const read = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* not persisted */ } };

function store<T>(key: string, initial: T) {
  let value = read(key, initial);
  const ls = new Set<() => void>();
  return {
    get: () => value,
    set(next: T) { value = next; write(key, next); ls.forEach((l) => l()); },
    use: () => useSyncExternalStore((l) => { ls.add(l); return () => ls.delete(l); }, () => value),
  };
}

export const starred = store<string[]>('ig.starred', []);
export const recent = store<string[]>('ig.recent', []);
export const theme = store<'dark' | 'light'>('ig.theme', 'dark');

export const toggleStar = (id: string) => {
  const s = starred.get();
  starred.set(s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
};
export const pushRecent = (id: string) => recent.set([id, ...recent.get().filter((x) => x !== id)].slice(0, 8));

export function applyTheme(t: 'dark' | 'light') {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#07080a' : '#f6f5f1');
}
applyTheme(theme.get());
