// Pure helpers shared by tools; tested by tests/ranges.test.ts (node --test).

/**
 * Parse a page selection like "1-3, 5, 8-" against `count` pages. Returns sorted unique 1-based page numbers,
 * or throws with a message the user can act on.
 */
export function parseRanges(input: string, count: number): number[] {
  const out = new Set<number>();
  const parts = input.split(/[,\s]+/).map((p) => p.trim()).filter(Boolean);
  if (!parts.length) throw new Error('Type some pages, e.g. 1-3, 5');
  for (const part of parts) {
    const m = part.match(/^(\d*)\s*(?:-\s*(\d*))?$/);
    if (!m || (!m[1] && !m[2])) throw new Error(`“${part}” isn’t a page or range`);
    const a = m[1] ? +m[1] : 1;
    const b = part.includes('-') ? (m[2] ? +m[2] : count) : a;
    if (a < 1 || b < 1 || a > count || b > count) throw new Error(`“${part}” is outside 1–${count}`);
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) out.add(i);
  }
  return [...out].sort((x, y) => x - y);
}
