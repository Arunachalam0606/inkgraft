# inkgraft

Private PDF tools that run entirely in your browser. Nothing you open is uploaded: every file is read, changed and saved on your own device.

Its signature tool, the **Scan Editor**, edits text in *scanned* PDFs using letters cloned from the scan itself, so a changed date or amount matches the typeface, the faded ink and the tilt of the page around it.

**Live:** https://inkgraft.vercel.app

## Tools

48 tools, all running on your device:

| Category | Tools |
|---|---|
| Scan & Workflow | **Scan Editor** (edit scanned text with letters cloned from the page) · Scan Document (camera + perspective correction) · Workflow Builder (chain steps) |
| Page Management | Merge · Split · Compress · Organize · Rotate · Delete pages · Extract pages · Alternate & Mix · Why is my PDF big? · Split pages in half · Flip · Pages per sheet · Crop & resize · PDFs to ZIP |
| Edit & Annotate | Sign · Watermark · Page numbers · Edit PDF (text, white-out, highlight, images) · Fill form · Redact · Bates numbering · Headers & footers · Flatten · Invert colours · Text to handwriting |
| Convert → PDF | Images · Text · Markdown · HTML · CSV |
| Convert → Other | PDF to JPG/PNG · Extract text · Extract images · Edit metadata · PDF to audio (read aloud) |
| Security & Privacy | Protect (AES-256) · Remove password · File fingerprint (SHA-256/384/512/1) · Auto-redact PII (Aadhaar, PAN, cards, account numbers, IFSC, emails, phones; scans via OCR) |
| OCR & Smart | Searchable PDF (OCR text layer) · Compare PDFs (pixel diff) · Repair PDF |
| Business | GST invoice (CGST/SGST/IGST, HSN, amount in words) · POS bill (80 mm receipt) · GST filing prep (split under portal size limits) |

### Highlights

- **Scan Editor:** click a word and type, or use find & replace. New letters are cut from the scan itself and matched to the ink of the word they replace. You can move, resize and rotate text, undo, and export.
- **Redaction that really removes data:** pages are rebuilt as images with the boxes burned in, so nothing remains under them. Auto-redact finds Indian personal data, using on-device OCR for scans.
- **Live previews:** watermarks, page numbers, headers, flips, crops, conversions and invoices show the real output while you change options.
- **Real text where possible:** Text, Markdown, HTML, CSV and invoice PDFs contain selectable text. The layout engine wraps text, repeats table headers on every page and handles lists, quotes and code.
- **Business maths you can trust:** all money is in paise, GSTINs are checksum-validated, and amounts are written out in the Indian system (lakh, crore).

## Privacy and security

- **No uploads.** Processing happens in the page using pdf.js, pdf-lib, Tesseract.js and jsPDF.
- **No third-party scripts.** Every library, worker, WebAssembly file and language file is self-hosted under `/vendor`, copied from `node_modules` at build time.
- **Strict security headers** (`vercel.json`):
  - The CSP is `default-src 'self'` and `script-src 'self' 'wasm-unsafe-eval'`: no inline scripts and no `eval`.
  - `frame-ancestors 'none'`, `object-src 'none'` and `form-action 'none'`.
  - `nosniff`, `no-referrer`, COOP and HSTS.
- **pdf.js 5,** which has no eval code path. This closes the CVE-2024-4367 class of font exploits that affected the original pdf.js 3.11.
- **Per-device preferences only.** Starred tools, recent tools and the theme are kept in your browser's local storage.

## Design

- React 19, Vite, TypeScript and Tailwind v4, animated with Motion.
- [React Bits](https://reactbits.dev) components: Aurora, BlurText, ShinyText and SpotlightCard.
- The hero figure, **the graft press**, is an isometric machine drawn with the anatomy iso kit. It shows how the Scan Editor works: a gantry lifts letters out of a type case harvested from the scan and sets "November" where "October" was erased (7 letters cloned, 1 from a font).
- Dark first, with a paper-white light theme.
- ⌘K / Ctrl+K command palette.
- Respects reduced-motion settings.

## Run locally

```sh
git clone https://github.com/Arunachalam0606/inkgraft.git
cd inkgraft
npm install
npm run dev        # http://localhost:5173
npm test           # textops + node:test suites for page ops, stamping, security, OCR layer
npm run build && npx vite preview   # production build, served with the production security headers
```

Rebuild the hero figure after changing its geometry:

```sh
node scripts/figure/build.mjs
```

## Layout

| Path | Contents |
|---|---|
| `src/pages/` | Dashboard, tool page frame, recent and starred lists |
| `src/tools/` | One lazily loaded component per tool |
| `src/lib/ops*.ts`, `compose.ts`, `gst.ts`, `invoicePdf.ts`, `pii.ts`, `warp.ts` | Pure logic: page operations, stamping, encryption, OCR text layer, forms, workflows, the text layout engine, GST maths, personal-data detection, perspective correction. Tested in Node (`tests/`). |
| `src/lib/raster.ts` | Browser-only: page rasterising, positioned words, the self-hosted Tesseract worker |
| `src/lib/registry.ts` | Every tool, its category and whether it's ready |
| `src/components/` | Sidebar, command palette, drop zone, page grid, live preview, React Bits components |
| `src/figure/` | The graft press hero figure (generated art plus its live controller) |
| `public/editor/` | The Scan Editor, a standalone page |
| `scripts/vendor.mjs` | Copies runtime libraries into `public/vendor` |

## Limits

- **Latin text only for stamps.** Watermark and page numbers use the standard PDF fonts, which only cover Latin-1. Other scripts such as Tamil are refused with a message rather than printed as "?".
- **Strong and Extreme compression rasterise pages.** Text stops being selectable; Lossless keeps it.
- **OCR is English only.** It reads printed text, not handwriting.
- **Text to Handwriting uses one font** (Caveat). It only covers Latin script.
- **Scan Document doesn't detect page edges automatically.** You drag the four corners yourself.
- **PDF to Audio reads aloud with your browser's voices.** Browsers don't let web pages record speech, so it can't save an audio file.
- **Signature placement on rotated pages:** the position is correct, but the image isn't counter-rotated.

## Responsible use

inkgraft is for fixing your own documents. Don't use it to forge or falsify documents; that is illegal in most places.
