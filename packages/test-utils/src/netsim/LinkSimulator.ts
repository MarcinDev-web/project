export interface LinkConfig {
  latencyMs: number;
  jitterMs: number;
  dropRate: number; // 0..1
}

export class LinkSimulator {
  constructor(private readonly config: LinkConfig) {}

  send<T>(payload: T, deliver: (p: T) => void): void {
    if (Math.random() < this.config.dropRate) return;
    const jitter = (Math.random() * 2 - 1) * this.config.jitterMs;
    const delay = Math.max(0, this.config.latencyMs + jitter);
    setTimeout(() => deliver(payload), delay);
  }
}
