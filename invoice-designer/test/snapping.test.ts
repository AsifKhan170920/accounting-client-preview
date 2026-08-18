import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { snapValue, snapPoint, computeGuides } from '../src/utils/snapping';

describe('snapValue', () => {
  test('rounds to the nearest grid multiple', () => {
    assert.equal(snapValue(13, 10, true), 10);
    assert.equal(snapValue(16, 10, true), 20);
    assert.equal(snapValue(15, 10, true), 20); // .5 rounds up
  });

  test('passes the value through when snapping is off', () => {
    assert.equal(snapValue(13, 10, false), 13);
  });

  test('passes the value through for a non-positive grid', () => {
    assert.equal(snapValue(13, 0, true), 13);
    assert.equal(snapValue(13, -5, true), 13);
  });

  test('handles negative coordinates', () => {
    assert.equal(snapValue(-13, 10, true), -10);
  });
});

describe('snapPoint', () => {
  test('snaps both axes', () => {
    assert.deepEqual(snapPoint(13, 27, 10, true), { x: 10, y: 30 });
  });
});

describe('computeGuides', () => {
  const page = { width: 794, height: 1123 };
  const box = (left: number, top: number, width = 100, height = 50) => ({ left, top, width, height });

  test('snaps a near-flush left edge to the page origin', () => {
    const r = computeGuides(box(3, 400), [], page);
    assert.equal(r.x, 0);
    assert.ok(r.guides.some((g) => g.orientation === 'vertical' && g.position === 0));
  });

  test('snaps to the horizontal centre of the page', () => {
    // centre the box on page centre: left = 397 - 50 = 347, nudge by 2px
    const r = computeGuides(box(349, 400), [], page);
    assert.equal(r.x + 50, page.width / 2);
  });

  test('aligns with another element edge', () => {
    const other = box(200, 100);
    const r = computeGuides(box(203, 400), [other], page);
    assert.equal(r.x, 200);
  });

  test('leaves a far-from-anything box untouched', () => {
    const r = computeGuides(box(311, 421), [], page);
    assert.equal(r.x, 311);
    assert.equal(r.y, 421);
    assert.equal(r.guides.length, 0);
  });

  test('respects a custom threshold', () => {
    assert.equal(computeGuides(box(9, 400), [], page, 2).x, 9, 'outside threshold: no snap');
    assert.equal(computeGuides(box(9, 400), [], page, 20).x, 0, 'inside threshold: snaps');
  });
});
