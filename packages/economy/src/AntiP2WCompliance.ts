import type { IDisposable } from '@engine/core/utils';
import { GameMode, ItemCategory, type GameId } from './types';

/**
 * Configuration for anti-P2W compliance system
 */
export interface AntiP2WConfig {
  /** Optional logger */
  logger?: {
    debug: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (msg: string, error?: Error) => void;
  };
}

/**
 * Game registration for compliance tracking
 */
export interface GameRegistration {
  gameId: GameId;
  gameMode: GameMode;
  creatorId: string;
  verifiedFair: boolean;
  registeredAt: number;
}

/**
 * Item definition for compliance check
 */
export interface ItemDefinition {
  itemId: string;
  category: ItemCategory;
  name: string;
  description?: string;
  /** If category is PROGRESSION_BOOST, must specify what it affects */
  affectsStats?: {
    /** Affects time-to-kill? (FORBIDDEN) */
    affectsTTK?: boolean;
    /** Affects DPS? (FORBIDDEN) */
    affectsDPS?: boolean;
    /** Affects HP/defense? (FORBIDDEN) */
    affectsHP?: boolean;
    /** Affects ranking/leaderboard? (FORBIDDEN) */
    affectsRanking?: boolean;
  };
}

/**
 * Compliance check result
 */
export interface ComplianceResult {
  /** Is item allowed? */
  allowed: boolean;
  /** Reason for rejection (if not allowed) */
  reason?: string;
  /** Warning message (if allowed but with concerns) */
  warning?: string;
}

/**
 * Anti-Pay-to-Win compliance system.
 * Ensures games follow fair monetization rules.
 */
export class AntiP2WCompliance implements IDisposable {
  private readonly games = new Map<GameId, GameRegistration>();
  private disposed = false;

  private readonly logger: AntiP2WConfig['logger'];

  constructor(config: AntiP2WConfig = {}) {
    this.logger = config.logger ?? {
      debug: console.debug.bind(console),
      warn: console.warn.bind(console),
      error: (msg, err) => console.error(msg, err),
    };
  }

  /**
   * Registers a game for compliance tracking.
   */
  registerGame(gameId: GameId, gameMode: GameMode, creatorId: string): void {
    this.ensureNotDisposed();

    if (this.games.has(gameId)) {
      throw new Error(`Game ${gameId} is already registered`);
    }

    const registration: GameRegistration = {
      gameId,
      gameMode,
      creatorId,
      verifiedFair: false,
      registeredAt: Date.now(),
    };

    this.games.set(gameId, registration);
    this.logger?.debug(`Registered game ${gameId} with mode ${gameMode}`);
  }

  /**
   * Marks a game as "Verified Fair" (compliance verified).
   */
  verifyGame(gameId: GameId): void {
    this.ensureNotDisposed();

    const game = this.games.get(gameId);
    if (!game) {
      throw new Error(`Game ${gameId} is not registered`);
    }

    game.verifiedFair = true;
    this.logger?.debug(`Game ${gameId} verified as fair`);
  }

  /**
   * Revokes "Verified Fair" status.
   */
  revokeVerification(gameId: GameId): void {
    this.ensureNotDisposed();

    const game = this.games.get(gameId);
    if (!game) {
      throw new Error(`Game ${gameId} is not registered`);
    }

    game.verifiedFair = false;
    this.logger?.warn(`Verification revoked for game ${gameId}`);
  }

  /**
   * Checks if an item can be sold in a game (compliance check).
   */
  checkItemCompliance(gameId: GameId, item: ItemDefinition): ComplianceResult {
    this.ensureNotDisposed();

    const game = this.games.get(gameId);
    if (!game) {
      return {
        allowed: false,
        reason: `Game ${gameId} is not registered`,
      };
    }

    // Cosmetic items are always allowed
    if (item.category === ItemCategory.COSMETIC) {
      return { allowed: true };
    }

    // Competitive games: only cosmetics allowed
    if (game.gameMode === GameMode.COMPETITIVE) {
      return {
        allowed: false,
        reason: `Competitive games only allow cosmetic items. Item ${item.itemId} is ${item.category}`,
      };
    }

    // Casual games: progression boosts allowed, but check for competitive advantages
    if (item.category === ItemCategory.PROGRESSION_BOOST) {
      if (item.affectsStats) {
        const forbidden = [];
        if (item.affectsStats.affectsTTK) forbidden.push('TTK');
        if (item.affectsStats.affectsDPS) forbidden.push('DPS');
        if (item.affectsStats.affectsHP) forbidden.push('HP');
        if (item.affectsStats.affectsRanking) forbidden.push('ranking');

        if (forbidden.length > 0) {
          return {
            allowed: false,
            reason: `Progression boosts cannot affect competitive stats: ${forbidden.join(', ')}`,
          };
        }
      }

      return {
        allowed: true,
        warning: 'Progression boost in Casual game - ensure it does not affect competitive gameplay',
      };
    }

    // Competitive advantage items are always forbidden
    if (item.category === ItemCategory.COMPETITIVE_ADVANTAGE) {
      return {
        allowed: false,
        reason: 'Competitive advantage items are forbidden in all game modes',
      };
    }

    // Unknown category
    return {
      allowed: false,
      reason: `Unknown item category: ${item.category}`,
    };
  }

  /**
   * Gets game registration info.
   */
  getGame(gameId: GameId): GameRegistration | null {
    this.ensureNotDisposed();
    return this.games.get(gameId) ?? null;
  }

  /**
   * Checks if game is verified fair.
   */
  isVerifiedFair(gameId: GameId): boolean {
    this.ensureNotDisposed();
    const game = this.games.get(gameId);
    return game?.verifiedFair ?? false;
  }

  /**
   * Gets all registered games.
   */
  getAllGames(): GameRegistration[] {
    this.ensureNotDisposed();
    return Array.from(this.games.values());
  }

  /**
   * Removes game registration.
   */
  unregisterGame(gameId: GameId): boolean {
    this.ensureNotDisposed();
    return this.games.delete(gameId);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.games.clear();
  }

  isDisposed(): boolean {
    return this.disposed;
  }

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('AntiP2WCompliance has been disposed');
    }
  }
}

