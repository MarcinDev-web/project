/**
 * LogicCubeLibrary - Registry and factory for logic cube types.
 * Similar to BlockLibrary but for logic cubes.
 */

import { Entity } from '@engine/world';
import { Scene } from '@engine/world';
import { LogicCubeComponent } from '@engine/world/components/LogicCubeComponent';
import type { LogicCubeMetadata, LogicCubeCategory } from '@engine/script/cubes/types';
import { LogicCubeRegistry } from '@engine/script';

/**
 * Logic cube library entry
 */
export interface LogicCubeEntry {
  metadata: LogicCubeMetadata;
  /** Factory function to create entity with this cube type */
  createEntity: (scene: Scene) => Entity;
}

/**
 * Manages the library of available logic cube types
 */
export class LogicCubeLibrary {
  private static entries = new Map<string, LogicCubeEntry>();

  /**
   * Registers a logic cube type in the library
   */
  static register(metadata: LogicCubeMetadata): void {
    const entry: LogicCubeEntry = {
      metadata,
      createEntity: (scene: Scene) => {
        return LogicCubeLibrary.createLogicCubeEntity(scene, metadata);
      },
    };
    this.entries.set(metadata.type, entry);
  }

  /**
   * Gets a logic cube entry by type
   */
  static get(type: string): LogicCubeEntry | undefined {
    return this.entries.get(type);
  }

  /**
   * Gets all logic cube entries
   */
  static getAll(): LogicCubeEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Gets logic cubes by category
   */
  static getByCategory(category: LogicCubeCategory): LogicCubeEntry[] {
    return Array.from(this.entries.values()).filter(
      (entry) => entry.metadata.category === category
    );
  }

  /**
   * Gets all categories
   */
  static getCategories(): LogicCubeCategory[] {
    const discovered = new Set<string>();
    for (const entry of this.entries.values()) {
      const category = entry.metadata.category;
      if (category) discovered.add(category);
    }

    // Fallback to defaults if nothing registered yet
    const defaultOrder: LogicCubeCategory[] = ['trigger', 'action', 'condition', 'data', 'logic'];
    if (discovered.size === 0) return defaultOrder;

    const presentDefaults = defaultOrder.filter((cat) => discovered.has(cat));
    const custom = Array.from(discovered).filter((cat) => !defaultOrder.includes(cat as LogicCubeCategory)).sort();
    return [...presentDefaults, ...custom] as LogicCubeCategory[];
  }

  /**
   * Creates a logic cube entity
   */
  private static createLogicCubeEntity(scene: Scene, metadata: LogicCubeMetadata): Entity {
    const entity = new Entity(metadata.displayName);

    // Set default position
    entity.transform.position = [0, 1, 0];

    // Set visual appearance based on category
    const color = metadata.color ?? this.getCategoryColor(metadata.category);
    entity.color = [...color, 1] as [number, number, number, number];

    // Use cube mesh
    entity.meshType = 'cube';

    // Add LogicCubeComponent
    const component = new LogicCubeComponent();
    component.setCubeType(metadata.type);

    // Set default config from parameters
    const defaultConfig: Record<string, unknown> = {};
    for (const param of metadata.parameters) {
      defaultConfig[param.key] = param.defaultValue;
    }
    component.setConfig(defaultConfig);

    entity.addComponent(component);

    // Attach to provided scene to match API expectation
    scene.addEntity(entity);
    return entity;
  }

  /**
   * Gets default color for a category
   */
  private static getCategoryColor(category: LogicCubeCategory): [number, number, number] {
    switch (category) {
      case 'trigger':
        return [1, 0.8, 0.2]; // Yellow
      case 'action':
        return [0.8, 0.4, 1]; // Purple
      case 'condition':
        return [1, 1, 0.3]; // Yellow
      case 'data':
        return [0.3, 0.8, 1]; // Blue
      case 'logic':
        return [0.7, 0.7, 1]; // Light purple
      default:
        return [0.5, 0.5, 0.5]; // Gray
    }
  }

  /**
   * Initializes the library with all registered cube types
   */
  static initialize(): void {
    // Get all registered cube types
    const types = LogicCubeRegistry.list();

    for (const type of types) {
      const ctor = LogicCubeRegistry.get(type);
      if (!ctor) continue;

      try {
        // Create a temporary instance to get metadata
        const dummyEntity = new Entity('temp');
        const dummyScene = new (class extends Scene {
          constructor() {
            super('temp');
          }
        })();

        const instance = new ctor(dummyEntity, dummyScene);
        const metadata = instance.getMetadata();

        this.register(metadata);
      } catch (error) {
        console.warn(`Failed to register logic cube type: ${type}`, error);
      }
    }
  }

  /**
   * Clears the library
   */
  static clear(): void {
    this.entries.clear();
  }
}

