# inkgraft

Edit scanned PDFs so that the new text looks like it was always on the page.

inkgraft finds the text on a scanned page, cuts real letters out of the scan, and builds the new words from those letters. The new text has the same typeface, the same faded ink and the same tilt as the text around it. A clean computer font would stand out on a scan.

Everything runs in your browser. Your files are never uploaded.

Live app: https://inkgraft.vercel.app

## What it does

- **Type on the page:** click a word and type. You see the result on the page as you type. Press Enter to apply or Esc to cancel. Shift-click selects more words, and double-click selects the whole line.
- **Find & replace:** search the recognised text of every page, then replace one match or all of them. Replacing part of a word keeps the rest, so `2026` → `2027` keeps the full stop in `2026.`.
- **Letters from the scan:** when a page opens, inkgraft collects clean letters from the scan and uses them to build new words.
  - **Same size and baseline:** each new letter is fitted to the word it replaces.
  - **Matched ink:** each letter's ink colour and darkness are adjusted to match the word being replaced.
- **Matching font when a letter is missing:** if the scan has no clean copy of a letter, inkgraft draws it in the installed font closest to the page's typeface. The letter is sized to the page's capital height and x-height, and given a scan-like texture.
- **Natural layout:** when the new text is longer or shorter, the rest of the phrase slides over. Columns, amounts, ruled lines and stray marks stay where they are.
- **Move, resize, rotate:** select any text and use the handles:
  - ✥ moves it.
  - ◢ resizes it.
  - ↻ rotates it by 0.1° per pixel dragged (hold Shift for finer steps).
- **Undo and history:** ⌘Z / Ctrl+Z undoes. Each replace-all, typed edit or drag is a single undo step. The sidebar lists every change and says which letters came from the scan and which from a font.
- **Export:** saves `<name>-edited.pdf` at the original page size.

## How it works

1. **Rasterise:** [pdf.js](https://mozilla.github.io/pdf.js/) renders each page at 216 dpi.
2. **Read the text:** [Tesseract.js](https://tesseract.projectnaptha.com/) finds words, boxes and baselines. The page tilt is the median angle of the line baselines.
3. **Tighten word boxes:** text-recognition boxes are often loose or clipped. inkgraft trims each box to the actual ink.
   - Ruled lines and the lines above or below are dropped.
   - Pieces of faded letters that fall apart (an "O" printed as "( )") are put back together.
4. **Cut letters out (on page open):**
   - Each word is split into letters, using the page's best matching font to predict where each letter should be.
   - Each letter is scored against that font, and badly cut letters are thrown away.
   - Each letter's size, stroke weight and whether it is bold are recorded.
   - The spacing between letters is measured by rebuilding real words from their own letters and comparing the width with the scan.
5. **Edit:**
   - The old word is painted over with the paper's colour and noise.
   - New letters are chosen from the scan with matching size, weight and boldness.
   - They are placed on the old word's baseline, then their ink colour and darkness are matched to the old word.
6. **Export:** [jsPDF](https://github.com/parallax/jsPDF) puts the edited page images back into a PDF.

## Run locally

It is a static site with no build step:

```sh
git clone https://github.com/Arunachalam0606/inkgraft.git
cd inkgraft
python3 -m http.server 8765
# open http://127.0.0.1:8765
```

Tests for the find & replace text helpers:

```sh
node test.js
```

## Files

| File | Purpose |
|---|---|
| `index.html` | The whole app: UI, text recognition, letter cutting, editing, export |
| `textops.js` | Pure find & replace helpers, shared by the app and the tests |
| `test.js` | Node tests for `textops.js` |

## Limits

- **Letters that are missing from the page:** if a letter never appears in normal-weight text on the page (for example a capital N), a matching font is used for it. Up close it can look slightly different.
- **Bad text recognition:** if the text recogniser can't read a word, it can't be found or replaced. Try searching for part of the word.
- **Image-only output:** the exported PDF is page images, so its text can't be selected.
- **Loads from CDNs:** pdf.js, Tesseract.js and jsPDF are loaded from public CDNs. The first page load needs internet, and Tesseract also downloads its English language data.

## Responsible use

inkgraft is for fixing typos, dates and other details in **your own** documents. Do not use it to forge or falsify documents. Doing so is illegal in most places.
