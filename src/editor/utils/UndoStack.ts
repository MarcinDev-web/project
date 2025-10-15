export class UndoStack {
  private lastUndo: (() => void) | null = null;

  public set(undo: () => void): void {
    this.lastUndo = undo;
  }

  public has(): boolean {
    return this.lastUndo !== null;
  }

  public undo(): boolean {
    const fn = this.lastUndo;
    if (!fn) return false;
    this.lastUndo = null;
    try {
      fn();
      return true;
    } catch {
      return false;
    }
  }
}


