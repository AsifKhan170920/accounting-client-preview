export class HistoryStack<T> {
  private past: T[] = [];
  private future: T[] = [];
  private limit: number;

  constructor(limit = 50) {
    this.limit = limit;
  }

  push(state: T) {
    this.past.push(structuredClone(state));
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }

  undo(current: T): T | null {
    if (!this.past.length) return null;
    this.future.push(structuredClone(current));
    return this.past.pop() ?? null;
  }

  redo(current: T): T | null {
    if (!this.future.length) return null;
    this.past.push(structuredClone(current));
    return this.future.pop() ?? null;
  }

  canUndo() {
    return this.past.length > 0;
  }

  canRedo() {
    return this.future.length > 0;
  }

  clear() {
    this.past = [];
    this.future = [];
  }
}
