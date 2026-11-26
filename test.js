// node test.js
const assert = require('assert');
const T = require('./textops.js');

const L = (...w) => ({ words: w.map((text) => ({ text })) });
const lines = [L('Date', ':26th', 'October', '2026.'), L('for', 'the', 'month', 'of', 'October', '2026.')];

let m = T.findInLines(lines, 'october', false);
assert.strictEqual(m.length, 2);
assert.deepStrictEqual([m[0].li, m[0].wi, m[0].wj], [0, 2, 2]);
assert.strictEqual(T.replacedSpan(lines[0].words, m[0], 'November'), 'November');

// partial word keeps punctuation
m = T.findInLines(lines, '2026', false);
assert.strictEqual(T.replacedSpan(lines[1].words, m[1], '2027'), '2027.');

// multi-word phrase, extra spaces in query
m = T.findInLines(lines, 'October   2026', true);
assert.strictEqual(m.length, 2);
assert.deepStrictEqual([m[1].wi, m[1].wj], [4, 5]);
assert.strictEqual(T.replacedSpan(lines[1].words, m[1], 'November 2026'), 'November 2026.');

// case sensitivity + empty
assert.strictEqual(T.findInLines(lines, 'october', true).length, 0);
assert.strictEqual(T.findInLines(lines, '  ', false).length, 0);

console.log('textops ok');
