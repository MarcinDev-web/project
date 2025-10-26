/**
 * RecentAssetsTracker - Tracks recently used assets
 *
 * Features:
 * - Track asset usage with timestamp
 * - Maintain maximum limit (30 items)
 * - Persist to localStorage
 * - Auto-deduplicate (move to front)
 */
export class RecentAssetsTracker {
    recent = [];
    listeners = [];
    storageKey = 'recentAssets';
    maxItems = 30;
    constructor() {
        this.loadFromStorage();
    }
    /**
     * Record asset usage
     * If asset already exists, moves it to front
     */
    recordUsage(assetId) {
        // Remove if already exists
        this.recent = this.recent.filter(entry => entry.assetId !== assetId);
        // Add to front with current timestamp
        this.recent.unshift({
            assetId,
            timestamp: Date.now(),
        });
        // Trim to max items
        if (this.recent.length > this.maxItems) {
            this.recent = this.recent.slice(0, this.maxItems);
        }
        this.saveToStorage();
        this.notifyListeners();
    }
    /**
     * Get recent asset IDs (most recent first)
     */
    getRecent(limit) {
        const items = limit ? this.recent.slice(0, limit) : this.recent;
        return items.map(entry => entry.assetId);
    }
    /**
     * Get recent assets from registry
     */
    getRecentAssets(assetGetter, limit) {
        return this.getRecent(limit)
            .map(id => assetGetter(id))
            .filter((asset) => asset !== undefined);
    }
    /**
     * Check if asset is in recent list
     */
    isRecent(assetId) {
        return this.recent.some(entry => entry.assetId === assetId);
    }
    /**
     * Get count of recent items
     */
    getCount() {
        return this.recent.length;
    }
    /**
     * Clear all recent items
     */
    clear() {
        this.recent = [];
        this.saveToStorage();
        this.notifyListeners();
    }
    /**
     * Remove a specific asset from recent list
     */
    remove(assetId) {
        const originalLength = this.recent.length;
        this.recent = this.recent.filter(entry => entry.assetId !== assetId);
        if (this.recent.length !== originalLength) {
            this.saveToStorage();
            this.notifyListeners();
        }
    }
    /**
     * Get time since last use (in milliseconds)
     */
    getTimeSinceLastUse(assetId) {
        const entry = this.recent.find(e => e.assetId === assetId);
        if (!entry)
            return null;
        return Date.now() - entry.timestamp;
    }
    /**
     * Add a change listener
     */
    addListener(listener) {
        this.listeners.push(listener);
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }
    /**
     * Save to localStorage
     */
    saveToStorage() {
        try {
            const data = JSON.stringify(this.recent);
            localStorage.setItem(this.storageKey, data);
        }
        catch (error) {
            console.error('Failed to save recent assets:', error);
        }
    }
    /**
     * Load from localStorage
     */
    loadFromStorage() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (data) {
                this.recent = JSON.parse(data);
            }
        }
        catch (error) {
            console.error('Failed to load recent assets:', error);
            this.recent = [];
        }
    }
    /**
     * Notify all listeners of changes
     */
    notifyListeners() {
        const recentIds = this.getRecent();
        this.listeners.forEach(listener => {
            try {
                listener(recentIds);
            }
            catch (error) {
                console.error('Error in recent assets listener:', error);
            }
        });
    }
}
//# sourceMappingURL=RecentAssetsTracker.js.map