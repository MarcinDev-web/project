/**
 * VegetationPresetManager - Manages custom vegetation presets
 * 
 * Features:
 * - Create/update/delete custom vegetation presets
 * - Persist to localStorage
 * - Event system for UI updates
 * - Convert presets to assets for AssetPalette integration
 */

import type { AssetPreset, Asset } from '../types/BlockAssetTypes';
import { storageLoad, storageSave } from '../../utils/storage';
import { Logger } from '../../utils/logger';

const STORAGE_KEY = 'vegetation-presets';

export type VegetationPresetChangeListener = (presets: Map<string, AssetPreset>) => void;

/**
 * Manages custom vegetation presets
 */
export class VegetationPresetManager {
  private presets = new Map<string, AssetPreset>();
  private listeners: VegetationPresetChangeListener[] = [];

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Creates a new vegetation preset
   */
  public createPreset(name: string, config: AssetPreset['vegetationConfig']): AssetPreset {
    if (!config) {
      throw new Error('Vegetation config is required');
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
      vegetationConfig: config,
    };

    this.presets.set(presetId, preset);
    this.saveToStorage();
    this.notifyListeners();
    Logger.debug(`Created vegetation preset: ${name} (${presetId})`);

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

    const { vegetationConfig: vegetationConfigUpdate, ...otherUpdates } = updates;

    const updated: AssetPreset = {
      ...existing,
      ...otherUpdates,
    };

    if ('vegetationConfig' in updates) {
      if (vegetationConfigUpdate !== undefined) {
        updated.vegetationConfig = vegetationConfigUpdate;
      } else {
        delete updated.vegetationConfig;
      }
    }

    this.presets.set(id, updated);
    this.saveToStorage();
    this.notifyListeners();
    Logger.debug(`Updated vegetation preset: ${id}`);

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
    Logger.debug(`Deleted vegetation preset: ${id}`);

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
   * Converts a vegetation preset to an Asset for AssetPalette integration
   */
  public presetToAsset(preset: AssetPreset, presetId: string): Asset {
    // Use vegetation type to determine category
    const category = this.getCategoryFromType(preset.vegetationConfig?.type);

    return {
      id: `vegetation-${presetId}`,
      name: preset.name,
      category,
      color: preset.color,
      blockData: {
        id: `vegetation-${presetId}`,
        name: preset.name,
        category,
        material: 'stone',
        textures: {
          top: { color: preset.color },
          bottom: { color: preset.color },
          sides: { color: preset.color },
          front: { color: preset.color },
          back: { color: preset.color },
          left: { color: preset.color },
          right: { color: preset.color },
        },
        properties: {
          solid: false,
          transparent: true,
          emissive: 0,
          roughness: 0.8,
          metallic: 0,
        },
      },
    };
  }

  /**
   * Gets all vegetation presets as assets
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
  public addListener(listener: VegetationPresetChangeListener): () => void {
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
      Logger.error('Failed to save vegetation presets:', error as Error);
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
        Logger.debug(`Loaded ${this.presets.size} vegetation presets from storage`);
      }
    } catch (error) {
      Logger.error('Failed to load vegetation presets:', error as Error);
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
        Logger.error('Error in vegetation preset listener:', error as Error);
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
   * Gets category from vegetation type
   */
  private getCategoryFromType(type?: string): 'basic' | 'natural' | 'gameplay' {
    switch (type) {
      case 'grass':
      case 'flower':
      case 'shrub':
      case 'tree':
        return 'natural';
      default:
        return 'natural';
    }
  }
}

