/**
 * Benchmark Scene Generator
 * 
 * Creates test scenes with many instances for performance testing.
 * Used to establish baselines and measure improvements.
 */

import type { Scene } from '@engine/world';
import { Entity, CameraComponent } from '@engine/world';
import { MeshComponent, MaterialComponent } from '@engine/world';
import type { Vec3 } from '@engine/core/math';

export interface BenchmarkConfig {
  /** Total number of instances to create */
  instanceCount: number;
  /** Distribution pattern: 'grid', 'random', 'spiral' */
  pattern?: 'grid' | 'random' | 'spiral';
  /** Grid dimensions (only for 'grid' pattern) */
  gridSize?: { x: number; y: number; z: number };
  /** Spacing between instances */
  spacing?: number;
  /** Random seed for 'random' pattern */
  seed?: number;
}

/**
 * Generates a benchmark scene with many instances.
 * 
 * @param scene - Scene to populate
 * @param config - Benchmark configuration
 * @returns Statistics about the generated scene
 */
export function generateBenchmarkScene(
  scene: Scene,
  config: BenchmarkConfig
): { entityCount: number; instanceCount: number } {
  const pattern = config.pattern ?? 'grid';
  const spacing = config.spacing ?? 1.0;
  const instanceCount = config.instanceCount;

  // Clear existing entities (except camera)
  const entitiesToRemove = scene
    .getAllEntities()
    .filter((e) => !e.getComponent(CameraComponent));
  for (const entity of entitiesToRemove) {
    scene.removeEntity(entity);
  }

  const positions: Vec3[] = [];

  // Generate positions based on pattern
  if (pattern === 'grid') {
    const gridSize = config.gridSize ?? calculateGridSize(instanceCount);
    const total = gridSize.x * gridSize.y * gridSize.z;
    const actualCount = Math.min(instanceCount, total);

    for (let i = 0; i < actualCount; i++) {
      const x = i % gridSize.x;
      const y = Math.floor(i / gridSize.x) % gridSize.y;
      const z = Math.floor(i / (gridSize.x * gridSize.y));

      positions.push([
        (x - gridSize.x / 2) * spacing,
        y * spacing,
        (z - gridSize.z / 2) * spacing,
      ]);
    }
  } else if (pattern === 'spiral') {
    const layers = Math.ceil(Math.cbrt(instanceCount));
    const perLayer = Math.ceil(instanceCount / layers);
    let count = 0;

    for (let layer = 0; layer < layers && count < instanceCount; layer++) {
      const layerRadius = (layer + 1) * spacing * 0.5;
      const angleStep = (2 * Math.PI) / Math.max(1, Math.floor(Math.sqrt(perLayer)));
      const radiusStep = layerRadius / Math.max(1, Math.floor(Math.sqrt(perLayer)));

      for (let i = 0; i < perLayer && count < instanceCount; i++) {
        const angle = i * angleStep;
        const radius = (i % Math.floor(Math.sqrt(perLayer))) * radiusStep;
        positions.push([
          Math.cos(angle) * radius,
          layer * spacing,
          Math.sin(angle) * radius,
        ]);
        count++;
      }
    }
  } else {
    // Random pattern
    const seed = config.seed ?? 12345;
    const rng = seededRandom(seed);
    const bounds = Math.cbrt(instanceCount) * spacing * 0.5;

    for (let i = 0; i < instanceCount; i++) {
      positions.push([
        (rng() - 0.5) * bounds * 2,
        (rng() - 0.5) * bounds * 2,
        (rng() - 0.5) * bounds * 2,
      ]);
    }
  }

  // Create entities
  let entityCount = 0;
  for (const pos of positions) {
    const entity = scene.createEntity(`BenchmarkInstance_${entityCount}`);
    entity.transform.setPosition(pos);

    // Add mesh component (cube by default)
    const mesh = new MeshComponent();
    mesh.meshType = 'cube';
    entity.addComponent(mesh);

    // Add material component with random colors for visual variety
    const material = new MaterialComponent();
    material.primaryColor = [
      Math.random() * 0.5 + 0.5,
      Math.random() * 0.5 + 0.5,
      Math.random() * 0.5 + 0.5,
      1.0,
    ];
    entity.addComponent(material);

    entityCount++;
  }

  return { entityCount, instanceCount: positions.length };
}

/**
 * Calculates optimal grid dimensions for a given instance count.
 */
function calculateGridSize(instanceCount: number): { x: number; y: number; z: number } {
  const size = Math.ceil(Math.cbrt(instanceCount));
  return { x: size, y: size, z: size };
}

/**
 * Simple seeded random number generator.
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

