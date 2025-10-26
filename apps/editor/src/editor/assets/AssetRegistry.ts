/**
 * Asset Registry - Editor wrapper for @engine/assets
 * 
 * This file creates a singleton instance of AssetRegistry with editor-specific
 * Logger configuration. All asset management logic is in @engine/assets package.
 */

import { AssetRegistry } from '@engine/assets';
import { Logger } from '../../utils/logger';

// Re-export types for backward compatibility
export type { 
  Asset,
  AssetFilter,
  AssetSortOptions,
  AssetCollection,
  AssetType,
  AssetMainCategory,
  AssetSubcategory,
  AssetStyle,
  AssetMaterial,
  BlockDefinition,
  RegisterBlockAssetOptions,
} from '@engine/assets';

// Re-export class for direct instantiation if needed
export { AssetRegistry } from '@engine/assets';

/**
 * Singleton instance of AssetRegistry configured with editor's Logger
 */
export const assetRegistry = new AssetRegistry({
  logger: {
    debug: Logger.debug.bind(Logger),
    warn: Logger.warn.bind(Logger),
    error: Logger.error.bind(Logger),
  },
});
