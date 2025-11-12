import type { Vec3 } from '@engine/core/math';
import { Logger } from '../utils/logger';

/**
 * Game save data structure
 */
export interface GameSaveData {
  /** Save slot ID */
  slotId: string;
  /** Build ID this save is for */
  buildId: string;
  /** Timestamp when save was created */
  timestamp: number;
  /** Player position */
  playerPosition: Vec3;
  /** Player rotation (yaw) */
  playerRotation: number;
  /** Active checkpoint entity path (if any) */
  checkpointPath?: number[];
  /** Additional game state data */
  gameState?: Record<string, any>;
}

/**
 * SaveSystem manages game save/load functionality
 * 
 * Features:
 * - Save game state to localStorage/IndexedDB
 * - Load game state
 * - Multiple save slots
 * - Auto-save support
 */
export class SaveSystem {
  private buildId: string | null = null;
  private readonly storageKeyPrefix = 'forge_player_save_';

  /**
   * Initialize save system
   */
  initialize(buildId: string): void {
    this.buildId = buildId;
    Logger.debug('[SaveSystem] Initialized');
  }

  /**
   * Save current game state
   * 
   * @param slotId - Save slot ID (default: 'autosave')
   * @param playerPosition - Current player position
   * @param playerRotation - Current player rotation (yaw)
   * @param gameState - Additional game state data
   * @returns True if save was successful
   */
  saveGame(
    slotId: string,
    playerPosition: Vec3,
    playerRotation: number,
    gameState?: Record<string, any>
  ): boolean {
    if (!this.buildId) {
      Logger.warn('[SaveSystem] Cannot save: buildId not set');
      return false;
    }

    try {
      // TODO: Calculate checkpoint path when checkpoint entity path calculation is implemented
      const checkpointPath: number[] | undefined = undefined;

      const saveData: GameSaveData = {
        slotId,
        buildId: this.buildId,
        timestamp: Date.now(),
        playerPosition: [...playerPosition] as Vec3,
        playerRotation,
        ...(checkpointPath !== undefined && { checkpointPath }),
        ...(gameState !== undefined && { gameState }),
      };

      const storageKey = `${this.storageKeyPrefix}${slotId}`;
      localStorage.setItem(storageKey, JSON.stringify(saveData));
      
      Logger.info(`[SaveSystem] Game saved to slot: ${slotId}`);
      return true;
    } catch (error) {
      Logger.error('[SaveSystem] Failed to save game:', error as unknown as Error);
      return false;
    }
  }

  /**
   * Load game state from save slot
   * 
   * @param slotId - Save slot ID
   * @returns Save data or null if not found/invalid
   */
  loadGame(slotId: string): GameSaveData | null {
    try {
      const storageKey = `${this.storageKeyPrefix}${slotId}`;
      const data = localStorage.getItem(storageKey);
      
      if (!data) {
        Logger.warn(`[SaveSystem] No save data found for slot: ${slotId}`);
        return null;
      }

      const saveData = JSON.parse(data) as GameSaveData;
      
      // Validate save data
      if (!saveData.buildId || !saveData.playerPosition || saveData.playerRotation === undefined) {
        Logger.warn(`[SaveSystem] Invalid save data for slot: ${slotId}`);
        return null;
      }

      // Check if save is for current build
      if (this.buildId && saveData.buildId !== this.buildId) {
        Logger.warn(`[SaveSystem] Save data is for different build (${saveData.buildId} vs ${this.buildId})`);
        return null;
      }

      Logger.info(`[SaveSystem] Game loaded from slot: ${slotId}`);
      return saveData;
    } catch (error) {
      Logger.error('[SaveSystem] Failed to load game:', error as unknown as Error);
      return null;
    }
  }

  /**
   * Delete save slot
   * 
   * @param slotId - Save slot ID
   * @returns True if deleted successfully
   */
  deleteSave(slotId: string): boolean {
    try {
      const storageKey = `${this.storageKeyPrefix}${slotId}`;
      localStorage.removeItem(storageKey);
      Logger.info(`[SaveSystem] Save slot deleted: ${slotId}`);
      return true;
    } catch (error) {
      Logger.error('[SaveSystem] Failed to delete save:', error as unknown as Error);
      return false;
    }
  }

  /**
   * List all save slots for current build
   * 
   * @returns Array of save slot metadata
   */
  listSaves(): Array<{ slotId: string; timestamp: number; buildId: string }> {
    const saves: Array<{ slotId: string; timestamp: number; buildId: string }> = [];
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(this.storageKeyPrefix)) {
          continue;
        }

        const slotId = key.substring(this.storageKeyPrefix.length);
        const data = localStorage.getItem(key);
        
        if (!data) {
          continue;
        }

        try {
          const saveData = JSON.parse(data) as GameSaveData;
          
          // Filter by buildId if set
          if (this.buildId && saveData.buildId !== this.buildId) {
            continue;
          }

          saves.push({
            slotId,
            timestamp: saveData.timestamp,
            buildId: saveData.buildId,
          });
        } catch {
          // Invalid JSON, skip
          continue;
        }
      }

      // Sort by timestamp (newest first)
      saves.sort((a, b) => b.timestamp - a.timestamp);
      
      return saves;
    } catch (error) {
      Logger.error('[SaveSystem] Failed to list saves:', error as unknown as Error);
      return [];
    }
  }

  /**
   * Auto-save current game state
   * 
   * @param playerPosition - Current player position
   * @param playerRotation - Current player rotation
   */
  autoSave(playerPosition: Vec3, playerRotation: number): void {
    this.saveGame('autosave', playerPosition, playerRotation);
  }

  /**
   * Load auto-save if available
   * 
   * @returns Save data or null
   */
  loadAutoSave(): GameSaveData | null {
    return this.loadGame('autosave');
  }

  /**
   * Clear all saves for current build
   */
  clearAllSaves(): void {
    const saves = this.listSaves();
    for (const save of saves) {
      this.deleteSave(save.slotId);
    }
    Logger.info('[SaveSystem] All saves cleared');
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.buildId = null;
  }
}

