import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

// One lazily-loaded component per tool id: each tool's code (and pdf libraries) loads only when it is opened.
export const TOOL_UI: Record<string, LazyExoticComponent<ComponentType>> = {
  'bates': lazy(() => import('./Batch2').then((m) => ({ default: m.Bates }))),
  'header-footer': lazy(() => import('./Batch2').then((m) => ({ default: m.HeaderFooter }))),
  'why-big': lazy(() => import('./Batch2').then((m) => ({ default: m.WhyBig }))),
  'zip': lazy(() => import('./Batch2').then((m) => ({ default: m.Zip }))),
  'crop': lazy(() => import('./Batch2').then((m) => ({ default: m.Crop }))),
  'split-half': lazy(() => import('./Batch2').then((m) => ({ default: m.SplitHalf }))),
  'n-up': lazy(() => import('./Batch2').then((m) => ({ default: m.NUp }))),
  'flip': lazy(() => import('./Batch2').then((m) => ({ default: m.Flip }))),
  'interleave': lazy(() => import('./Batch2').then((m) => ({ default: m.Interleave }))),
  merge: lazy(() => import('./Merge')),
  ocr: lazy(() => import('./Ocr')),
  sign: lazy(() => import('./Sign')),
  compress: lazy(() => import('./Compress')),
  encrypt: lazy(() => import('./Security').then((m) => ({ default: m.Protect }))),
  unlock: lazy(() => import('./Security').then((m) => ({ default: m.Unlock }))),
  watermark: lazy(() => import('./Watermark')),
  'page-numbers': lazy(() => import('./PageNumbers')),
  'pdf-to-images': lazy(() => import('./PdfToImages')),
  'images-to-pdf': lazy(() => import('./ImagesToPdf')),
  rotate: lazy(() => import('./Rotate')),
  organize: lazy(() => import('./Organize')),
  split: lazy(() => import('./Split')),
  'delete-pages': lazy(() => import('./PickPages').then((m) => ({ default: m.Delete }))),
  'extract-pages': lazy(() => import('./PickPages').then((m) => ({ default: m.Extract }))),
};
