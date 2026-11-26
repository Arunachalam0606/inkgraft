import type { LucideIcon } from 'lucide-react';
import {
  ScanText, Camera, Workflow, Files, Layers, Minimize2, FileSearch, Scissors, SplitSquareHorizontal, Trash2, FileOutput,
  LayoutGrid, RotateCw, FlipHorizontal2, Grid2x2, Crop, FileArchive, PenLine, Signature, ClipboardList, EyeOff, Droplets,
  Hash, ListOrdered, PanelTop, Stamp, Contrast, NotebookPen, Image, FileText, FileCode2, FileType, Table, FileImage,
  Type, Images, Tags, AudioLines, Lock, KeyRound, Fingerprint, ShieldCheck, ScanSearch, Columns2, Wrench, Receipt,
  Calculator, FolderCheck,
} from 'lucide-react';

export type CategoryId = 'scan' | 'pages' | 'edit' | 'to-pdf' | 'from-pdf' | 'security' | 'smart' | 'business';

export interface Tool {
  id: string;
  name: string;
  desc: string;
  category: CategoryId;
  icon: LucideIcon;
  /** false = planned, shown as "Soon" and not openable yet */
  ready: boolean;
  /** opens a standalone page instead of a React tool route */
  href?: string;
  keywords?: string;
}

export const CATEGORIES: { id: CategoryId; name: string }[] = [
  { id: 'scan', name: 'Scan & Workflow' },
  { id: 'pages', name: 'Page Management' },
  { id: 'edit', name: 'Edit & Annotate' },
  { id: 'to-pdf', name: 'Convert → PDF' },
  { id: 'from-pdf', name: 'Convert → Other' },
  { id: 'security', name: 'Security & Privacy' },
  { id: 'smart', name: 'OCR & Smart' },
  { id: 'business', name: 'Business' },
];

const t = (id: string, name: string, desc: string, category: CategoryId, icon: LucideIcon, ready = false, extra: Partial<Tool> = {}): Tool =>
  ({ id, name, desc, category, icon, ready, ...extra });

export const TOOLS: Tool[] = [
  t('scan-editor', 'Scan Editor', 'Edit text in scanned PDFs using letters cloned from the scan itself — same typeface, same ink, same tilt.', 'scan', ScanText, true, { href: '/editor/', keywords: 'inkgraft edit scanned ocr font replace date' }),
  t('scan-document', 'Scan Document', 'Use your camera to scan a document, straighten it and save it as a PDF.', 'scan', Camera),
  t('workflow', 'Workflow Builder', 'Chain several tools — compress, watermark, number — and run them in one go.', 'scan', Workflow),

  t('merge', 'Merge PDFs', 'Combine several PDFs into one, in the order you choose.', 'pages', Files, true, { keywords: 'combine join' }),
  t('split', 'Split PDF', 'Cut a PDF into separate files by page ranges or every N pages.', 'pages', Scissors, false, { keywords: 'separate ranges' }),
  t('compress', 'Compress PDF', 'Shrink a PDF by re-encoding its pages at the quality you pick.', 'pages', Minimize2, false, { keywords: 'reduce size smaller' }),
  t('organize', 'Organize Pages', 'Drag to reorder, rotate or remove pages, with live thumbnails.', 'pages', LayoutGrid, false, { keywords: 'reorder sort arrange' }),
  t('rotate', 'Rotate PDF', 'Rotate every page, or just the ones you pick, by 90°, 180° or 270°.', 'pages', RotateCw, true),
  t('delete-pages', 'Delete Pages', 'Remove pages by clicking them or typing a range.', 'pages', Trash2, true, { keywords: 'remove' }),
  t('extract-pages', 'Extract Pages', 'Pick pages and save them as a new PDF.', 'pages', FileOutput, true, { keywords: 'select save subset' }),
  t('interleave', 'Alternate & Mix', 'Interleave the pages of two PDFs, one page from each in turn.', 'pages', Layers),
  t('why-big', 'Why Is My PDF Big?', 'See which images, fonts and pages take up the space.', 'pages', FileSearch),
  t('split-half', 'Split Pages in Half', 'Slice every page down the middle — for two-page book scans.', 'pages', SplitSquareHorizontal),
  t('flip', 'Flip PDF', 'Mirror pages horizontally, vertically or both.', 'pages', FlipHorizontal2),
  t('n-up', 'Pages Per Sheet', 'Put 2, 4, 6, 9 or 16 pages on one sheet to save paper.', 'pages', Grid2x2),
  t('crop', 'Crop & Resize', 'Trim margins or fit pages to A4 or Letter.', 'pages', Crop),
  t('zip', 'PDFs to ZIP', 'Bundle many PDFs into one ZIP archive.', 'pages', FileArchive),

  t('sign', 'Sign PDF', 'Draw or type your signature and place it anywhere on the page.', 'edit', Signature, false, { keywords: 'signature autograph' }),
  t('watermark', 'Add Watermark', 'Stamp text across your pages — angle, size and opacity your way.', 'edit', Droplets, false),
  t('page-numbers', 'Add Page Numbers', 'Number pages with your choice of position, format and start.', 'edit', Hash, false),
  t('edit-pdf', 'Edit PDF', 'Add text, shapes and images to any PDF.', 'edit', PenLine),
  t('fill-form', 'Fill PDF Form', 'Fill a fillable PDF and lock the answers in.', 'edit', ClipboardList),
  t('redact', 'Redact PDF', 'Permanently remove sensitive text and areas.', 'edit', EyeOff),
  t('bates', 'Bates Numbering', 'Stamp sequential Bates numbers across documents.', 'edit', ListOrdered),
  t('header-footer', 'Headers & Footers', 'Add headers and footers with text, dates and page numbers.', 'edit', PanelTop),
  t('flatten', 'Flatten PDF', 'Make forms and annotations permanent.', 'edit', Stamp),
  t('invert', 'Invert Colours', 'Dark, sepia or high-contrast versions of a PDF.', 'edit', Contrast),
  t('handwriting', 'Text to Handwriting', 'Turn typed text into realistic handwritten notes.', 'edit', NotebookPen),

  t('images-to-pdf', 'Images to PDF', 'Turn JPG, PNG and WebP images into one PDF.', 'to-pdf', Image, false, { keywords: 'jpg png photo convert' }),
  t('txt-to-pdf', 'Text to PDF', 'Convert plain-text files into clean PDFs.', 'to-pdf', FileText),
  t('md-to-pdf', 'Markdown to PDF', 'Convert Markdown into a nicely typeset PDF.', 'to-pdf', FileCode2),
  t('html-to-pdf', 'HTML to PDF', 'Convert HTML files into PDFs.', 'to-pdf', FileType),
  t('csv-to-pdf', 'CSV to PDF', 'Turn a CSV file into a formatted table PDF.', 'to-pdf', Table),

  t('pdf-to-images', 'PDF to JPG / PNG', 'Export every page as a high-quality image, zipped.', 'from-pdf', FileImage, false, { keywords: 'jpg png image export convert' }),
  t('extract-text', 'Extract Text', 'Copy out all the text of a PDF.', 'from-pdf', Type),
  t('extract-images', 'Extract Images', 'Pull out the embedded images at original quality.', 'from-pdf', Images),
  t('metadata', 'Edit Metadata', 'Read and rewrite title, author, subject and keywords.', 'from-pdf', Tags),
  t('pdf-to-audio', 'PDF to Audio', 'Listen to a PDF read aloud by your browser.', 'from-pdf', AudioLines),

  t('encrypt', 'Protect PDF', 'Lock a PDF with a password using strong encryption.', 'security', Lock, false, { keywords: 'password encrypt secure' }),
  t('unlock', 'Remove Password', 'Remove the password from a PDF you can open.', 'security', KeyRound, false, { keywords: 'decrypt unlock password' }),
  t('fingerprint', 'File Fingerprint', 'SHA-256 and SHA-1 hashes to check a file is unchanged.', 'security', Fingerprint),
  t('auto-redact', 'Auto-Redact PII', 'Find and remove Aadhaar, PAN, card numbers, emails and phones.', 'security', ShieldCheck),

  t('ocr', 'Searchable PDF (OCR)', 'Add a hidden text layer to scanned PDFs so you can search and copy.', 'smart', ScanSearch, false, { keywords: 'ocr text recognize searchable' }),
  t('compare', 'Compare PDFs', 'See two PDFs side by side with the differences highlighted.', 'smart', Columns2),
  t('repair', 'Repair PDF', 'Rebuild damaged or broken PDF files.', 'smart', Wrench),

  t('gst-invoice', 'GST Invoice', 'Create GST tax invoices with CGST, SGST, IGST and HSN codes.', 'business', Receipt),
  t('pos-bill', 'POS Bill', 'Quick shop bills with products, GST and thermal-printer layout.', 'business', Calculator),
  t('gst-filing', 'GST Filing Prep', 'Compress and split PDFs to fit GST portal upload limits.', 'business', FolderCheck),
];

export const toolById = (id: string) => TOOLS.find((x) => x.id === id);
export const toolHref = (tool: Tool) => tool.href ?? `/tools/${tool.id}`;
export const FEATURED = ['scan-editor', 'merge', 'compress', 'sign', 'split', 'images-to-pdf', 'organize', 'ocr', 'encrypt'];
