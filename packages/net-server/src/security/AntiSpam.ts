export class MessageRateLimiter {
  private readonly timestamps: number[] = [];
  constructor(private readonly windowMs: number, private readonly maxInWindow: number) {}
  allow(): boolean {
    const now = Date.now();
    while (this.timestamps.length > 0) {
      const first = this.timestamps[0];
      if (first === undefined || now - first <= this.windowMs) break;
      this.timestamps.shift();
    }
    if (this.timestamps.length >= this.maxInWindow) return false;
    this.timestamps.push(now);
    return true;
  }
}


