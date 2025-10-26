/**
 * EditorSearchManager - Manages entity search and filtering.
 * 
 * Responsibilities:
 * - Search entities by name
 * - Search by component type
 * - Search by tag/metadata
 * - Filter outliner results
 * - Highlight search results
 * 
 * Extracted from EditorUI to reduce complexity and improve maintainability.
 */

import type { Scene, Entity } from '@engine/world';
import type { SelectionManager } from '@engine/world';
import { Logger } from '../../utils/logger';

export interface SearchOptions {
  /** Case-sensitive search */
  caseSensitive?: boolean;
  /** Use regex for search */
  useRegex?: boolean;
  /** Search in component names */
  includeComponents?: boolean;
  /** Search in entity metadata */
  includeMetadata?: boolean;
  /** Limit number of results */
  maxResults?: number;
}

export interface SearchResult {
  entity: Entity;
  matchType: 'name' | 'component' | 'metadata' | 'tag';
  matchValue: string;
  score: number; // Relevance score (0-1)
}

export interface EditorSearchManagerConfig {
  scene: Scene;
  selection: SelectionManager;
  onSearchResults?: (results: SearchResult[]) => void;
  onStatusMessage?: (message: string, duration?: number) => void;
}

/**
 * Manages search and filtering of entities in the editor.
 */
export class EditorSearchManager {
  private currentQuery = '';
  private lastResults: SearchResult[] = [];

  constructor(private readonly config: EditorSearchManagerConfig) {}

  /**
   * Searches for entities matching the query.
   */
  search(query: string, options: SearchOptions = {}): SearchResult[] {
    this.currentQuery = query;

    // Empty query returns all entities
    if (!query || query.trim().length === 0) {
      this.lastResults = [];
      this.config.onSearchResults?.([]);
      return [];
    }

    const results: SearchResult[] = [];
    const searchTerm = options.caseSensitive ? query : query.toLowerCase();
    const maxResults = options.maxResults ?? 100;

    try {
      // Use regex if requested
      const regex = options.useRegex ? new RegExp(searchTerm, options.caseSensitive ? '' : 'i') : null;

      this.config.scene.traverse((entity) => {
        if (results.length >= maxResults) {
          return; // Stop if we've hit the limit
        }

        // Search in entity name
        const entityName = options.caseSensitive ? entity.name : entity.name.toLowerCase();
        if (regex ? regex.test(entityName) : entityName.includes(searchTerm)) {
          results.push({
            entity,
            matchType: 'name',
            matchValue: entity.name,
            score: this.calculateScore(entity.name, searchTerm),
          });
          return; // Don't check other match types for this entity
        }

        // Search in components
        if (options.includeComponents) {
          const components = this.getComponentNames(entity);
          for (const compName of components) {
            const compNameLower = options.caseSensitive ? compName : compName.toLowerCase();
            if (regex ? regex.test(compNameLower) : compNameLower.includes(searchTerm)) {
              results.push({
                entity,
                matchType: 'component',
                matchValue: compName,
                score: this.calculateScore(compName, searchTerm) * 0.8, // Lower priority than name
              });
              return;
            }
          }
        }

        // Search in metadata
        if (options.includeMetadata) {
          const metadataStr = this.getMetadataString(entity);
          const metadataLower = options.caseSensitive ? metadataStr : metadataStr.toLowerCase();
          if (regex ? regex.test(metadataLower) : metadataLower.includes(searchTerm)) {
            results.push({
              entity,
              matchType: 'metadata',
              matchValue: metadataStr,
              score: this.calculateScore(metadataStr, searchTerm) * 0.6, // Lowest priority
            });
          }
        }
      });

      // Sort by score (highest first)
      results.sort((a, b) => b.score - a.score);

      this.lastResults = results;
      this.config.onSearchResults?.(results);

      Logger.debug(`Search: "${query}" found ${results.length} entities`);
      this.config.onStatusMessage?.(
        `Found ${results.length} result${results.length === 1 ? '' : 's'}`,
        2000
      );

      return results;
    } catch (error) {
      Logger.error('Search failed:', error as Error);
      this.lastResults = [];
      this.config.onSearchResults?.([]);
      return [];
    }
  }

  /**
   * Quick search by name only (most common use case).
   */
  searchByName(query: string): SearchResult[] {
    return this.search(query, {
      caseSensitive: false,
      includeComponents: false,
      includeMetadata: false,
    });
  }

  /**
   * Gets the current search query.
   */
  getCurrentQuery(): string {
    return this.currentQuery;
  }

  /**
   * Gets the last search results.
   */
  getLastResults(): SearchResult[] {
    return [...this.lastResults];
  }

  /**
   * Selects the first search result.
   */
  selectFirstResult(): boolean {
    if (this.lastResults.length === 0) {
      return false;
    }

    const firstResult = this.lastResults[0]!;
    this.config.selection.select(firstResult.entity);
    Logger.debug(`Selected first search result: ${firstResult.entity.name}`);
    return true;
  }

  /**
   * Selects all search results.
   */
  selectAllResults(): void {
    if (this.lastResults.length === 0) {
      return;
    }

    // Select first as primary
    this.config.selection.select(this.lastResults[0]!.entity);

    // Add rest to selection
    for (let i = 1; i < this.lastResults.length; i++) {
      this.config.selection.addToSelection(this.lastResults[i]!.entity);
    }

    Logger.debug(`Selected all ${this.lastResults.length} search results`);
  }

  /**
   * Clears the current search.
   */
  clearSearch(): void {
    this.currentQuery = '';
    this.lastResults = [];
    this.config.onSearchResults?.([]);
    Logger.debug('Search cleared');
  }

  /**
   * Checks if there's an active search.
   */
  hasActiveSearch(): boolean {
    return this.currentQuery.length > 0;
  }

  // ========== Private Helpers ==========

  /**
   * Calculates relevance score for a match.
   * Score is between 0 and 1, with 1 being perfect match.
   */
  private calculateScore(text: string, query: string): number {
    const textLower = text.toLowerCase();
    const queryLower = query.toLowerCase();

    // Exact match
    if (textLower === queryLower) {
      return 1.0;
    }

    // Starts with query
    if (textLower.startsWith(queryLower)) {
      return 0.9;
    }

    // Contains query
    const index = textLower.indexOf(queryLower);
    if (index >= 0) {
      // Score based on position (earlier is better)
      return 0.8 - (index / textLower.length) * 0.3;
    }

    // Fuzzy match (for future implementation)
    // Could use Levenshtein distance or similar

    return 0.5; // Default score for any match
  }

  /**
   * Gets component names for an entity.
   */
  private getComponentNames(entity: Entity): string[] {
    const names: string[] = [];

    // Check for common components via userData flags
    if (entity.userData.isLight) {
      names.push('LightComponent');
    }
    if (entity.userData.isCamera) {
      names.push('CameraComponent');
    }
    if (entity.userData.hasPhysics) {
      names.push('PhysicsComponent');
    }

    // Check for component property if available
    // Note: Entity might not expose components directly
    // This is a limitation to work around
    const anyEntity = entity as any;
    if (anyEntity.components && Array.isArray(anyEntity.components)) {
      for (const comp of anyEntity.components) {
        const compName = comp.constructor?.name;
        if (compName && compName !== 'Object') {
          names.push(compName);
        }
      }
    }

    return names;
  }

  /**
   * Gets metadata as searchable string.
   */
  private getMetadataString(entity: Entity): string {
    const parts: string[] = [];

    // Entity ID
    parts.push(entity.id);

    // User data
    if (entity.userData.asset) {
      parts.push(String(entity.userData.asset));
    }

    // Mesh type
    if (entity.meshType) {
      parts.push(entity.meshType);
    }

    return parts.join(' ');
  }

  /**
   * Cleans up resources.
   */
  dispose(): void {
    this.clearSearch();
  }
}

