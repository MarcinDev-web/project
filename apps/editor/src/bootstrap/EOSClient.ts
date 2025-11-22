interface EOSClientConfig {
  sanctionsEndpoint: string;
  reportsEndpoint: string;
  telemetryEndpoint?: string;
  enabled?: boolean;
}

export interface AntiCheatEvent {
  ticketId: string;
  playerId: string;
  severity: 'info' | 'warn' | 'ban';
  reasons: string[];
}

export interface IntentTelemetry {
  playerId: string;
  inputsPerSecond: number;
  aimVariance: number;
  reportCount?: number;
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
        playerId: event.playerId,
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

  async sendTelemetry(data: IntentTelemetry): Promise<void> {
    if (!this.initialized || this.config.enabled === false || !this.config.telemetryEndpoint) {
      return;
    }
    await fetch(this.config.telemetryEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }
}
