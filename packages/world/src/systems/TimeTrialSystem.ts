/**
 * TimeTrialSystem - Handles time trial timing and scoring
 */

import type { Scene } from '../core/Scene';
import type { Entity } from '../core/Entity';
import { TimerGateComponent } from '../components/TimerGateComponent';
import type { TelemetryCollector } from '@engine/world-server';

interface ActiveTrial {
  playerId: string;
  startTime: number;
  startGate: Entity;
  finishGate?: Entity;
}

/**
 * System that manages time trials
 */
export class TimeTrialSystem {
  // @ts-expect-error - Reserved for future use
  private readonly scene: Scene;
  private readonly activeTrials = new Map<string, ActiveTrial>();
  private readonly telemetry?: TelemetryCollector;
  private readonly zoneId: string;

  constructor(scene: Scene, zoneId: string, telemetry?: TelemetryCollector) {
    this.scene = scene;
    this.zoneId = zoneId;
    if (telemetry !== undefined) {
      this.telemetry = telemetry;
    }
  }

  /**
   * Start a time trial for a player
   */
  startTrial(playerId: string, startGate: Entity): void {
    const trial: ActiveTrial = {
      playerId,
      startTime: Date.now(),
      startGate,
    };
    this.activeTrials.set(playerId, trial);

    if (this.telemetry) {
      this.telemetry.emit({
        type: 'trial:start',
        timestamp: Date.now(),
        userId: playerId,
        zoneId: this.zoneId,
        trialId: startGate.id.toString(),
      });
    }
  }

  /**
   * Finish a time trial
   */
  finishTrial(playerId: string, finishGate: Entity): number | null {
    const trial = this.activeTrials.get(playerId);
    if (!trial) return null;

    const elapsed = Date.now() - trial.startTime;
    trial.finishGate = finishGate;

    // Check time limit if set
    const finishGateComponent = finishGate.getComponent(TimerGateComponent);
    if (finishGateComponent && finishGateComponent.timeLimit > 0) {
      if (elapsed > finishGateComponent.timeLimit) {
        // Trial failed
        this.activeTrials.delete(playerId);
        if (this.telemetry) {
          this.telemetry.emit({
            type: 'trial:fail',
            timestamp: Date.now(),
            userId: playerId,
            zoneId: this.zoneId,
            trialId: finishGate.id.toString(),
            time: elapsed,
          });
        }
        return null;
      }
    }

    // Trial completed successfully
    this.activeTrials.delete(playerId);
    if (this.telemetry) {
      this.telemetry.emit({
        type: 'trial:complete',
        timestamp: Date.now(),
        userId: playerId,
        zoneId: this.zoneId,
        trialId: finishGate.id.toString(),
        time: elapsed,
      });
    }

    return elapsed;
  }

  /**
   * Get current trial time for player
   */
  getCurrentTime(playerId: string): number | null {
    const trial = this.activeTrials.get(playerId);
    if (!trial) return null;
    return Date.now() - trial.startTime;
  }

  /**
   * Check if player is in an active trial
   */
  isInTrial(playerId: string): boolean {
    return this.activeTrials.has(playerId);
  }

  /**
   * Cancel active trial for player
   */
  cancelTrial(playerId: string): void {
    this.activeTrials.delete(playerId);
  }

  /**
   * Handle player entering a timer gate
   */
  handleGateEnter(playerId: string, gateEntity: Entity): void {
    const gate = gateEntity.getComponent(TimerGateComponent);
    if (!gate) return;

    if (gate.gateType === 'start') {
      this.startTrial(playerId, gateEntity);
    } else if (gate.gateType === 'finish') {
      this.finishTrial(playerId, gateEntity);
      // Time is returned for scoreboard display (consumed by caller)
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.activeTrials.clear();
  }
}

