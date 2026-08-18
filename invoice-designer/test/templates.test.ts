import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultInvoiceTemplate, createBlankTemplate, TEMPLATE_PRESETS } from '../src/templates';
import type { DesignElement } from '../src/types';

const byName = (els: DesignElement[], name: string) => {
  const el = els.find((e) => e.name === name);
  assert.ok(el, `template is missing the "${name}" element`);
  return el!;
};

/** Vertical extent of an element, in page pixels. */
const spanY = (el: DesignElement) => ({ top: el.y, bottom: el.y + el.height });

describe('createDefaultInvoiceTemplate', () => {
  const design = createDefaultInvoiceTemplate();

  test('is A4 at 96dpi', () => {
    assert.equal(design.page.width, 794);
    assert.equal(design.page.height, 1123);
  });

  test('carries the elements the designer UI expects', () => {
    const names = design.elements.map((e) => e.name);
    for (const n of ['Company Name', 'Company Address', 'Title', 'Customer Name', 'Line Items', 'Grand Total']) {
      assert.ok(names.includes(n), `missing ${n}`);
    }
  });

  test('every element id is unique', () => {
    const ids = design.elements.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test('two calls produce independent objects', () => {
    const a = createDefaultInvoiceTemplate();
    const b = createDefaultInvoiceTemplate();
    a.elements[0].x = 999;
    assert.notEqual(b.elements[0].x, 999);
    assert.notEqual(a.elements[0].id, b.elements[0].id, 'ids must not be shared between instances');
  });

  test('the items table has columns that sum to 100%', () => {
    const table = byName(design.elements, 'Line Items');
    const total = (table.columns ?? []).reduce((n, c) => n + c.width, 0);
    assert.equal(total, 100);
  });

  test('no element is positioned outside the page', () => {
    for (const el of design.elements) {
      assert.ok(el.x >= 0 && el.y >= 0, `${el.name} has a negative origin`);
      assert.ok(el.x + el.width <= design.page.width, `${el.name} overflows the page width`);
      assert.ok(el.y + el.height <= design.page.height, `${el.name} overflows the page height`);
    }
  });

  /* Regression: the name box used to be 32px tall, so a real business name
     ("Abbass Tempering Industry LLC") wrapped to a second line and painted
     over the address block underneath it. */
  describe('header block does not overlap', () => {
    const name = byName(design.elements, 'Company Name');
    const address = byName(design.elements, 'Company Address');

    test('the company name reserves room for two wrapped lines', () => {
      const lines = 2;
      const needed = name.fontSize! * (name.lineHeight ?? 1.2) * lines;
      assert.ok(
        name.height >= needed,
        `name box is ${name.height}px but two lines at ${name.fontSize}px need ${needed.toFixed(0)}px`
      );
    });

    test('the address starts below the bottom of the name box', () => {
      assert.ok(
        spanY(address).top >= spanY(name).bottom,
        `address top (${spanY(address).top}) overlaps name bottom (${spanY(name).bottom})`
      );
    });

    test('the address does not run into the next element down the right column', () => {
      const invNo = byName(design.elements, 'Invoice Number');
      assert.ok(spanY(invNo).top >= spanY(address).bottom);
    });
  });

  test('no two elements in the same column overlap vertically', () => {
    const overlaps = (a: DesignElement, b: DesignElement) => {
      const xOverlap = a.x < b.x + b.width && b.x < a.x + a.width;
      const yOverlap = a.y < b.y + b.height && b.y < a.y + a.height;
      return xOverlap && yOverlap;
    };
    // the divider line and the logo box are decorative and may sit under text
    const solid = design.elements.filter((e) => e.type !== 'line' && e.name !== 'Company Logo');
    for (let i = 0; i < solid.length; i++) {
      for (let j = i + 1; j < solid.length; j++) {
        assert.ok(
          !overlaps(solid[i], solid[j]),
          `"${solid[i].name}" overlaps "${solid[j].name}"`
        );
      }
    }
  });
});

describe('createBlankTemplate', () => {
  test('has the same page setup but no elements', () => {
    const b = createBlankTemplate();
    assert.equal(b.elements.length, 0);
    assert.equal(b.page.width, 794);
  });
});

describe('TEMPLATE_PRESETS', () => {
  test('every preset builds a usable design', () => {
    assert.ok(TEMPLATE_PRESETS.length > 0);
    for (const p of TEMPLATE_PRESETS) {
      const d = p.factory();
      assert.ok(d.id && d.page && Array.isArray(d.elements), `preset "${p.id}" is malformed`);
    }
  });
});
