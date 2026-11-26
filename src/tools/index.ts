import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

// One lazily-loaded component per tool id: each tool's code (and pdf libraries) loads only when it is opened.
export const TOOL_UI: Record<string, LazyExoticComponent<ComponentType>> = {};

export { lazy };
