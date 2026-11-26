// Personal-data detection over positioned words. Pure; tested in tests/pii.test.ts.

export type PiiKind = 'Aadhaar' | 'PAN' | 'Card' | 'Email' | 'Phone' | 'IFSC' | 'Account';
export interface Word { text: string; x: number; y: number; w: number; h: number } // any consistent unit, top-left origin
export interface Hit { kind: PiiKind; text: string; boxes: Word[] }

// Verhoeff checksum (Aadhaar's last digit)
const D = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
const PERM = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,8,7,6,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
export const verhoeff = (num: string) => [...num].reverse().reduce((c, d, i) => D[c][PERM[i % 8][+d]], 0) === 0;
export const luhn = (num: string) => [...num].reverse().reduce((s, d, i) => { let v = +d; if (i % 2) { v *= 2; if (v > 9) v -= 9; } return s + v; }, 0) % 10 === 0;

const RULES: { kind: PiiKind; re: RegExp; ok?: (digits: string) => boolean }[] = [
  { kind: 'Aadhaar', re: /\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/g, ok: (d) => d.length === 12 && verhoeff(d) },
  { kind: 'Card', re: /\b(?:\d[\s-]?){12,18}\d\b/g, ok: (d) => d.length >= 13 && d.length <= 19 && luhn(d) },
  { kind: 'PAN', re: /\b[A-Z]{3}[PCHFATBLJG][A-Z]\d{4}[A-Z]\b/g },
  { kind: 'IFSC', re: /\b[A-Z]{4}[0O][A-Z0-9]{6}\b/g }, // OCR reads the fixed 0 as O
  { kind: 'Email', re: /\b[\w.+-]+@ ?[\w-]+(?:\.[\w-]+)+\b/g }, // OCR often reads "name@ gmail.com"
  { kind: 'Phone', re: /(?:\+91[\s-]?|\b0)?\b[6-9]\d{4}[\s-]?\d{5}\b/g },
  // account numbers only when labelled, e.g. "A/C No: 123456789012"
  { kind: 'Account', re: /\b(?:a\/c|acct|account)\s*(?:no\.?|number|#)?\s*[:.-]?\s*(\d{9,18})\b/gi },
];

/** Find PII in a line-ordered list of words; returns hits with the word boxes they cover. */
export function findPii(words: Word[], kinds: PiiKind[] = RULES.map((r) => r.kind)): Hit[] {
  // join words with single spaces, remembering each word's character span
  let text = '';
  const spans = words.map((w) => { const start = text.length ? text.length + 1 : 0; text += (text.length ? ' ' : '') + w.text; return [start, start + w.text.length] as const; });
  const hits: Hit[] = [];
  const taken: [number, number][] = [];
  for (const rule of RULES) {
    if (!kinds.includes(rule.kind)) continue;
    for (const m of text.matchAll(rule.re)) {
      let a = m.index!, b = a + m[0].length;
      if (rule.kind === 'Account' && m[1]) { a = a + m[0].lastIndexOf(m[1]); b = a + m[1].length; }
      const digits = text.slice(a, b).replace(/\D/g, '');
      if (rule.ok && !rule.ok(digits)) continue;
      if (taken.some(([x, y]) => a < y && b > x)) continue; // first rule wins (a card number is not also a phone)
      taken.push([a, b]);
      const boxes = words.filter((_, i) => spans[i][0] < b && spans[i][1] > a);
      if (boxes.length) hits.push({ kind: rule.kind, text: text.slice(a, b), boxes });
    }
  }
  return hits;
}
