export type SanctionAction = 'none' | 'review' | 'suspend' | 'ban';

export interface SanctionDecision {
  playerId: string;
  action: SanctionAction;
  reasons: string[];
  score: number;
}

export interface IntentTelemetry {
  playerId: string;
  inputsPerSecond: number;
  aimVariance: number;
  reportCount?: number;
}

export interface EosEvent {
  ticketId: string;
  playerId: string;
  severity: 'info' | 'warn' | 'ban';
  reasons: string[];
  metadata?: Record<string, unknown>;
}

export interface PlayerReport {
  playerId: string;
  reporterId: string;
  reason: string;
}

interface PlayerSecurityRecord {
  score: number;
  reportCount: number;
  lastDecision: SanctionAction;
  updatedAt: number;
}

export interface SanctionServiceOptions {
  inputRateThreshold?: number;
  aimVarianceFloor?: number;
  reportEscalation?: number;
  banReasons?: Set<string>;
  decayMs?: number;
}

/**
 * SanctionService aggregates Easy Anti-Cheat events with platform heuristics.
 * Scores accumulate over time and decay once the player behaves normally.
 */
export class SanctionService {
  private readonly records = new Map<string, PlayerSecurityRecord>();
  private readonly inputRateThreshold: number;
  private readonly aimVarianceFloor: number;
  private readonly reportEscalation: number;
  private readonly decayMs: number;
  private readonly banReasons: Set<string>;

  constructor(options?: SanctionServiceOptions) {
    this.inputRateThreshold = options?.inputRateThreshold ?? 150;
    this.aimVarianceFloor = options?.aimVarianceFloor ?? 0.02;
    this.reportEscalation = options?.reportEscalation ?? 3;
    this.decayMs = options?.decayMs ?? 5 * 60 * 1000;
    this.banReasons =
      options?.banReasons ??
      new Set<string>(['speed_hack', 'memory_write', 'aimbot', 'teleport', 'eac_ban']);
  }

  receiveIntentStats(stats: IntentTelemetry): SanctionDecision {
    const record = this.getRecord(stats.playerId);
    this.applyDecay(record);
    const reasons: string[] = [];

    if (stats.inputsPerSecond > this.inputRateThreshold) {
      record.score += 25;
      reasons.push(`inputs_per_second:${stats.inputsPerSecond.toFixed(1)}`);
    }

    if (stats.aimVariance <= this.aimVarianceFloor) {
      record.score += 30;
      reasons.push(`aim_variance:${stats.aimVariance.toFixed(4)}`);
    }

    if (stats.reportCount && stats.reportCount > 0) {
      record.reportCount += stats.reportCount;
      record.score += stats.reportCount * 5;
      reasons.push(`reports:${record.reportCount}`);
    }

    return this.evaluate(stats.playerId, record, reasons);
  }

  receiveEosEvent(event: EosEvent): SanctionDecision {
    const record = this.getRecord(event.playerId);
    this.applyDecay(record);
    const reasons = [...event.reasons];

    if (event.severity === 'ban' || event.reasons.some((reason) => this.banReasons.has(reason))) {
      record.score = 100;
      record.lastDecision = 'ban';
      return {
        playerId: event.playerId,
        action: 'ban',
        reasons,
        score: record.score,
      };
    }

    record.score += event.severity === 'warn' ? 20 : 5;
    return this.evaluate(event.playerId, record, reasons);
  }

  fileReport(report: PlayerReport): SanctionDecision {
    const record = this.getRecord(report.playerId);
    this.applyDecay(record);
    record.reportCount += 1;
    record.score += 5;
    const reasons = [`report:${report.reason}`];
    if (record.reportCount >= this.reportEscalation) {
      record.score += 20;
      reasons.push('report_threshold');
    }
    return this.evaluate(report.playerId, record, reasons);
  }

  private evaluate(playerId: string, record: PlayerSecurityRecord, reasons: string[]): SanctionDecision {
    let action: SanctionAction = 'none';
    if (record.score >= 90) {
      action = 'ban';
    } else if (record.score >= 60) {
      action = 'suspend';
    } else if (record.score >= 30) {
      action = 'review';
    }

    record.lastDecision = action;
    record.updatedAt = Date.now();

    return {
      playerId,
      action,
      reasons,
      score: record.score,
    };
  }

  private applyDecay(record: PlayerSecurityRecord): void {
    const now = Date.now();
    if (now - record.updatedAt > this.decayMs && record.score > 0) {
      const decaySteps = Math.floor((now - record.updatedAt) / this.decayMs);
      record.score = Math.max(0, record.score - decaySteps * 10);
      record.reportCount = Math.max(0, record.reportCount - decaySteps);
      record.updatedAt = now;
    }
  }

  private getRecord(playerId: string): PlayerSecurityRecord {
    if (!this.records.has(playerId)) {
      this.records.set(playerId, { score: 0, reportCount: 0, lastDecision: 'none', updatedAt: Date.now() });
    }
    return this.records.get(playerId)!;
  }
}

