/**
 * PlacementCoordinator - Coordinates placement between hotbar and catalog
 * 
 * Provides a single source of truth for active placement mode,
 * preventing conflicts when assets are selected from multiple sources.
 */

import type { Asset, AssetVariant, AssetPreset } from '../types/BlockAssetTypes';
import type { PlacementMode } from '../placement/PlacementMode';
import { Logger } from '../../utils/logger';

export interface PlacementCoordinatorConfig {
  placementMode: PlacementMode;
  onPlacementStart?: (asset: Asset, variant?: AssetVariant, source?: 'hotbar' | 'catalog') => void;
  onPlacementEnd?: (confirmed: boolean) => void;
  onStatusUpdate?: (message: string) => void;
}

export type PlacementSource = 'hotbar' | 'catalog';

export class PlacementCoordinator {
  private config: PlacementCoordinatorConfig;
  private currentAsset: Asset | null = null;
  private currentVariant: AssetVariant | null = null;
  private currentSource: PlacementSource | null = null;

  constructor(config: PlacementCoordinatorConfig) {
    this.config = config;
  }

  /**
   * Starts placement of an asset from a specific source
   */
  startPlacement(asset: Asset, variant?: AssetVariant, source: PlacementSource = 'catalog'): void {
    // Cancel any existing placement first
    if (this.isPlacementActive()) {
      this.cancelPlacement();
    }

    this.currentAsset = asset;
    this.currentVariant = variant || null;
    this.currentSource = source;

    // Convert Asset to AssetPreset for PlacementMode
    const preset = this.assetToPreset(asset, variant);

    // Start placement mode
    this.config.placementMode.startPlacement(preset);

    // Notify listeners
    this.config.onPlacementStart?.(asset, variant, source);

    // Update status
    const sourceName = source === 'hotbar' ? 'Hotbar' : 'Catalog';
    this.config.onStatusUpdate?.(
      `Placing ${asset.metadata.name} from ${sourceName} (Q/E rotate, Enter confirm, Esc cancel)`
    );

    Logger.debug(`PlacementCoordinator: Started placement from ${source}`, asset.metadata.name);
  }

  /**
   * Confirms the current placement
   */
  confirmPlacement(): boolean {
    if (!this.isPlacementActive()) {
      return false;
    }

    const entity = this.config.placementMode.confirmPlacement();
    const success = entity !== null;

    if (success) {
      Logger.debug('PlacementCoordinator: Placement confirmed', entity?.name);
      this.config.onPlacementEnd?.(true);
      this.config.onStatusUpdate?.('Placement confirmed');
    } else {
      Logger.warn('PlacementCoordinator: Cannot place here (collision)');
      this.config.onStatusUpdate?.('Cannot place here - collision detected');
    }

    // Clear current asset if successful
    if (success) {
      this.currentAsset = null;
      this.currentVariant = null;
      this.currentSource = null;
    }

    return success;
  }

  /**
   * Cancels the current placement
   */
  cancelPlacement(): void {
    if (!this.isPlacementActive()) {
      return;
    }

    this.config.placementMode.cancelPlacement();

    Logger.debug('PlacementCoordinator: Placement cancelled');
    this.config.onPlacementEnd?.(false);
    this.config.onStatusUpdate?.('Placement cancelled');

    this.currentAsset = null;
    this.currentVariant = null;
    this.currentSource = null;
  }

  /**
   * Rotates the current placement preview
   */
  rotatePreview(direction: 1 | -1): void {
    if (!this.isPlacementActive()) {
      return;
    }

    this.config.placementMode.rotatePreview(direction);
    Logger.debug(`PlacementCoordinator: Rotated ${direction > 0 ? 'clockwise' : 'counter-clockwise'}`);
  }

  /**
   * Checks if placement is currently active
   */
  isPlacementActive(): boolean {
    return this.config.placementMode.isActive();
  }

  /**
   * Gets the current asset being placed
   */
  getCurrentAsset(): Asset | null {
    return this.currentAsset;
  }

  /**
   * Gets the current variant being placed
   */
  getCurrentVariant(): AssetVariant | null {
    return this.currentVariant;
  }

  /**
   * Gets the source of the current placement
   */
  getCurrentSource(): PlacementSource | null {
    return this.currentSource;
  }

  /**
   * Converts an Asset (with optional variant) to AssetPreset for placement
   */
  private assetToPreset(asset: Asset, variant?: AssetVariant): AssetPreset {
    const finalColor = variant?.color || asset.color;
    const finalScale = variant?.scale || asset.scale;

    const preset: AssetPreset = {
      name: variant ? `${asset.metadata.name} (${variant.name})` : asset.metadata.name,
      description: asset.metadata.description || '',
      category: asset.category as AssetPreset['category'],
      scale: finalScale,
      color: finalColor,
    };

    // Add blockId if this is a block asset
    if (asset.blockData?.id) {
      preset.blockId = asset.blockData.id;
    }

    return preset;
  }

  /**
   * Updates the configuration
   */
  setConfig(config: Partial<PlacementCoordinatorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

