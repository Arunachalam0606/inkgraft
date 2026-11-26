// GST invoice maths and Indian-style amounts. Pure; tested in tests/gst.test.ts. All money is handled in paise.

export interface Item { name: string; hsn: string; qty: number; rate: number; gst: number } // rate = price per unit before tax (₹)
export interface Line extends Item { taxable: number; tax: number; total: number }
export interface Totals { lines: Line[]; taxable: number; cgst: number; sgst: number; igst: number; tax: number; roundOff: number; grand: number; byRate: { gst: number; taxable: number; tax: number }[] }

const paise = (rupees: number) => Math.round(rupees * 100);

/** Intra-state supply splits GST into equal CGST + SGST; inter-state charges IGST. Grand total is rounded to the rupee. */
export function computeInvoice(items: Item[], interState: boolean): Totals {
  const lines = items.filter((i) => i.qty > 0).map((i) => {
    const taxable = paise(i.qty * i.rate);
    const tax = Math.round((taxable * i.gst) / 100);
    return { ...i, taxable, tax, total: taxable + tax };
  });
  const taxable = lines.reduce((s, l) => s + l.taxable, 0);
  const tax = lines.reduce((s, l) => s + l.tax, 0);
  const cgst = interState ? 0 : Math.floor(tax / 2), sgst = interState ? 0 : tax - Math.floor(tax / 2);
  const exact = taxable + tax, grand = Math.round(exact / 100) * 100;
  const rates = new Map<number, { gst: number; taxable: number; tax: number }>();
  for (const l of lines) { const r = rates.get(l.gst) ?? { gst: l.gst, taxable: 0, tax: 0 }; r.taxable += l.taxable; r.tax += l.tax; rates.set(l.gst, r); }
  return { lines, taxable, cgst, sgst, igst: interState ? tax : 0, tax, roundOff: grand - exact, grand, byRate: [...rates.values()].sort((a, b) => a.gst - b.gst) };
}

/** 1234567 paise -> "12,345.67" with Indian digit grouping. */
export function money(p: number) {
  const neg = p < 0, abs = Math.abs(p), r = Math.floor(abs / 100), ps = String(abs % 100).padStart(2, '0');
  const s = String(r), last3 = s.slice(-3), rest = s.slice(0, -3);
  return `${neg ? '-' : ''}${rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' : ''}${last3}.${ps}`;
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const two = (n: number) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`);
const three = (n: number) => [n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred` : '', n % 100 ? two(n % 100) : ''].filter(Boolean).join(' ');

/** Indian system: crore, lakh, thousand. 13600000 paise -> "Rupees One Lakh Thirty Six Thousand Only". */
export function inWords(p: number) {
  let r = Math.floor(Math.abs(p) / 100);
  const ps = Math.abs(p) % 100;
  if (r === 0 && ps === 0) return 'Rupees Zero Only';
  const parts: string[] = [];
  const crore = Math.floor(r / 1e7); r %= 1e7;
  const lakh = Math.floor(r / 1e5); r %= 1e5;
  const thousand = Math.floor(r / 1000); r %= 1000;
  if (crore) parts.push(`${crore >= 1000 ? inWords(crore * 100).replace(/^Rupees | Only$/g, '') : three(crore) || two(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (r) parts.push(three(r));
  const rupees = parts.join(' ');
  return `${rupees ? `Rupees ${rupees}` : ''}${ps ? `${rupees ? ' and ' : ''}${two(ps)} Paise` : ''} Only`;
}

/** GSTIN: 2-digit state code, PAN, entity digit, 'Z', checksum (base-36 mod 36). */
export function validGstin(g: string) {
  const s = g.trim().toUpperCase();
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(s)) return false;
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let sum = 0;
  for (let i = 0; i < 14; i++) { const v = chars.indexOf(s[i]) * (i % 2 ? 2 : 1); sum += Math.floor(v / 36) + (v % 36); }
  return chars[(36 - (sum % 36)) % 36] === s[14];
}
