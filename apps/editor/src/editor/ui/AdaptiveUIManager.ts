/**
 * AdaptiveUIManager - Context-aware UI adaptation system
 * 
 * Intelligently suggests UI changes based on user actions,
 * but never forces changes. Users stay in control.
 */

import type { Entity } from '@engine/world';
import type { EditorState } from '../core/state';
import { Logger } from '../../utils/logger';

export type SuggestionChannel = 'panel' | 'feature';

export interface AdaptiveSuggestion {
  id: string;
  channel: SuggestionChannel;
  payload: Record<string, unknown>;
  priority: 'low' | 'medium' | 'high';
  reason: string;
}

export interface AdaptiveContextMetrics {
  placementCount: number;
  selectionCount: number;
  scriptEditCount: number;
  logicUsageCount: number;
  lastSuggestionDismissals: Record<string, number>;
}

export class AdaptiveUIManager {
  private suggestedPanels = new Set<string>();
  private suggestionCallbacks = new Set<(suggestion: AdaptiveSuggestion) => void>();
  private context: AdaptiveContextMetrics;
  private readonly STORAGE_KEY = 'editor:adaptiveMetrics';

  constructor() {
    this.context = this.restoreMetrics();
  }
  
  /**
   * Analyzes context and suggests UI adaptations
   */
  adaptToContext(entity: Entity | null, _state: EditorState): void {
    if (!entity) {
      return;
    }
    
    this.trackSelection();
    this.persistMetrics();
  }
  
  /**
   * Suggests panel visibility based on user action
   */
  suggestPanel(panel: keyof EditorState['uiPreferences']['value'], reason: string, priority: 'low' | 'medium' | 'high' = 'medium'): void {
    const suggestion: AdaptiveSuggestion = {
      id: `panel:${String(panel)}`,
      channel: 'panel',
      payload: { panel },
      priority,
      reason,
    };
    this.suggestionCallbacks.forEach(cb => cb(suggestion));
    Logger.debug(`AdaptiveUI: Suggesting ${String(panel)} - ${reason}`);
  }
  
  /**
   * Registers callback for panel suggestions
   */
  onSuggestion(callback: (suggestion: AdaptiveSuggestion) => void): () => void {
    this.suggestionCallbacks.add(callback);
    return () => this.suggestionCallbacks.delete(callback);
  }
  
  getContext(): AdaptiveContextMetrics {
    return { ...this.context };
  }

  /**
   * Checks if this is user's first time placing objects
   */
  isFirstTimePlacing(): boolean {
    // Check localStorage for placement count
    try {
      const count = localStorage.getItem('editor:placementCount');
      return !count || parseInt(count, 10) < 3;
    } catch {
      return true;
    }
  }
  
  /**
   * Tracks that user has placed an object
   */
  trackPlacement(): void {
    try {
      const count = parseInt(localStorage.getItem('editor:placementCount') || '0', 10);
      localStorage.setItem('editor:placementCount', String(count + 1));
      this.context.placementCount = count + 1;
      this.persistMetrics();
    } catch {
      // Ignore storage errors
    }
  }
  
  /**
   * Resets adaptation state (for testing or reset scenarios)
   */
  reset(): void {
    this.suggestedPanels.clear();
    this.context = this.createDefaultMetrics();
    this.persistMetrics();
  }
  
  /**
   * Disposes resources
   */
  dispose(): void {
    this.suggestionCallbacks.clear();
    this.suggestedPanels.clear();
    this.context = this.createDefaultMetrics();
  }

  private createDefaultMetrics(): AdaptiveContextMetrics {
    return {
      placementCount: 0,
      selectionCount: 0,
      scriptEditCount: 0,
      logicUsageCount: 0,
      lastSuggestionDismissals: {},
    };
  }

  private restoreMetrics(): AdaptiveContextMetrics {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) {
        return this.createDefaultMetrics();
      }
      const parsed = JSON.parse(raw) as Partial<AdaptiveContextMetrics>;
      return {
        ...this.createDefaultMetrics(),
        ...parsed,
        lastSuggestionDismissals: parsed.lastSuggestionDismissals ?? {},
      };
    } catch (error) {
      Logger.warn('AdaptiveUI: Failed to restore metrics', error as Error);
      return this.createDefaultMetrics();
    }
  }

  private persistMetrics(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.context));
    } catch (error) {
      Logger.warn('AdaptiveUI: Failed to persist metrics', error as Error);
    }
  }

  private trackSelection(): void {
    this.context.selectionCount += 1;
  }
}

