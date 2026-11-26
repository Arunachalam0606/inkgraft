# inkgraft

Private PDF tools that run entirely in your browser. Nothing you open is uploaded: every file is read, changed and saved on your own device.

Its signature tool, the **Scan Editor**, edits text in *scanned* PDFs using letters cloned from the scan itself, so a changed date or amount matches the typeface, the faded ink and the tilt of the page around it.

**Live:** https://inkgraft.vercel.app

## Tools

| Category | Ready now |
|---|---|
| Scan & Workflow | **Scan Editor**: edit scanned text with letters cloned from the page |
| Page Management | Merge · Split · Compress · Organize · Rotate · Delete pages · Extract pages |
| Edit & Annotate | Sign · Watermark · Page numbers |
| Convert → PDF | Images to PDF (JPG, PNG, WebP, GIF, BMP) |
| Convert → Other | PDF to JPG / PNG |
| Security & Privacy | Protect (AES-256 password) · Remove password |
| OCR & Smart | Searchable PDF (adds an invisible OCR text layer) |

More are listed on the dashboard as **Soon**, among them the camera scanner, interleave, N-up, crop, forms, redaction, Markdown/HTML/CSV to PDF, text and image extraction, metadata, compare and repair.

### What each tool does

- **Scan Editor:** click a word and type, or use find & replace across pages.
  - New letters are cut from the scan, sized to the line and matched to the ink of the word they replace. A letter that never appears on the page falls back to the closest installed font.
  - Move, resize and rotate any text.
  - Undo, then export as a PDF.
- **Merge:** drag files (or use the arrow buttons) to set their order.
- **Split:** every N pages, one file per page, or custom ranges such as `1-3, 4-6, 7-`. A colour-coded preview shows which file each page lands in, and several parts download as a ZIP.
- **Compress:** three levels.
  - **Lossless** rewrites the file structure and keeps text selectable.
  - **Strong** and **Extreme** re-encode each page as a 150 or 96 DPI JPEG.
  - If the result isn't smaller, you get the original back.
- **Organize:** drag thumbnails to reorder pages, rotate or delete single pages, and reset.
- **Rotate, Delete, Extract:** pick pages by clicking thumbnails, shift-clicking a range, or typing a range.
- **Sign:** draw or type a signature, place it on any page, then drag, resize or nudge it with the arrow keys. This adds an image of your signature, not a certificate-based digital signature.
- **Watermark and Page numbers:** a live preview of the real output updates as you change the options.
- **Protect:** AES-256 encryption, with permission flags locked by a random owner password.
- **Remove password:** needs the current password.
- **Searchable PDF:** Tesseract OCR reads each scanned page and adds the words as invisible text fitted to each word's box.

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
| `src/lib/ops.ts` | Pure PDF operations: page building, split, stamping, encryption, OCR text layer. Tested in Node. |
| `src/lib/registry.ts` | Every tool, its category and whether it's ready |
| `src/components/` | Sidebar, command palette, drop zone, page grid, live preview, React Bits components |
| `src/figure/` | The graft press hero figure (generated art plus its live controller) |
| `public/editor/` | The Scan Editor, a standalone page |
| `scripts/vendor.mjs` | Copies runtime libraries into `public/vendor` |

## Limits

- **Latin text only for stamps.** Watermark and page numbers use the standard PDF fonts, which only cover Latin-1. Other scripts such as Tamil are refused with a message rather than printed as "?".
- **Strong and Extreme compression rasterise pages.** Text stops being selectable; Lossless keeps it.
- **OCR is English only.** It reads printed text, not handwriting.
- **Signature placement on rotated pages:** the position is correct, but the image isn't counter-rotated.

## Responsible use

inkgraft is for fixing your own documents. Don't use it to forge or falsify documents; that is illegal in most places.
