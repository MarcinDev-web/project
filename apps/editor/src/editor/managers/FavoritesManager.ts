/**
 * FavoritesManager - Manages favorite assets
 * 
 * Features:
 * - Add/remove favorites
 * - Persist to localStorage
 * - Event system for UI updates
 */

import type { Asset } from '../types/BlockAssetTypes';
import { Logger } from '../../utils/logger';

export type FavoritesChangeListener = (favorites: Set<string>) => void;

export class FavoritesManager {
  private favorites = new Set<string>();
  private listeners: FavoritesChangeListener[] = [];
  private readonly storageKey = 'assetFavorites';

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Add an asset to favorites
   */
  public addFavorite(assetId: string): void {
    if (this.favorites.has(assetId)) {
      return;
    }

    this.favorites.add(assetId);
    this.saveToStorage();
    this.notifyListeners();
  }

  /**
   * Remove an asset from favorites
   */
  public removeFavorite(assetId: string): void {
    if (!this.favorites.has(assetId)) {
      return;
    }

    this.favorites.delete(assetId);
    this.saveToStorage();
    this.notifyListeners();
  }

  /**
   * Toggle favorite status
   */
  public toggleFavorite(assetId: string): boolean {
    if (this.favorites.has(assetId)) {
      this.removeFavorite(assetId);
      return false;
    } else {
      this.addFavorite(assetId);
      return true;
    }
  }

  /**
   * Check if an asset is favorited
   */
  public isFavorite(assetId: string): boolean {
    return this.favorites.has(assetId);
  }

  /**
   * Get all favorite asset IDs
   */
  public getFavorites(): string[] {
    return Array.from(this.favorites);
  }

  /**
   * Get favorite assets from registry
   */
  public getFavoriteAssets(assetGetter: (id: string) => Asset | undefined): Asset[] {
    return this.getFavorites()
      .map(id => assetGetter(id))
      .filter((asset): asset is Asset => asset !== undefined);
  }

  /**
   * Clear all favorites
   */
  public clear(): void {
    this.favorites.clear();
    this.saveToStorage();
    this.notifyListeners();
  }

  /**
   * Get count of favorites
   */
  public getCount(): number {
    return this.favorites.size;
  }

  /**
   * Add a change listener
   */
  public addListener(listener: FavoritesChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Save favorites to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = JSON.stringify(Array.from(this.favorites));
      localStorage.setItem(this.storageKey, data);
    } catch (error) {
      Logger.error('Failed to save favorites:', error as Error);
    }
  }

  /**
   * Load favorites from localStorage
   */
  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const favorites = JSON.parse(data) as string[];
        this.favorites = new Set(favorites);
      }
    } catch (error) {
      Logger.error('Failed to load favorites:', error as Error);
    }
  }

  /**
   * Notify all listeners of changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.favorites);
      } catch (error) {
        Logger.error('Error in favorites listener:', error as Error);
      }
    });
  }
}

