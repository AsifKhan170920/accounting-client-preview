import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, createPlaceholderElement, ELEMENT_TOOLS } from '../src/utils/elements';

describe('ELEMENT_TOOLS', () => {
  test('every tool in the palette can actually be created', () => {
    for (const tool of ELEMENT_TOOLS) {
      const el = createElement(tool.type);
      assert.equal(el.type, tool.type);
      assert.ok(el.id, `${tool.type} has no id`);
    }
  });
});

describe('createElement', () => {
  test('gives each element a distinct id', () => {
    const ids = new Set(Array.from({ length: 20 }, () => createElement('text').id));
    assert.equal(ids.size, 20);
  });

  test('elements start visible and unlocked', () => {
    const el = createElement('text');
    assert.equal(el.visible, true);
    assert.equal(el.locked, false);
    assert.equal(el.opacity, 1);
  });

  test('text elements carry prompt copy', () => {
    assert.ok(createElement('text').text);
  });

  test('a line is thin and a circle is square', () => {
    assert.equal(createElement('line').height, 2);
    const c = createElement('circle');
    assert.equal(c.width, c.height, 'a circle must start with equal width and height');
  });

  test('an items table gets columns summing to 100%', () => {
    const t = createElement('itemsTable');
    assert.equal((t.columns ?? []).reduce((n, c) => n + c.width, 0), 100);
    assert.equal(t.placeholder, 'items_table');
  });

  test('table column ids are unique within one element', () => {
    const cols = createElement('itemsTable').columns ?? [];
    assert.equal(new Set(cols.map((c) => c.id)).size, cols.length);
  });

  test('opts override the defaults', () => {
    const el = createElement('text', { x: 5, y: 6, name: 'Custom' });
    assert.deepEqual([el.x, el.y, el.name], [5, 6, 'Custom']);
  });
});

describe('createPlaceholderElement', () => {
  test('derives a human label from the key', () => {
    assert.equal(createPlaceholderElement('invoice_number' as any).name, 'Invoice Number');
  });

  test('company_logo becomes an image, not a text box', () => {
    const el = createPlaceholderElement('company_logo' as any);
    assert.equal(el.type, 'image');
    assert.equal(el.text, undefined, 'a logo must not carry placeholder text');
  });

  test('items_table becomes a table with columns', () => {
    const el = createPlaceholderElement('items_table' as any);
    assert.equal(el.type, 'itemsTable');
    assert.ok((el.columns ?? []).length > 0);
  });

  test('a normal token becomes a placeholder showing its mustache form', () => {
    const el = createPlaceholderElement('invoice_number' as any);
    assert.equal(el.type, 'placeholder');
    assert.equal(el.text, '{{invoice_number}}');
    assert.equal(el.placeholder, 'invoice_number');
  });

  test('emphasised tokens are bold', () => {
    for (const k of ['company_name', 'grand_total', 'customer_name']) {
      assert.equal(createPlaceholderElement(k as any).fontWeight, '700', `${k} should be bold`);
    }
    assert.equal(createPlaceholderElement('description' as any).fontWeight, '400');
  });
});
