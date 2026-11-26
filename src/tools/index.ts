import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

// One lazily-loaded component per tool id: each tool's code (and pdf libraries) loads only when it is opened.
export const TOOL_UI: Record<string, LazyExoticComponent<ComponentType>> = {
  merge: lazy(() => import('./Merge')),
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
