/**
 * RecentAssetsTracker - Tracks recently used assets
 *
 * Features:
 * - Track asset usage with timestamp
 * - Maintain maximum limit (30 items)
 * - Persist to localStorage
 * - Auto-deduplicate (move to front)
 */
import type { Asset } from './AssetTypes';
export type RecentAssetsChangeListener = (recentIds: string[]) => void;
export declare class RecentAssetsTracker {
    private recent;
    private listeners;
    private readonly storageKey;
    private readonly maxItems;
    constructor();
    /**
     * Record asset usage
     * If asset already exists, moves it to front
     */
    recordUsage(assetId: string): void;
    /**
     * Get recent asset IDs (most recent first)
     */
    getRecent(limit?: number): string[];
    /**
     * Get recent assets from registry
     */
    getRecentAssets(assetGetter: (id: string) => Asset | undefined, limit?: number): Asset[];
    /**
     * Check if asset is in recent list
     */
    isRecent(assetId: string): boolean;
    /**
     * Get count of recent items
     */
    getCount(): number;
    /**
     * Clear all recent items
     */
    clear(): void;
    /**
     * Remove a specific asset from recent list
     */
    remove(assetId: string): void;
    /**
     * Get time since last use (in milliseconds)
     */
    getTimeSinceLastUse(assetId: string): number | null;
    /**
     * Add a change listener
     */
    addListener(listener: RecentAssetsChangeListener): () => void;
    /**
     * Save to localStorage
     */
    private saveToStorage;
    /**
     * Load from localStorage
     */
    private loadFromStorage;
    /**
     * Notify all listeners of changes
     */
    private notifyListeners;
}
//# sourceMappingURL=RecentAssetsTracker.d.ts.map