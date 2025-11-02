export class Histogram {
  private readonly samples: number[] = [];
  observe(v: number): void { this.samples.push(v); }
  get count(): number { return this.samples.length; }
  get avg(): number { return this.samples.length ? this.samples.reduce((a, b) => a + b, 0) / this.samples.length : 0; }
}

export class Counter {
  private v = 0;
  inc(n = 1): void { this.v += n; }
  get value(): number { return this.v; }
}

export class WorldServerMetrics {
  readonly tickMs = new Histogram();
  readonly bytesPerClientPerTick = new Histogram();
  readonly sendQueueLen = new Histogram();
}


