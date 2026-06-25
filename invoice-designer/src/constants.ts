import type { InvoiceDesign } from './types';

/** A4 at 96 DPI */
export const A4_WIDTH = 794;
export const A4_HEIGHT = 1123;
export const DEFAULT_MARGIN = 40;
export const DEFAULT_GRID_SIZE = 10;

export const FONT_FAMILIES = [
  'Inter',
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Roboto Mono',
  'Segoe UI',
];

export const DEFAULT_PAGE = {
  width: A4_WIDTH,
  height: A4_HEIGHT,
  background: '#ffffff',
  margin: DEFAULT_MARGIN,
};

export function uid(prefix = 'el'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createEmptyDesign(name = 'Untitled Invoice'): InvoiceDesign {
  const now = new Date().toISOString();
  return {
    id: uid('design'),
    name,
    version: 1,
    page: { ...DEFAULT_PAGE },
    elements: [],
    grid: { enabled: true, size: DEFAULT_GRID_SIZE, snap: true },
    createdAt: now,
    updatedAt: now,
  };
}

export function cloneDesign(design: InvoiceDesign, name?: string): InvoiceDesign {
  const now = new Date().toISOString();
  return {
    ...JSON.parse(JSON.stringify(design)),
    id: uid('design'),
    name: name ?? `${design.name} (Copy)`,
    createdAt: now,
    updatedAt: now,
  };
}
