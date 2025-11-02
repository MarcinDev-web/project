export declare class Histogram {
    private readonly samples;
    observe(v: number): void;
    get count(): number;
    get avg(): number;
}
export declare class Counter {
    private v;
    inc(n?: number): void;
    get value(): number;
}
export declare class WorldServerMetrics {
    readonly tickMs: Histogram;
    readonly bytesPerClientPerTick: Histogram;
    readonly sendQueueLen: Histogram;
}
//# sourceMappingURL=Metrics.d.ts.map