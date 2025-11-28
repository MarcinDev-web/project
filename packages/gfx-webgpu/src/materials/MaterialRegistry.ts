/**
 * MaterialRegistry - Central registry for material definitions
 * 
 * Provides a unified way to register, query, and validate materials.
 * Each material has a unique string ID and maps to an atlas index.
 */

import type { EventBus } from '@engine/core';

// ============================================================================
// Types
// ============================================================================

export type MaterialCategory = 
  | 'stone'
  | 'wood'
  | 'metal'
  | 'glass'
  | 'fabric'
  | 'organic'
  | 'decorative'
  | 'special'
  | 'custom';

export type MaterialStatus = 'pending' | 'loading' | 'ready' | 'error';

export interface MaterialTextures {
  /** Albedo/diffuse texture path or null for procedural */
  albedo: string | null;
  /** Normal map path */
  normal?: string;
  /** Roughness map path */
  roughness?: string;
  /** Metallic map path */
  metallic?: string;
  /** Ambient occlusion map path */
  ao?: string;
  /** Height/displacement map path */
  height?: string;
}

export interface MaterialProperties {
  /** Metallic factor (0-1) */
  metallic: number;
  /** Roughness factor (0-1) */
  roughness: number;
  /** Emissive color RGB */
  emissive?: [number, number, number];
  /** Emissive intensity */
  emissiveIntensity?: number;
  /** Default alpha mode */
  alphaMode?: 'opaque' | 'mask' | 'blend';
  /** Whether material is double-sided */
  doubleSided?: boolean;
}

export interface MaterialDefinition {
  /** Unique string identifier (e.g., "stone", "oak_planks") */
  id: string;
  /** Human-readable display name */
  displayName: string;
  /** Material category for organization */
  category: MaterialCategory;
  /** Index in the texture atlas (0-N) */
  atlasIndex: number;
  /** Texture paths */
  textures: MaterialTextures;
  /** PBR properties */
  properties: MaterialProperties;
  /** Current loading status */
  status: MaterialStatus;
  /** Error message if status is 'error' */
  error?: string;
  /** Optional tags for filtering */
  tags?: string[];
  /** Whether this is a procedurally generated material */
  isProcedural?: boolean;
}

export interface MaterialValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface MaterialRegistryEvents {
  'material:registered': { material: MaterialDefinition };
  'material:updated': { material: MaterialDefinition; changes: Partial<MaterialDefinition> };
  'material:removed': { id: string };
  'material:status-changed': { id: string; oldStatus: MaterialStatus; newStatus: MaterialStatus };
  'material:error': { id: string; error: string };
}

// ============================================================================
// MaterialRegistry
// ============================================================================

export class MaterialRegistry {
  private materials = new Map<string, MaterialDefinition>();
  private atlasIndexMap = new Map<number, string>(); // atlasIndex -> materialId
  private eventBus: EventBus | null = null;
  private nextAtlasIndex = 0;

  constructor(eventBus?: EventBus) {
    this.eventBus = eventBus ?? null;
  }

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  /**
   * Register a new material definition.
   * @throws Error if material ID already exists
   */
  register(definition: MaterialDefinition): void {
    if (this.materials.has(definition.id)) {
      throw new Error(`[MaterialRegistry] Material "${definition.id}" already registered`);
    }

    // Validate atlas index uniqueness
    if (this.atlasIndexMap.has(definition.atlasIndex)) {
      const existingId = this.atlasIndexMap.get(definition.atlasIndex);
      throw new Error(
        `[MaterialRegistry] Atlas index ${definition.atlasIndex} already used by "${existingId}"`
      );
    }

    // Store the material
    this.materials.set(definition.id, { ...definition });
    this.atlasIndexMap.set(definition.atlasIndex, definition.id);

    // Track highest atlas index
    if (definition.atlasIndex >= this.nextAtlasIndex) {
      this.nextAtlasIndex = definition.atlasIndex + 1;
    }

    this.emit('material:registered', { material: definition });
  }

  /**
   * Register multiple materials at once.
   */
  registerBatch(definitions: MaterialDefinition[]): void {
    for (const def of definitions) {
      this.register(def);
    }
  }

  /**
   * Unregister a material by ID.
   */
  unregister(id: string): boolean {
    const material = this.materials.get(id);
    if (!material) return false;

    this.materials.delete(id);
    this.atlasIndexMap.delete(material.atlasIndex);
    this.emit('material:removed', { id });

    return true;
  }

  /**
   * Get the next available atlas index.
   */
  getNextAtlasIndex(): number {
    return this.nextAtlasIndex;
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  /**
   * Get material by string ID.
   */
  get(id: string): MaterialDefinition | undefined {
    return this.materials.get(id);
  }

  /**
   * Get material by atlas index.
   */
  getByAtlasIndex(index: number): MaterialDefinition | undefined {
    const id = this.atlasIndexMap.get(index);
    if (!id) return undefined;
    return this.materials.get(id);
  }

  /**
   * Get all materials in a category.
   */
  getByCategory(category: MaterialCategory): MaterialDefinition[] {
    const results: MaterialDefinition[] = [];
    for (const material of this.materials.values()) {
      if (material.category === category) {
        results.push(material);
      }
    }
    return results;
  }

  /**
   * Get all materials with a specific tag.
   */
  getByTag(tag: string): MaterialDefinition[] {
    const results: MaterialDefinition[] = [];
    for (const material of this.materials.values()) {
      if (material.tags?.includes(tag)) {
        results.push(material);
      }
    }
    return results;
  }

  /**
   * Get all materials with a specific status.
   */
  getByStatus(status: MaterialStatus): MaterialDefinition[] {
    const results: MaterialDefinition[] = [];
    for (const material of this.materials.values()) {
      if (material.status === status) {
        results.push(material);
      }
    }
    return results;
  }

  /**
   * Check if a material ID exists.
   */
  has(id: string): boolean {
    return this.materials.has(id);
  }

  /**
   * Check if an atlas index is in use.
   */
  hasAtlasIndex(index: number): boolean {
    return this.atlasIndexMap.has(index);
  }

  /**
   * List all registered material IDs.
   */
  listIds(): string[] {
    return Array.from(this.materials.keys());
  }

  /**
   * List all registered materials.
   */
  listAll(): MaterialDefinition[] {
    return Array.from(this.materials.values());
  }

  /**
   * Get count of registered materials.
   */
  get count(): number {
    return this.materials.size;
  }

  /**
   * Get all unique categories in use.
   */
  getCategories(): MaterialCategory[] {
    const categories = new Set<MaterialCategory>();
    for (const material of this.materials.values()) {
      categories.add(material.category);
    }
    return Array.from(categories);
  }

  // -------------------------------------------------------------------------
  // Updates
  // -------------------------------------------------------------------------

  /**
   * Update a material's status.
   */
  setStatus(id: string, status: MaterialStatus, error?: string): void {
    const material = this.materials.get(id);
    if (!material) {
      console.warn(`[MaterialRegistry] Cannot set status: material "${id}" not found`);
      return;
    }

    const oldStatus = material.status;
    material.status = status;
    
    if (error !== undefined) {
      material.error = error;
    } else if (status !== 'error') {
      material.error = undefined;
    }

    this.emit('material:status-changed', { id, oldStatus, newStatus: status });

    if (status === 'error' && error) {
      this.emit('material:error', { id, error });
    }
  }

  /**
   * Update material properties.
   */
  update(id: string, changes: Partial<Omit<MaterialDefinition, 'id' | 'atlasIndex'>>): void {
    const material = this.materials.get(id);
    if (!material) {
      console.warn(`[MaterialRegistry] Cannot update: material "${id}" not found`);
      return;
    }

    // Apply changes (except id and atlasIndex which are immutable)
    Object.assign(material, changes);
    
    this.emit('material:updated', { material, changes });
  }

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  /**
   * Validate a material definition.
   */
  validate(id: string): MaterialValidationResult {
    const material = this.materials.get(id);
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!material) {
      return { valid: false, errors: [`Material "${id}" not found`], warnings: [] };
    }

    // Check required fields
    if (!material.displayName) {
      errors.push('Missing displayName');
    }

    if (material.atlasIndex < 0) {
      errors.push('atlasIndex must be >= 0');
    }

    // Check textures
    if (!material.isProcedural && !material.textures.albedo) {
      warnings.push('No albedo texture defined (will use fallback or procedural)');
    }

    // Check PBR properties
    if (material.properties.metallic < 0 || material.properties.metallic > 1) {
      errors.push('metallic must be between 0 and 1');
    }

    if (material.properties.roughness < 0 || material.properties.roughness > 1) {
      errors.push('roughness must be between 0 and 1');
    }

    // Check status
    if (material.status === 'error') {
      errors.push(`Material in error state: ${material.error || 'unknown error'}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate all registered materials.
   */
  validateAll(): Map<string, MaterialValidationResult> {
    const results = new Map<string, MaterialValidationResult>();
    for (const id of this.materials.keys()) {
      results.set(id, this.validate(id));
    }
    return results;
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  /**
   * Find materials matching a search query.
   */
  search(query: string): MaterialDefinition[] {
    const lowerQuery = query.toLowerCase();
    const results: MaterialDefinition[] = [];
    
    for (const material of this.materials.values()) {
      if (
        material.id.toLowerCase().includes(lowerQuery) ||
        material.displayName.toLowerCase().includes(lowerQuery) ||
        material.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
      ) {
        results.push(material);
      }
    }
    
    return results;
  }

  /**
   * Create a material definition with defaults.
   */
  static createDefinition(
    id: string,
    atlasIndex: number,
    overrides: Partial<MaterialDefinition> = {}
  ): MaterialDefinition {
    return {
      id,
      displayName: overrides.displayName ?? id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      category: overrides.category ?? 'custom',
      atlasIndex,
      textures: {
        albedo: null,
        ...overrides.textures,
      },
      properties: {
        metallic: 0,
        roughness: 1,
        ...overrides.properties,
      },
      status: 'pending',
      isProcedural: overrides.isProcedural ?? true,
      ...overrides,
    };
  }

  /**
   * Clear all registered materials.
   */
  clear(): void {
    const ids = Array.from(this.materials.keys());
    this.materials.clear();
    this.atlasIndexMap.clear();
    this.nextAtlasIndex = 0;

    for (const id of ids) {
      this.emit('material:removed', { id });
    }
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  private emit<K extends keyof MaterialRegistryEvents>(
    event: K,
    data: MaterialRegistryEvents[K]
  ): void {
    if (this.eventBus) {
      this.eventBus.emit(event, data);
    }
  }

  /**
   * Subscribe to registry events.
   */
  on<K extends keyof MaterialRegistryEvents>(
    event: K,
    handler: (data: MaterialRegistryEvents[K]) => void
  ): () => void {
    if (!this.eventBus) {
      console.warn('[MaterialRegistry] No event bus configured');
      return () => {};
    }
    this.eventBus.on(event, (data) => handler(data as MaterialRegistryEvents[K]));
    return () => this.eventBus?.off(event, handler as (data?: unknown) => void);
  }
}

