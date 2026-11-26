import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRanges } from '../src/lib/ranges.ts';

test('single pages, ranges, open ends, dedupe and sort', () => {
  assert.deepEqual(parseRanges('3, 1-2', 10), [1, 2, 3]);
  assert.deepEqual(parseRanges('8-', 10), [8, 9, 10]);
  assert.deepEqual(parseRanges('-2', 10), [1, 2]);
  assert.deepEqual(parseRanges('5-3 4', 10), [3, 4, 5]);
});

test('rejects garbage and out-of-range pages with a readable message', () => {
  assert.throws(() => parseRanges('', 5), /Type some pages/);
  assert.throws(() => parseRanges('0', 5), /outside 1–5/);
  assert.throws(() => parseRanges('2-9', 5), /outside 1–5/);
  assert.throws(() => parseRanges('a', 5), /isn’t a page/);
});
