export interface BotConfig {
  count: number;
}

export class BotSwarm {
  constructor(private readonly config: BotConfig) {}
  start(): void {
    // Placeholder: in real tests, connect N bots to server and send inputs
    for (let i = 0; i < this.config.count; i++) {
      // no-op
    }
  }
}
