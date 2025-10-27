export class CancellationToken {
  private cancelled = false;
  private listeners: Array<() => void> = [];

  cancel(): void {
    if (this.cancelled) return;
    this.cancelled = true;
    for (const l of this.listeners) {
      try { l(); } catch { /* ignore */ }
    }
    this.listeners = [];
  }

  isCancelled(): boolean {
    return this.cancelled;
  }

  throwIfCancelled(): void {
    if (this.cancelled) throw new Error('Cancelled');
  }

  onCancel(listener: () => void): () => void {
    if (this.cancelled) {
      try { listener(); } catch { /* ignore */ }
      return () => {};
    }
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}


