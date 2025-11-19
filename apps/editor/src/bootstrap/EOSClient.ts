interface EOSClientConfig {
  sanctionsEndpoint: string;
  reportsEndpoint: string;
  enabled?: boolean;
}

export interface AntiCheatEvent {
  ticketId: string;
  severity: 'info' | 'warn' | 'ban';
  reasons: string[];
}

export class EOSClient {
  private readonly config: EOSClientConfig;
  private initialized = false;

  constructor(config: EOSClientConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.initialized || this.config.enabled === false) {
      return;
    }
    this.initialized = true;
  }

  async sendAntiCheatEvent(event: AntiCheatEvent): Promise<void> {
    if (!this.initialized || this.config.enabled === false) {
      return;
    }
    await fetch(this.config.sanctionsEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketId: event.ticketId,
        severity: event.severity,
        reasons: event.reasons,
      }),
    });
  }

  async reportPlayer(playerId: string, reason: string): Promise<void> {
    if (!this.initialized || this.config.enabled === false) {
      return;
    }
    await fetch(this.config.reportsEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId,
        reporterId: 'editor',
        reason,
      }),
    });
  }
}

