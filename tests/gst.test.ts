// Synthetic values only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeInvoice, inWords, money, validGstin } from '../src/lib/gst.ts';

test('Indian money format', () => {
  assert.equal(money(13600000), '1,36,000.00');
  assert.equal(money(123456789), '12,34,567.89');
  assert.equal(money(5), '0.05');
});

test('amount in words, Indian system', () => {
  assert.equal(inWords(13600000), 'Rupees One Lakh Thirty Six Thousand Only');
  assert.equal(inWords(2500000050), 'Rupees Two Crore Fifty Lakh and Fifty Paise Only');
  assert.equal(inWords(101), 'Rupees One and One Paise Only');
  assert.equal(inWords(0), 'Rupees Zero Only');
});

test('intra-state splits CGST/SGST, inter-state is IGST, grand total rounds to the rupee', () => {
  const items = [{ name: 'Service', hsn: '998313', qty: 1, rate: 1000, gst: 18 }, { name: 'Paper', hsn: '4802', qty: 3, rate: 33.33, gst: 12 }];
  const intra = computeInvoice(items, false);
  assert.equal(intra.taxable, 109999);
  assert.equal(intra.tax, 18000 + 1200);
  assert.equal(intra.cgst + intra.sgst, intra.tax);
  assert.equal(intra.igst, 0);
  assert.equal(intra.grand % 100, 0);
  assert.equal(intra.grand - intra.roundOff, intra.taxable + intra.tax);
  assert.deepEqual(intra.byRate.map((r) => r.gst), [12, 18]);
  const inter = computeInvoice(items, true);
  assert.equal(inter.igst, inter.tax); assert.equal(inter.cgst, 0);
});

test('GSTIN checksum', () => {
  assert.equal(validGstin('27AAPFU0939F1ZV'), true);  // the widely published sample GSTIN
  assert.equal(validGstin('27AAPFU0939F1ZX'), false);
  assert.equal(validGstin('hello'), false);
});

import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { invoicePdf, receiptPdf } from '../src/lib/invoicePdf.ts';
const pdfText = async (b: Uint8Array) => (await (await (await getDocument({ data: b.slice() }).promise).getPage(1)).getTextContent()).items.map((t: any) => t.str).join(' ').replace(/\s+/g, ' ');

test('invoice PDF carries the right totals and words; ₹ becomes Rs.', async () => {
  const party = { name: 'Acme Traders', address: '1 Example Street, Chennai', gstin: '33AAAAA0000A1Z5', state: 'Tamil Nadu' };
  const { bytes, totals } = await invoicePdf({ seller: party, buyer: { ...party, name: 'Buyer Co' }, number: 'INV-7', date: '26/11/2026', interState: false, items: [{ name: 'Contract charge ₹', hsn: '998313', qty: 1, rate: 100000, gst: 18 }] });
  const s = await pdfText(bytes);
  assert.equal(totals.grand, 11800000);
  for (const want of ['TAX INVOICE', 'INV-7', '1,18,000.00', 'CGST', '9,000.00', 'Rupees One Lakh Eighteen Thousand Only', 'Rs.']) assert.ok(s.includes(want), want);
});

test('receipt backs GST out of inclusive prices', async () => {
  const { bytes, totals } = await receiptPdf({ shop: 'Corner Store', address: 'Main Road', number: '42', date: '26/11/2026', gstInclusive: true, payment: 'UPI', items: [{ name: 'Tea', hsn: '0902', qty: 2, rate: 105, gst: 5 }] });
  assert.equal(totals.grand, 21000);
  assert.ok((await pdfText(bytes)).includes('TOTAL Rs.'));
});

test('invoice columns never overlap: tax and amount sit apart', async () => {
  const party = { name: 'A', address: '', gstin: '', state: '' };
  const { bytes } = await invoicePdf({ seller: party, buyer: party, number: '1', date: '1/1/2026', interState: false, items: [{ name: 'X', hsn: '1', qty: 1, rate: 1000, gst: 18 }] });
  const items = (await (await (await getDocument({ data: bytes.slice() }).promise).getPage(1)).getTextContent()).items as any[];
  const tax = items.find((t) => t.str === '180.00'), amt = items.find((t) => t.str === '1,180.00');
  assert.ok(tax && amt && tax.transform[4] + tax.width < amt.transform[4], 'tax ends before amount starts');
});
