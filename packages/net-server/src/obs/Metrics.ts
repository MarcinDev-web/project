export class Counter {
  private v = 0;

  inc(n = 1): void {
    this.v += n;
  }

  get value(): number {
    return this.v;
  }
}

export class NetServerMetrics {
  readonly handshakesTotal = new Counter();
  readonly handshakesFailed = new Counter();
}
