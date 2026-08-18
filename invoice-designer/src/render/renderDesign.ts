import type { DesignElement, InvoiceData, InvoiceLineItem, TableColumn } from '../types';
import { resolvePlaceholder } from '../tokens';

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderItemsTable(el: DesignElement, data: InvoiceData): string {
  const cols = el.columns ?? [];
  const items = (data.items ?? []) as InvoiceLineItem[];
  const headerBg = el.headerBg ?? '#2389d6';
  const headerColor = el.headerColor ?? '#ffffff';
  const border = el.borderColor ?? '#dcdcdc';
  const rowH = el.rowHeight ?? 28;

  const head = el.showHeader !== false
    ? `<thead><tr>${cols
        .map(
          (c) =>
            `<th style="padding:8px;border:1px solid ${border};background:${headerBg};color:${headerColor};text-align:${c.align};width:${c.width}%">${esc(c.label)}</th>`
        )
        .join('')}</tr></thead>`
    : '';

  const rows = items
    .map((item) => {
      const cells = cols
        .map((c) => {
          const val = (item as Record<string, unknown>)[c.key] ?? '';
          return `<td style="padding:8px;border:1px solid ${border};text-align:${c.align};height:${rowH}px">${esc(val)}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `<table style="width:100%;border-collapse:collapse;font-size:${el.fontSize ?? 12}px;font-family:${el.fontFamily ?? 'Inter'}">${head}<tbody>${rows}</tbody></table>`;
}

function elementStyle(el: DesignElement): string {
  const parts = [
    `position:absolute`,
    `left:${el.x}px`,
    `top:${el.y}px`,
    `width:${el.width}px`,
    el.type !== 'line' ? `min-height:${el.height}px` : '',
    el.angle ? `transform:rotate(${el.angle}deg)` : '',
    `transform-origin:top left`,
    `opacity:${el.opacity ?? 1}`,
    el.type !== 'itemsTable' && el.type !== 'line' ? `color:${el.fill ?? '#333'}` : '',
    el.fontFamily ? `font-family:${el.fontFamily}` : '',
    el.fontSize ? `font-size:${el.fontSize}px` : '',
    el.fontWeight ? `font-weight:${el.fontWeight}` : '',
    el.fontStyle ? `font-style:${el.fontStyle}` : '',
    el.textAlign ? `text-align:${el.textAlign}` : '',
    el.lineHeight ? `line-height:${el.lineHeight}` : '',
    el.charSpacing ? `letter-spacing:${el.charSpacing}px` : '',
    el.underline ? `text-decoration:underline` : '',
    'box-sizing:border-box',
  ];
  return parts.filter(Boolean).join(';');
}

function renderElement(el: DesignElement, data: InvoiceData): string {
  if (!el.visible) return '';

  if (el.type === 'line') {
    return `<div style="${elementStyle(el)};height:0;border-top:${el.strokeWidth ?? 2}px solid ${el.stroke ?? '#999'}"></div>`;
  }

  if (el.type === 'rect') {
    return `<div style="${elementStyle(el)};background:${el.fill ?? '#e8f4fd'};border:${el.strokeWidth ?? 1}px solid ${el.stroke ?? '#2389d6'}"></div>`;
  }

  if (el.type === 'circle') {
    // the Fabric canvas draws a circle of radius min(w,h)/2; match it here so
    // what the designer shows is what prints, rather than an ellipse
    const d = Math.min(el.width, el.height);
    return `<div style="${elementStyle(el)};width:${d}px;height:${d}px;border-radius:50%;background:${el.fill ?? '#e8f4fd'};border:${el.strokeWidth ?? 1}px solid ${el.stroke ?? '#2389d6'}"></div>`;
  }

  if (el.type === 'image' || (el.type === 'placeholder' && el.placeholder === 'company_logo')) {
    const src = el.src || String(data.company_logo ?? '');
    if (!src) return '';
    return `<img src="${esc(src)}" alt="" style="${elementStyle(el)};object-fit:contain" />`;
  }

  if (el.type === 'itemsTable' || el.placeholder === 'items_table') {
    return `<div style="${elementStyle(el)}">${renderItemsTable(el, data)}</div>`;
  }

  let text = el.text ?? '';
  if (el.type === 'placeholder' && el.placeholder) {
    text = resolvePlaceholder(el.placeholder, data);
  }

  // break-word keeps a long unbroken token inside its own box instead of
  // bleeding sideways across neighbouring elements.
  const whiteSpace = 'white-space:pre-wrap;overflow-wrap:break-word';
  return `<div style="${elementStyle(el)};${whiteSpace}">${esc(text).replace(/\n/g, '<br>')}</div>`;
}

export function renderDesignToHtml(design: { page: { width: number; height: number; background: string }; elements: DesignElement[] }, data: InvoiceData): string {
  const sorted = [...design.elements].sort((a, b) => a.zIndex - b.zIndex);
  const body = sorted.map((el) => renderElement(el, data)).join('\n');
  return `<div class="invoice-print-page" style="position:relative;width:${design.page.width}px;height:${design.page.height}px;background:${design.page.background};margin:0 auto;overflow:hidden">${body}</div>`;
}

export function renderDesignPrintDocument(
  design: { page: { width: number; height: number; background: string }; elements: DesignElement[] },
  data: InvoiceData,
  title = 'Invoice'
): string {
  const page = renderDesignToHtml(design, data);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
@page { size: A4 portrait; margin: 0; }
html, body { margin: 0; padding: 0; background: #eef0f3; }
@media print {
  html, body { background: #fff; }
  .invoice-print-page { box-shadow: none !important; }
}
.invoice-print-page { box-shadow: 0 2px 24px rgba(0,0,0,.12); }
</style></head><body>${page}</body></html>`;
}

export function updateTableColumns(el: DesignElement, columns: TableColumn[]): DesignElement {
  return { ...el, columns };
}
