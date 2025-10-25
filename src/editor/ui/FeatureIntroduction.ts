/**
 * FeatureIntroduction - Progressive feature discovery system
 * 
 * Shows contextual one-time hints to introduce features
 * when users are likely to need them, avoiding overwhelming
 * beginners while helping them discover capabilities naturally.
 */

import { storageLoad, storageSave } from '../../utils/storage';
import { Logger } from '../../app/utils/logger';

const STORAGE_KEY = 'editor:introducedFeatures';

export interface FeatureTip {
  id: string;
  message: string;
  action?: string;
  dismissable: boolean;
}

export class FeatureIntroduction {
  private introduced = new Set<string>();
  private tipCallbacks = new Set<(tip: FeatureTip) => void>();
  
  constructor() {
    this.loadIntroducedFeatures();
  }
  
  /**
   * Shows one-time tooltip when user might need a feature
   */
  introduceWhenRelevant(featureId: string, condition: () => boolean, tip: Omit<FeatureTip, 'id'>): void {
    if (this.introduced.has(featureId)) {
      return; // Already introduced
    }
    
    if (!condition()) {
      return; // Condition not met
    }
    
    // Show the tip
    const fullTip: FeatureTip = {
      id: featureId,
      ...tip,
    };
    
    this.showTip(fullTip);
    this.markIntroduced(featureId);
  }
  
  /**
   * Common feature introductions with smart triggers
   */
  checkCommonFeatures(context: {
    placementCount?: number;
    selectionCount?: number;
    entityCount?: number;
    hasScripts?: boolean;
  }): void {
    // Hotbar introduction after placing a few objects
    this.introduceWhenRelevant(
      'hotbar',
      () => (context.placementCount ?? 0) >= 5,
      {
        message: 'Tip: Use number keys (1-9) to quickly access your favorite assets from the hotbar',
        action: 'Got it',
        dismissable: true,
      }
    );
    
    // Focus camera after selecting same object multiple times
    this.introduceWhenRelevant(
      'focus-camera',
      () => (context.selectionCount ?? 0) >= 3,
      {
        message: 'Tip: Press F to focus the camera on selected object',
        action: 'Got it',
        dismissable: true,
      }
    );
    
    // Search feature when scene gets busy
    this.introduceWhenRelevant(
      'search',
      () => (context.entityCount ?? 0) >= 15,
      {
        message: 'Tip: Use Ctrl+K to quickly search and jump to any object in your scene',
        action: 'Try it',
        dismissable: true,
      }
    );
    
    // Visual scripting when user has scripts
    this.introduceWhenRelevant(
      'visual-scripting',
      () => context.hasScripts === true,
      {
        message: 'Tip: Try visual scripting for simple behaviors, or use code for complex logic',
        action: 'Learn more',
        dismissable: true,
      }
    );
  }
  
  /**
   * Shows a feature tip to the user
   */
  private showTip(tip: FeatureTip): void {
    Logger.debug(`FeatureIntroduction: ${tip.message}`);
    this.tipCallbacks.forEach(cb => cb(tip));
  }
  
  /**
   * Registers callback for feature tips
   */
  onTip(callback: (tip: FeatureTip) => void): () => void {
    this.tipCallbacks.add(callback);
    return () => this.tipCallbacks.delete(callback);
  }
  
  /**
   * Marks a feature as introduced
   */
  markIntroduced(featureId: string): void {
    this.introduced.add(featureId);
    this.persist();
  }
  
  /**
   * Checks if a feature has been introduced
   */
  isIntroduced(featureId: string): boolean {
    return this.introduced.has(featureId);
  }
  
  /**
   * Persists introduced features to storage
   */
  private persist(): void {
    try {
      const features = Array.from(this.introduced);
      storageSave(STORAGE_KEY, features);
    } catch (err) {
      Logger.warn('Failed to persist introduced features:', err as Error);
    }
  }
  
  /**
   * Loads introduced features from storage
   */
  private loadIntroducedFeatures(): void {
    try {
      const features = storageLoad<string[]>(STORAGE_KEY);
      if (features && Array.isArray(features)) {
        this.introduced = new Set(features);
      }
    } catch (err) {
      Logger.warn('Failed to load introduced features:', err as Error);
    }
  }
  
  /**
   * Resets all introductions (for testing or tutorial reset)
   */
  reset(): void {
    this.introduced.clear();
    this.persist();
  }
  
  /**
   * Disposes resources
   */
  dispose(): void {
    this.tipCallbacks.clear();
  }
}

