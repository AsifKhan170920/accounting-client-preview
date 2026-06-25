import { createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { InvoiceDesigner } from './components/InvoiceDesigner';
import type { DesignerMountOptions } from './types';
import { createDefaultInvoiceTemplate } from './templates';
import { mapRecordToInvoiceData, sampleInvoiceData } from './tokens';
import { renderDesignPrintDocument, renderDesignToHtml } from './render/renderDesign';

export type {
  InvoiceDesign,
  InvoiceData,
  DesignElement,
  DesignerMountOptions,
} from './types';

export {
  createDefaultInvoiceTemplate,
  mapRecordToInvoiceData,
  sampleInvoiceData,
  renderDesignPrintDocument,
  renderDesignToHtml,
};

const roots = new Map<HTMLElement, Root>();

export function mountInvoiceDesigner(container: HTMLElement, options: DesignerMountOptions): void {
  unmountInvoiceDesigner(container);
  const root = createRoot(container);
  roots.set(container, root);
  root.render(createElement(InvoiceDesigner, options));
}

export function unmountInvoiceDesigner(container: HTMLElement): void {
  const root = roots.get(container);
  if (root) {
    root.unmount();
    roots.delete(container);
  }
}

export const InvoiceDesignerAPI = {
  mount: mountInvoiceDesigner,
  unmount: unmountInvoiceDesigner,
  createDefaultTemplate: createDefaultInvoiceTemplate,
  mapRecordToInvoiceData,
  sampleInvoiceData,
  renderDesignPrintDocument,
  renderDesignToHtml,
};

declare global {
  interface Window {
    InvoiceDesignerModule?: typeof InvoiceDesignerAPI;
  }
}

if (typeof window !== 'undefined') {
  window.InvoiceDesignerModule = InvoiceDesignerAPI;
}

export default InvoiceDesignerAPI;
