/**
 * PlacementCoordinator - Coordinates placement between hotbar and catalog
 * 
 * Provides a single source of truth for active placement mode,
 * preventing conflicts when assets are selected from multiple sources.
 */

import type { Asset, AssetPreset } from '../types/BlockAssetTypes';
import type { PlacementMode } from '../placement/PlacementMode';
import type { Entity } from '@engine/world';
import { Logger } from '../../utils/logger';

export interface PlacementCoordinatorConfig {
  placementMode: PlacementMode;
  onPlacementStart?: (asset: Asset, source?: 'hotbar' | 'build-menu') => void;
  onPlacementEnd?: (confirmed: boolean) => void;
  onStatusUpdate?: (message: string) => void;
}

export type PlacementSource = 'hotbar' | 'build-menu';

export class PlacementCoordinator {
  private config: PlacementCoordinatorConfig;
  private currentAsset: Asset | null = null;
  private currentSource: PlacementSource | null = null;

  constructor(config: PlacementCoordinatorConfig) {
    this.config = config;
  }

  /**
   * Starts placement of an asset from a specific source
   */
  startPlacement(asset: Asset, source: PlacementSource = 'build-menu'): void {
    // Cancel any existing placement first
    if (this.isPlacementActive()) {
      this.cancelPlacement();
    }

    this.currentAsset = asset;
    this.currentSource = source;

    // Convert Asset to AssetPreset for PlacementMode
    const preset = this.assetToPreset(asset);

    // Store existing onPlacementConfirmed callback to preserve it
    const existingConfig = this.config.placementMode.getConfig();
    const existingCallback = existingConfig.onPlacementConfirmed;

    // Set up callback to handle auto-continue for hotbar
    // This callback will be called even when placement is confirmed directly by controllers
    // IMPORTANT: We need to capture currentSource and currentAsset in closure before they're cleared
    const sourceForCallback = source;
    const assetForCallback = asset;
    
    this.config.placementMode.setConfig({
      onPlacementConfirmed: (entity: Entity) => {
        Logger.debug('PlacementCoordinator: onPlacementConfirmed callback called', {
          entityName: entity?.name,
          sourceForCallback,
          assetForCallback: assetForCallback?.name,
        });
        
        // Call existing callback if present
        existingCallback?.(entity);
        
        // Auto-continue placement for hotbar: restart with same asset
        if (sourceForCallback === 'hotbar' && assetForCallback) {
          Logger.debug('PlacementCoordinator: Auto-continuing hotbar placement', {
            asset: assetForCallback.name,
          });
          
          // Restart placement with same asset after a short delay
          // This allows the placement confirmation to complete before restarting
          // Delay is slightly longer than EditorPlacementController's delay (50ms) to ensure
          // placement mode state is stable before restarting
          setTimeout(() => {
            Logger.debug('PlacementCoordinator: Restarting placement after auto-continue');
            this.startPlacement(assetForCallback, sourceForCallback);
          }, 60);
        } else {
          Logger.debug('PlacementCoordinator: Not auto-continuing', {
            source: sourceForCallback,
            hasAsset: !!assetForCallback,
          });
        }
      },
    });

    // Start placement mode
    this.config.placementMode.startPlacement(preset);

    // Notify listeners
    this.config.onPlacementStart?.(asset, source);

    // Update status
    const sourceName = source === 'hotbar' ? 'Hotbar' : 'Build Menu';
    this.config.onStatusUpdate?.(
      `Placing ${asset.name} from ${sourceName} (Q/E rotate, Enter confirm, Esc cancel)`
    );

    Logger.debug(`PlacementCoordinator: Started placement from ${source}`, asset.name);
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
      // Note: Auto-continue for hotbar is handled by onPlacementConfirmed callback
      // set up in startPlacement(), which is called even when controllers confirm directly
    } else {
      Logger.warn('PlacementCoordinator: Cannot place here (collision)');
      this.config.onStatusUpdate?.('Cannot place here - collision detected');
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
    this.currentSource = null;
  }

  /**
   * Rotates the current placement preview
   */
  async rotatePreview(direction: 1 | -1): Promise<void> {
    if (!this.isPlacementActive()) {
      return;
    }

    await this.config.placementMode.rotatePreview(direction);
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
   * Gets the source of the current placement
   */
  getCurrentSource(): PlacementSource | null {
    return this.currentSource;
  }

  /**
   * Converts an Asset to AssetPreset for placement
   */
  private assetToPreset(asset: Asset): AssetPreset {
    // Default scale for blocks is 1x1x1
    const finalScale: [number, number, number] = [1, 1, 1];

    const preset: AssetPreset = {
      name: asset.name,
      scale: finalScale,
      color: asset.color,
      ...(asset.blockData?.id && { blockId: asset.blockData.id }),
    };

    return preset;
  }

  /**
   * Updates the configuration
   */
  setConfig(config: Partial<PlacementCoordinatorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

