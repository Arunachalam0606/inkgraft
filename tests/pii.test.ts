// All values below are synthetic: format-valid fakes, never real personal data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findPii, luhn, verhoeff } from '../src/lib/pii.ts';

const words = (s: string) => s.split(' ').map((text, i) => ({ text, x: i * 10, y: 0, w: 8, h: 10 }));
const kinds = (s: string) => findPii(words(s)).map((h) => [h.kind, h.text]);

test('checksums', () => {
  assert.equal(verhoeff('234123412346'), true); // the standard Verhoeff test number
  assert.equal(verhoeff('234123412345'), false);
  assert.equal(luhn('4111111111111111'), true); // the standard Visa test number
  assert.equal(luhn('4111111111111112'), false);
});

test('finds Indian PII and maps it to word boxes', () => {
  assert.deepEqual(kinds('PAN No.ABCFX1234Q'), [['PAN', 'ABCFX1234Q']]); // found even when glued to its label
  assert.deepEqual(kinds('PAN ABCFX1234Q and IFSC code:ABCD0123456'), [['PAN', 'ABCFX1234Q'], ['IFSC', 'ABCD0123456']]);
  assert.deepEqual(kinds('IFSC ABCD0123456 A/C No: 123456789012'), [['IFSC', 'ABCD0123456'], ['Account', '123456789012']]);
  assert.deepEqual(kinds('Mobile : 98765-43210'), [['Phone', '98765-43210']]);
  assert.deepEqual(kinds('mail someone@example.com now'), [['Email', 'someone@example.com']]);
  const h = findPii(words('Aadhaar 2341 2341 2346 ok'));
  assert.equal(h[0].kind, 'Aadhaar');
  assert.deepEqual(h[0].boxes.map((b) => b.text), ['2341', '2341', '2346']);
});

test('rejects numbers that fail checksums; card beats phone', () => {
  assert.deepEqual(kinds('ref 2341 2341 2345'), []);
  assert.deepEqual(kinds('card 4111 1111 1111 1111'), [['Card', '4111 1111 1111 1111']]);
});

test('OCR quirks: split email, O-for-0 in IFSC', () => {
  const h = findPii(words('E-mail : someone@ example.com. Mobile'));
  assert.equal(h[0].kind, 'Email');
  assert.deepEqual(h[0].boxes.map((b) => b.text), ['someone@', 'example.com.']);
  assert.deepEqual(kinds('branch IFSC code:ABCDO123456.'), [['IFSC', 'ABCDO123456']]);
});
