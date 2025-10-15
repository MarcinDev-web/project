/**
 * RecentAssetsTracker - Tracks recently used assets
 * 
 * Features:
 * - Track asset usage with timestamp
 * - Maintain maximum limit (30 items)
 * - Persist to localStorage
 * - Auto-deduplicate (move to front)
 */

import type { Asset } from '../assets/AssetTypes';
import { Logger } from '../../logger';

interface RecentAssetEntry {
  assetId: string;
  timestamp: number;
}

export type RecentAssetsChangeListener = (recentIds: string[]) => void;

export class RecentAssetsTracker {
  private recent: RecentAssetEntry[] = [];
  private listeners: RecentAssetsChangeListener[] = [];
  private readonly storageKey = 'recentAssets';
  private readonly maxItems = 30;

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Record asset usage
   * If asset already exists, moves it to front
   */
  public recordUsage(assetId: string): void {
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
  public getRecent(limit?: number): string[] {
    const items = limit ? this.recent.slice(0, limit) : this.recent;
    return items.map(entry => entry.assetId);
  }

  /**
   * Get recent assets from registry
   */
  public getRecentAssets(
    assetGetter: (id: string) => Asset | undefined,
    limit?: number
  ): Asset[] {
    return this.getRecent(limit)
      .map(id => assetGetter(id))
      .filter((asset): asset is Asset => asset !== undefined);
  }

  /**
   * Check if asset is in recent list
   */
  public isRecent(assetId: string): boolean {
    return this.recent.some(entry => entry.assetId === assetId);
  }

  /**
   * Get count of recent items
   */
  public getCount(): number {
    return this.recent.length;
  }

  /**
   * Clear all recent items
   */
  public clear(): void {
    this.recent = [];
    this.saveToStorage();
    this.notifyListeners();
  }

  /**
   * Remove a specific asset from recent list
   */
  public remove(assetId: string): void {
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
  public getTimeSinceLastUse(assetId: string): number | null {
    const entry = this.recent.find(e => e.assetId === assetId);
    if (!entry) return null;
    return Date.now() - entry.timestamp;
  }

  /**
   * Add a change listener
   */
  public addListener(listener: RecentAssetsChangeListener): () => void {
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
  private saveToStorage(): void {
    try {
      const data = JSON.stringify(this.recent);
      localStorage.setItem(this.storageKey, data);
    } catch (error) {
      Logger.error('Failed to save recent assets:', error as Error);
    }
  }

  /**
   * Load from localStorage
   */
  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        this.recent = JSON.parse(data) as RecentAssetEntry[];
      }
    } catch (error) {
      Logger.error('Failed to load recent assets:', error as Error);
      this.recent = [];
    }
  }

  /**
   * Notify all listeners of changes
   */
  private notifyListeners(): void {
    const recentIds = this.getRecent();
    this.listeners.forEach(listener => {
      try {
        listener(recentIds);
      } catch (error) {
        Logger.error('Error in recent assets listener:', error as Error);
      }
    });
  }
}

