import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { HistoryStack } from '../src/utils/history';

describe('HistoryStack', () => {
  test('starts with nothing to undo or redo', () => {
    const h = new HistoryStack<number>();
    assert.equal(h.canUndo(), false);
    assert.equal(h.canRedo(), false);
    assert.equal(h.undo(1), null);
    assert.equal(h.redo(1), null);
  });

  test('undo returns the previous state and enables redo', () => {
    const h = new HistoryStack<number>();
    h.push(1);
    h.push(2);
    assert.equal(h.undo(3), 2);
    assert.equal(h.undo(2), 1);
    assert.equal(h.canUndo(), false);
    assert.equal(h.canRedo(), true);
  });

  test('redo replays forward', () => {
    const h = new HistoryStack<number>();
    h.push(1);
    const undone = h.undo(2);
    assert.equal(undone, 1);
    assert.equal(h.redo(1), 2);
  });

  test('a new push clears the redo branch', () => {
    const h = new HistoryStack<number>();
    h.push(1);
    h.undo(2);
    assert.equal(h.canRedo(), true);
    h.push(9);
    assert.equal(h.canRedo(), false, 'pushing after undo must drop the redo future');
  });

  test('snapshots are deep copies, not references', () => {
    const h = new HistoryStack<{ n: number[] }>();
    const state = { n: [1, 2] };
    h.push(state);
    state.n.push(3); // mutate after pushing
    assert.deepEqual(h.undo({ n: [] }), { n: [1, 2] }, 'stored snapshot must not see later mutation');
  });

  test('honours the depth limit by dropping the oldest entry', () => {
    const h = new HistoryStack<number>(3);
    [1, 2, 3, 4, 5].forEach((n) => h.push(n));
    // only 3 kept: 3, 4, 5
    assert.equal(h.undo(6), 5);
    assert.equal(h.undo(5), 4);
    assert.equal(h.undo(4), 3);
    assert.equal(h.canUndo(), false);
  });

  test('clear empties both directions', () => {
    const h = new HistoryStack<number>();
    h.push(1);
    h.undo(2);
    h.clear();
    assert.equal(h.canUndo(), false);
    assert.equal(h.canRedo(), false);
  });
});
