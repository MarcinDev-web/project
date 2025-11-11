/**
 * NpcPresetManager - Manages custom NPC presets
 * 
 * Features:
 * - Create/update/delete custom NPC presets
 * - Persist to localStorage
 * - Event system for UI updates
 * - Convert presets to assets for AssetPalette integration
 */

import type { AssetPreset, Asset } from '../types/BlockAssetTypes';
import { storageLoad, storageSave } from '../../utils/storage';
import { Logger } from '../../utils/logger';

const STORAGE_KEY = 'npc-presets';

export type NpcPresetChangeListener = (presets: Map<string, AssetPreset>) => void;

/**
 * Manages custom NPC presets
 */
export class NpcPresetManager {
  private presets = new Map<string, AssetPreset>();
  private listeners: NpcPresetChangeListener[] = [];

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Creates a new NPC preset
   */
  public createPreset(name: string, config: AssetPreset['npcConfig']): AssetPreset {
    if (!config) {
      throw new Error('NPC config is required');
    }

    // Generate unique ID if name already exists
    let presetId = this.sanitizeId(name);
    let counter = 1;
    while (this.presets.has(presetId)) {
      presetId = `${this.sanitizeId(name)}-${counter}`;
      counter++;
    }

    const preset: AssetPreset = {
      name,
      scale: [1, 1, 1],
      color: [0.5, 0.5, 0.5, 1], // Default color
      npcConfig: config,
    };

    this.presets.set(presetId, preset);
    this.saveToStorage();
    this.notifyListeners();
    Logger.debug(`Created NPC preset: ${name} (${presetId})`);

    return preset;
  }

  /**
   * Updates an existing preset
   */
  public updatePreset(id: string, updates: Partial<AssetPreset>): boolean {
    const existing = this.presets.get(id);
    if (!existing) {
      Logger.warn(`Preset not found: ${id}`);
      return false;
    }

    const updated: AssetPreset = {
      ...existing,
      ...updates,
      // Only update npcConfig if explicitly provided (not undefined)
      // This preserves existing npcConfig when updates don't include it
      npcConfig: updates.npcConfig !== undefined ? updates.npcConfig : existing.npcConfig,
    };

    this.presets.set(id, updated);
    this.saveToStorage();
    this.notifyListeners();
    Logger.debug(`Updated NPC preset: ${id}`);

    return true;
  }

  /**
   * Deletes a preset
   */
  public deletePreset(id: string): boolean {
    if (!this.presets.has(id)) {
      return false;
    }

    this.presets.delete(id);
    this.saveToStorage();
    this.notifyListeners();
    Logger.debug(`Deleted NPC preset: ${id}`);

    return true;
  }

  /**
   * Gets a preset by ID
   */
  public getPreset(id: string): AssetPreset | undefined {
    return this.presets.get(id);
  }

  /**
   * Gets all presets
   */
  public getAllPresets(): AssetPreset[] {
    return Array.from(this.presets.values());
  }

  /**
   * Gets all preset IDs
   */
  public getAllPresetIds(): string[] {
    return Array.from(this.presets.keys());
  }

  /**
   * Gets preset count
   */
  public getCount(): number {
    return this.presets.size;
  }

  /**
   * Converts an NPC preset to an Asset for AssetPalette integration
   */
  public presetToAsset(preset: AssetPreset, presetId: string): Asset {
    // NPCs are gameplay assets
    const category: 'basic' | 'natural' | 'gameplay' = 'gameplay';

    // Use faction/unit type to determine color
    const color = this.getColorFromConfig(preset.npcConfig);

    return {
      id: `npc-${presetId}`,
      name: preset.name,
      category,
      color,
      blockData: {
        id: `npc-${presetId}`,
        name: preset.name,
        category,
        textures: {
          top: { color },
          bottom: { color },
          front: { color },
          back: { color },
          left: { color },
          right: { color },
        },
      },
    };
  }

  /**
   * Gets all NPC presets as assets
   */
  public getAllPresetsAsAssets(): Asset[] {
    const assets: Asset[] = [];
    for (const [id, preset] of this.presets.entries()) {
      assets.push(this.presetToAsset(preset, id));
    }
    return assets;
  }

  /**
   * Finds preset ID by name
   */
  public findPresetIdByName(name: string): string | undefined {
    for (const [id, preset] of this.presets.entries()) {
      if (preset.name === name) {
        return id;
      }
    }
    return undefined;
  }

  /**
   * Adds a change listener
   */
  public addListener(listener: NpcPresetChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Saves presets to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = Array.from(this.presets.entries()).map(([id, preset]) => ({
        id,
        preset,
      }));
      storageSave(STORAGE_KEY, data);
    } catch (error) {
      Logger.error('Failed to save NPC presets:', error as Error);
    }
  }

  /**
   * Loads presets from localStorage
   */
  private loadFromStorage(): void {
    try {
      const data = storageLoad<Array<{ id: string; preset: AssetPreset }>>(STORAGE_KEY);
      if (data) {
        this.presets.clear();
        for (const { id, preset } of data) {
          this.presets.set(id, preset);
        }
        Logger.debug(`Loaded ${this.presets.size} NPC presets from storage`);
      }
    } catch (error) {
      Logger.error('Failed to load NPC presets:', error as Error);
    }
  }

  /**
   * Notifies all listeners of changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.presets);
      } catch (error) {
        Logger.error('Error in NPC preset listener:', error as Error);
      }
    });
  }

  /**
   * Sanitizes a name to create a valid ID
   */
  private sanitizeId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Gets color from NPC config (faction-based coloring)
   */
  private getColorFromConfig(config?: AssetPreset['npcConfig']): [number, number, number, number] {
    if (!config) {
      return [0.5, 0.5, 0.5, 1]; // Default gray
    }

    // Color by faction
    switch (config.faction) {
      case 'ally':
        return [0.2, 0.8, 0.2, 1]; // Green
      case 'enemy':
        return [0.8, 0.2, 0.2, 1]; // Red
      case 'neutral':
        return [0.5, 0.5, 0.5, 1]; // Gray
      default:
        return [0.5, 0.5, 0.5, 1]; // Default gray
    }
  }
}

