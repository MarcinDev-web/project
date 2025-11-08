export interface LinkConfig {
    latencyMs: number;
    jitterMs: number;
    dropRate: number;
}
export declare class LinkSimulator {
    private readonly config;
    constructor(config: LinkConfig);
    send<T>(payload: T, deliver: (p: T) => void): void;
}
//# sourceMappingURL=LinkSimulator.d.ts.map