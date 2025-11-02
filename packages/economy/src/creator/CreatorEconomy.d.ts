/**
 * Creator Economy - Rewards for creators based on player engagement
 */
import { CurrencyManager } from '../index';
import type { TelemetryCollector } from '@engine/world-server';
/**
 * Creator reward configuration
 */
export interface CreatorRewardConfig {
    /** Base XP per player session (minutes) */
    xpPerSessionMinute: number;
    /** Bonus XP for time trial completions */
    xpPerTrialCompletion: number;
    /** Bonus XP for checkpoint activations */
    xpPerCheckpoint: number;
    /** Daily cap for XP (anti-farming) */
    dailyXpCap: number;
    /** Minimum unique players required for rewards */
    minUniquePlayers: number;
}
/**
 * Creator economy manager - calculates and distributes creator rewards
 */
export declare class CreatorEconomy {
    private readonly config;
    private readonly telemetry;
    private readonly creatorWallet;
    private readonly zoneId;
    private readonly _creatorId;
    /** Active player sessions */
    private readonly sessions;
    /** Today's XP earned */
    private dailyXpEarned;
    /** Unique players today */
    private readonly uniquePlayersToday;
    /** Last day tracked */
    private lastDay;
    constructor(currencyManager: CurrencyManager, creatorId: string, zoneId: string, telemetry: TelemetryCollector, config?: Partial<CreatorRewardConfig>);
    /**
     * Handle telemetry events and calculate rewards
     */
    private handleTelemetryEvent;
    private handleSessionStart;
    private handleSessionStop;
    private handleCheckpoint;
    private handleTrialComplete;
    /**
     * Award XP (respecting daily cap and anti-farming)
     */
    private awardXp;
    /**
     * Get creator's current XP balance
     */
    getCreatorXp(): number;
    /**
     * Get today's statistics
     */
    getTodayStats(): {
        uniquePlayers: number;
        xpEarned: number;
        activeSessions: number;
    };
    /**
     * Dispose resources
     */
    dispose(): void;
}
//# sourceMappingURL=CreatorEconomy.d.ts.map