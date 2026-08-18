import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { renderDesignToHtml, renderDesignPrintDocument } from '../src/render/renderDesign';
import { createDefaultInvoiceTemplate } from '../src/templates';
import { sampleInvoiceData } from '../src/tokens';
import type { DesignElement } from '../src/types';

const page = { width: 794, height: 1123, background: '#ffffff' };

const el = (p: Partial<DesignElement>): DesignElement =>
  ({
    id: 'e1', name: 'el', type: 'text', x: 0, y: 0, width: 100, height: 20,
    angle: 0, opacity: 1, locked: false, visible: true, zIndex: 0,
    fontSize: 12, textAlign: 'left', fill: '#000', ...p,
  } as DesignElement);

describe('renderDesignToHtml', () => {
  test('renders the full default template with real data', () => {
    const html = renderDesignToHtml(createDefaultInvoiceTemplate() as any, sampleInvoiceData());
    assert.ok(html.includes('invoice-print-page'));
    assert.ok(html.includes('Acme Trading LLC'), 'company placeholder resolved');
    assert.ok(html.includes('INV-2026-0042'), 'invoice number resolved');
    assert.ok(!html.includes('{{'), 'no unresolved placeholders should reach the page');
    assert.ok(!html.includes('undefined'));
  });

  test('escapes HTML in data so a record cannot inject markup', () => {
    const design = { page, elements: [el({ type: 'placeholder', placeholder: 'customer_name' })] };
    const data = { ...sampleInvoiceData(), customer_name: '<img src=x onerror="alert(1)">' };
    const html = renderDesignToHtml(design as any, data);
    assert.ok(!html.includes('<img'), 'raw tag must not survive');
    assert.ok(html.includes('&lt;img'), 'should appear escaped instead');
  });

  test('escapes quotes so data cannot break out of an attribute', () => {
    const design = { page, elements: [el({ type: 'placeholder', placeholder: 'customer_name' })] };
    const html = renderDesignToHtml(design as any, { ...sampleInvoiceData(), customer_name: '" onload="x' });
    assert.ok(html.includes('&quot;'));
  });

  test('newlines in an address become <br>', () => {
    const design = { page, elements: [el({ type: 'placeholder', placeholder: 'company_address' })] };
    const html = renderDesignToHtml(design as any, { ...sampleInvoiceData(), company_address: 'A\nB' });
    assert.ok(html.includes('A<br>B'));
  });

  /* Regression: a long unbroken token used to bleed sideways out of its box
     and across neighbouring elements. */
  test('text boxes break long words instead of bleeding sideways', () => {
    const design = { page, elements: [el({ type: 'placeholder', placeholder: 'customer_name' })] };
    const html = renderDesignToHtml(design as any, sampleInvoiceData());
    assert.ok(html.includes('overflow-wrap:break-word'));
  });

  test('hidden elements are omitted entirely', () => {
    const design = { page, elements: [el({ type: 'text', text: 'SECRET', visible: false })] };
    assert.ok(!renderDesignToHtml(design as any, sampleInvoiceData()).includes('SECRET'));
  });

  test('elements are painted in zIndex order', () => {
    const design = {
      page,
      elements: [
        el({ id: 'b', type: 'text', text: 'SECOND', zIndex: 5 }),
        el({ id: 'a', type: 'text', text: 'FIRST', zIndex: 1 }),
      ],
    };
    const html = renderDesignToHtml(design as any, sampleInvoiceData());
    assert.ok(html.indexOf('FIRST') < html.indexOf('SECOND'));
  });

  /* Regression: the canvas draws a circle at radius min(w,h)/2 while print used
     the raw w×h box, so a non-square circle printed as an ellipse. */
  test('a circle prints as a circle, matching the canvas', () => {
    const design = { page, elements: [el({ type: 'circle', width: 180, height: 80 })] };
    const html = renderDesignToHtml(design as any, sampleInvoiceData());
    assert.ok(html.includes('width:80px;height:80px'), 'should use min(w,h) for both axes');
    assert.ok(html.includes('border-radius:50%'));
  });

  test('an image element with no source renders nothing rather than a broken img', () => {
    const design = { page, elements: [el({ type: 'image', src: '' })] };
    const html = renderDesignToHtml(design as any, { ...sampleInvoiceData(), company_logo: '' });
    assert.ok(!html.includes('<img'));
  });

  describe('items table', () => {
    const table = el({
      type: 'itemsTable', placeholder: 'items_table', width: 700, height: 200,
      columns: [
        { id: 'c1', key: 'item', label: 'Description', width: 60, align: 'left' },
        { id: 'c2', key: 'amount', label: 'Amount', width: 40, align: 'right' },
      ],
      showHeader: true,
    });

    test('emits a header row and one row per line item', () => {
      const html = renderDesignToHtml({ page, elements: [table] } as any, sampleInvoiceData());
      assert.ok(html.includes('<th'));
      assert.ok(html.includes('Description'));
      assert.equal((html.match(/<tr>/g) ?? []).length, 3, 'one header + two sample items');
    });

    test('showHeader:false drops the header', () => {
      const html = renderDesignToHtml(
        { page, elements: [{ ...table, showHeader: false }] } as any,
        sampleInvoiceData()
      );
      assert.ok(!html.includes('<th'));
    });

    test('renders an empty tbody when there are no items', () => {
      const html = renderDesignToHtml({ page, elements: [table] } as any, { ...sampleInvoiceData(), items: [] });
      assert.ok(html.includes('<tbody></tbody>'));
    });

    test('escapes cell values', () => {
      const data = { ...sampleInvoiceData(), items: [{ item: '<b>x</b>', amount: 1 }] as any };
      const html = renderDesignToHtml({ page, elements: [table] } as any, data);
      assert.ok(!html.includes('<b>x</b>'));
    });
  });
});

describe('renderDesignPrintDocument', () => {
  const doc = renderDesignPrintDocument(createDefaultInvoiceTemplate() as any, sampleInvoiceData(), 'Sales Invoice');

  test('is a complete standalone document', () => {
    assert.ok(doc.startsWith('<!doctype html>'));
    assert.ok(doc.includes('<title>Sales Invoice</title>'));
  });

  test('sets an A4 portrait page with no margin so the design controls layout', () => {
    assert.ok(doc.includes('size: A4 portrait'));
    assert.ok(doc.includes('margin: 0'));
  });

  test('escapes the title', () => {
    const d = renderDesignPrintDocument(createDefaultInvoiceTemplate() as any, sampleInvoiceData(), '<script>');
    assert.ok(!d.includes('<title><script>'));
  });
});
