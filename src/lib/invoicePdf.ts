// Tax invoice (A4) and thermal receipt (80 mm) as real-text PDFs. No DOM; tested in tests/gst.test.ts.
import { PDFDocument, PDFFont, StandardFonts, rgb } from '@cantoo/pdf-lib';
import { computeInvoice, inWords, money, type Item } from './gst.ts';
import { unsupportedChars } from './ops.ts';

export interface Party { name: string; address: string; gstin: string; state: string }
export interface InvoiceData { seller: Party; buyer: Party; number: string; date: string; items: Item[]; interState: boolean; notes?: string; bank?: string }

// The standard fonts have no ₹ glyph (WinAnsi): money is printed as "Rs." and anything else unencodable as "?".
const clean = (s: string) => [...s.replace(/₹/g, 'Rs.')].map((c) => (unsupportedChars(c).length ? '?' : c)).join('');

function writer(page: ReturnType<PDFDocument['addPage']>, fonts: { r: PDFFont; b: PDFFont }) {
  const ink = rgb(0.1, 0.11, 0.13);
  return {
    text(t: string, x: number, y: number, o: { size?: number; bold?: boolean; right?: boolean; center?: boolean; color?: ReturnType<typeof rgb> } = {}) {
      const s = clean(t), size = o.size ?? 9, f = o.bold ? fonts.b : fonts.r, w = f.widthOfTextAtSize(s, size);
      page.drawText(s, { x: o.right ? x - w : o.center ? x - w / 2 : x, y, size, font: f, color: o.color ?? ink });
    },
    wrap(t: string, x: number, y: number, maxW: number, size = 9, lead = 12) {
      let line = '', yy = y;
      for (const word of clean(t).split(/\s+/)) {
        const tryLine = line ? `${line} ${word}` : word;
        if (fonts.r.widthOfTextAtSize(tryLine, size) > maxW && line) { page.drawText(line, { x, y: yy, size, font: fonts.r, color: ink }); yy -= lead; line = word; }
        else line = tryLine;
      }
      if (line) { page.drawText(line, { x, y: yy, size, font: fonts.r, color: ink }); yy -= lead; }
      return yy;
    },
    line(x1: number, y1: number, x2: number, y2: number, w = 0.6) { page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: w, color: rgb(0.7, 0.72, 0.76) }); },
  };
}

export async function invoicePdf(d: InvoiceData) {
  const t = computeInvoice(d.items, d.interState);
  const doc = await PDFDocument.create();
  doc.setTitle(`Tax Invoice ${d.number}`);
  const page = doc.addPage([595.28, 841.89]);
  const W = writer(page, { r: await doc.embedFont(StandardFonts.Helvetica), b: await doc.embedFont(StandardFonts.HelveticaBold) });
  const L = 40, R = 555;
  let y = 800;
  W.text('TAX INVOICE', L, y, { size: 16, bold: true });
  W.text(`Invoice No: ${d.number}`, R, y + 2, { right: true, bold: true });
  W.text(`Date: ${d.date}`, R, y - 12, { right: true });
  y -= 34; W.line(L, y, R, y, 1);
  const party = (p: Party, label: string, x: number) => {
    let yy = y - 16;
    W.text(label, x, yy, { size: 8, color: rgb(0.45, 0.47, 0.52) }); yy -= 13;
    W.text(p.name, x, yy, { bold: true, size: 10 }); yy -= 13;
    yy = W.wrap(p.address, x, yy, 240);
    if (p.gstin) { W.text(`GSTIN: ${p.gstin}`, x, yy); yy -= 12; }
    if (p.state) { W.text(`State: ${p.state}`, x, yy); yy -= 12; }
    return yy;
  };
  y = Math.min(party(d.seller, 'FROM', L), party(d.buyer, 'BILL TO', 310)) - 10;
  W.text(d.interState ? 'Inter-state supply (IGST)' : 'Intra-state supply (CGST + SGST)', L, y, { size: 8, color: rgb(0.45, 0.47, 0.52) });
  y -= 14;
  // items table
  // column left edges: # | item | HSN | qty | rate | GST% | tax | amount | right margin
  const cols = [L, L + 22, L + 200, L + 255, L + 290, L + 355, L + 400, L + 462, R];
  const head = ['#', 'Item', 'HSN/SAC', 'Qty', 'Rate', 'GST %', 'Tax', 'Amount'];
  page.drawRectangle({ x: L, y: y - 6, width: R - L, height: 18, color: rgb(0.92, 0.93, 0.96) });
  // numeric columns are right-aligned to the next column's left edge
  head.forEach((h, i) => W.text(h, i >= 3 ? cols[i + 1] - 4 : cols[i] + 4, y, { bold: true, size: 8, right: i >= 3 }));
  y -= 20;
  t.lines.forEach((l, i) => {
    W.text(String(i + 1), cols[0] + 4, y, { size: 8.5 });
    W.text(l.name.slice(0, 40), cols[1] + 4, y, { size: 8.5 });
    W.text(l.hsn, cols[2] + 4, y, { size: 8.5 });
    W.text(String(l.qty), cols[4] - 4, y, { size: 8.5, right: true });
    W.text(money(Math.round(l.rate * 100)), cols[5] - 4, y, { size: 8.5, right: true });
    W.text(`${l.gst}%`, cols[6] - 4, y, { size: 8.5, right: true });
    W.text(money(l.tax), cols[7] - 4, y, { size: 8.5, right: true });
    W.text(money(l.total), cols[8] - 4, y, { size: 8.5, right: true });
    y -= 15; W.line(L, y + 9, R, y + 9, 0.3);
  });
  // totals
  y -= 6;
  const row = (label: string, v: string, bold = false) => { W.text(label, 430, y, { size: 9, bold, right: true }); W.text(v, R - 4, y, { size: 9, bold, right: true }); y -= 14; };
  row('Taxable value', money(t.taxable));
  if (d.interState) row('IGST', money(t.igst)); else { row('CGST', money(t.cgst)); row('SGST', money(t.sgst)); }
  if (t.roundOff) row('Round off', money(t.roundOff));
  W.line(330, y + 9, R, y + 9, 0.8);
  row('Total (Rs.)', money(t.grand), true);
  y -= 4;
  W.text(inWords(t.grand), L, y, { bold: true, size: 9 }); y -= 22;
  // GST summary by rate
  W.text('GST summary', L, y, { size: 8, color: rgb(0.45, 0.47, 0.52) }); y -= 13;
  for (const r of t.byRate) { W.text(`${r.gst}% on ${money(r.taxable)}`, L, y, { size: 8.5 }); W.text(d.interState ? `IGST ${money(r.tax)}` : `CGST ${money(Math.floor(r.tax / 2))} + SGST ${money(r.tax - Math.floor(r.tax / 2))}`, 250, y, { size: 8.5 }); y -= 12; }
  if (d.bank) { y -= 10; W.text('Bank details', L, y, { size: 8, color: rgb(0.45, 0.47, 0.52) }); y = W.wrap(d.bank, L, y - 13, 300, 8.5); }
  if (d.notes) { y -= 8; y = W.wrap(d.notes, L, y, R - L, 8.5); }
  W.text(`For ${d.seller.name}`, R, 110, { right: true, bold: true });
  W.text('Authorised signatory', R, 70, { right: true, size: 8 });
  W.text('This is a computer-generated invoice.', L, 40, { size: 7.5, color: rgb(0.5, 0.52, 0.56) });
  return { bytes: await doc.save(), totals: t };
}

export interface ReceiptData { shop: string; address: string; gstin?: string; number: string; date: string; items: Item[]; gstInclusive: boolean; payment: string; footer?: string }

/** 80 mm (226.77 pt) wide thermal receipt whose height fits its content. */
export async function receiptPdf(d: ReceiptData) {
  // with GST-inclusive prices, back out the pre-tax rate so the invoice maths stays the same
  const items = d.items.map((i) => (d.gstInclusive ? { ...i, rate: i.rate / (1 + i.gst / 100) } : i));
  const t = computeInvoice(items, false);
  const width = 226.77, height = 200 + t.lines.length * 26 + (d.footer ? 30 : 0);
  const doc = await PDFDocument.create();
  doc.setTitle(`Bill ${d.number}`);
  const page = doc.addPage([width, height]);
  const W = writer(page, { r: await doc.embedFont(StandardFonts.Courier), b: await doc.embedFont(StandardFonts.CourierBold) });
  const L = 10, R = width - 10, C = width / 2;
  let y = height - 22;
  W.text(d.shop.toUpperCase(), C, y, { bold: true, size: 11, center: true }); y -= 12;
  y = W.wrap(d.address, L, y, R - L, 7.5, 9.5);
  if (d.gstin) { W.text(`GSTIN ${d.gstin}`, C, y, { size: 7.5, center: true }); y -= 11; }
  W.text(`Bill ${d.number}`, L, y, { size: 7.5 }); W.text(d.date, R, y, { size: 7.5, right: true }); y -= 8;
  const dash = () => { W.text('-'.repeat(42), L, y, { size: 7.5 }); y -= 10; };
  dash();
  for (const l of t.lines) {
    W.text(l.name.slice(0, 28), L, y, { size: 8 }); y -= 10;
    const unit = d.gstInclusive ? Math.round(l.total / l.qty) : Math.round(l.rate * 100);
    W.text(`  ${l.qty} x ${money(unit)}`, L, y, { size: 8 }); W.text(money(d.gstInclusive ? l.total : l.taxable), R, y, { size: 8, right: true }); y -= 12;
  }
  dash();
  const row = (k: string, v: string, bold = false) => { W.text(k, L, y, { size: 8, bold }); W.text(v, R, y, { size: 8, bold, right: true }); y -= 11; };
  row('Subtotal', money(t.taxable));
  row('CGST', money(t.cgst)); row('SGST', money(t.sgst));
  if (t.roundOff) row('Round off', money(t.roundOff));
  row('TOTAL Rs.', money(t.grand), true);
  row('Paid by', d.payment);
  dash();
  if (d.footer) { y = W.wrap(d.footer, L, y, R - L, 7.5, 9.5); }
  W.text('Thank you!', C, 14, { size: 8, center: true, bold: true });
  return { bytes: await doc.save(), totals: t };
}
