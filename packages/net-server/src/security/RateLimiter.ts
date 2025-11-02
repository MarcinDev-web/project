export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  constructor(private readonly capacity: number, private readonly refillPerSec: number) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }
  allow(cost = 1): boolean {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.lastRefill = now;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSec);
    if (this.tokens >= cost) { this.tokens -= cost; return true; }
    return false;
  }
}


