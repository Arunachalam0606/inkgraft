// Pure text helpers over OCR lines ({ words: [{ text, ... }] }). Shared by the app and test.js.
(function (root) {
  function lineText(words) {
    let text = '';
    const starts = [];
    words.forEach((w, i) => {
      if (i) text += ' ';
      starts.push(text.length);
      text += w.text;
    });
    return { text, starts };
  }

  function wordAt(starts, pos) {
    let i = 0;
    while (i + 1 < starts.length && starts[i + 1] <= pos) i++;
    return i;
  }

  // -> [{ li, wi, wj, start, end, text }]; wi..wj = words touched, start/end = char range in line text
  function findInLines(lines, query, caseSensitive) {
    const q = query.trim().replace(/\s+/g, ' ');
    if (!q) return [];
    const nq = caseSensitive ? q : q.toLowerCase();
    const out = [];
    lines.forEach((ln, li) => {
      const { text, starts } = lineText(ln.words);
      const t = caseSensitive ? text : text.toLowerCase();
      for (let k = t.indexOf(nq); k >= 0; k = t.indexOf(nq, k + nq.length)) {
        out.push({ li, wi: wordAt(starts, k), wj: wordAt(starts, k + nq.length - 1), start: k, end: k + nq.length, text });
      }
    });
    return out;
  }

  // Full new text for words wi..wj once chars [start,end) are replaced (keeps partial-word prefix/suffix).
  function replacedSpan(words, m, repl) {
    const { text, starts } = lineText(words);
    const s = starts[m.wi];
    const e = starts[m.wj] + words[m.wj].text.length;
    return text.slice(s, m.start) + repl + text.slice(m.end, e);
  }

  const api = { lineText, wordAt, findInLines, replacedSpan };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TextOps = api;
})(this);
