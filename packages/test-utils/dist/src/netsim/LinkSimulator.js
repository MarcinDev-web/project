export class LinkSimulator {
    config;
    constructor(config) {
        this.config = config;
    }
    send(payload, deliver) {
        if (Math.random() < this.config.dropRate)
            return;
        const jitter = (Math.random() * 2 - 1) * this.config.jitterMs;
        const delay = Math.max(0, this.config.latencyMs + jitter);
        setTimeout(() => deliver(payload), delay);
    }
}
//# sourceMappingURL=LinkSimulator.js.map