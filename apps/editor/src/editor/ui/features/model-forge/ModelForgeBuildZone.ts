/**
 * ModelForgeBuildZone - Visual overlay showing build zone boundaries
 * 
 * Renders a wireframe box and floor grid to indicate where models can be built
 */

import { Entity, MeshComponent, MaterialComponent } from '@engine/world';
import type { Scene } from '@engine/world';
import type { Vec3 } from '@engine/core/math';
import { DisposableGroup } from '@engine/core/utils';

export interface BuildZoneBounds {
  min: [number, number, number];
  max: [number, number, number];
  position: [number, number, number];
}

/**
 * Visualizes the model building zone in the scene
 */
export class ModelForgeBuildZone {
  private readonly scene: Scene;
  private readonly disposables = new DisposableGroup();
  
  private floorEntity: Entity | null = null;
  private wireframeEntities: Entity[] = [];
  private cornerEntities: Entity[] = [];
  private time = 0;
  private bounds: BuildZoneBounds;

  constructor(scene: Scene, bounds: BuildZoneBounds) {
    this.scene = scene;
    this.bounds = bounds;
  }

  /**
   * Shows the build zone visualization
   */
  show(): void {
    this.createFloorGrid();
    this.createWireframe();
    this.createCornerMarkers();
  }

  /**
   * Hides the build zone visualization
   */
  hide(): void {
    this.dispose();
  }

  /**
   * Updates bounds and recreates visualization
   */
  setBounds(bounds: BuildZoneBounds): void {
    this.bounds = bounds;
    this.hide();
    this.show();
  }

  /**
   * Creates the floor grid plane
   */
  private createFloorGrid(): void {
    const { min, max, position } = this.bounds;
    const sizeX = max[0] - min[0];
    const sizeZ = max[2] - min[2];

    this.floorEntity = new Entity('model-forge-floor');
    this.floorEntity.userData.isModelForgeHelper = true;

    // Position at center of bounds, at bottom
    this.floorEntity.transform.position = [
      position[0],
      position[1] + min[1] + 0.01, // Slightly above ground
      position[2],
    ] as Vec3;

    this.floorEntity.transform.scale = [sizeX, 1, sizeZ] as Vec3;

    const mesh = new MeshComponent();
    mesh.meshType = 'plane';
    this.floorEntity.addComponent(mesh);

    const material = new MaterialComponent();
    material.primaryColor = [0, 1, 0.53, 0.15]; // Semi-transparent green
    material.alphaMode = 'blend';
    this.floorEntity.addComponent(material);

    this.scene.addEntity(this.floorEntity);
  }

  /**
   * Creates wireframe edges of the build zone
   */
  private createWireframe(): void {
    const { min, max, position } = this.bounds;

    // Define the 12 edges of a cube
    const edges: Array<[[number, number, number], [number, number, number]]> = [
      // Bottom edges
      [[min[0], min[1], min[2]], [max[0], min[1], min[2]]],
      [[max[0], min[1], min[2]], [max[0], min[1], max[2]]],
      [[max[0], min[1], max[2]], [min[0], min[1], max[2]]],
      [[min[0], min[1], max[2]], [min[0], min[1], min[2]]],
      // Top edges
      [[min[0], max[1], min[2]], [max[0], max[1], min[2]]],
      [[max[0], max[1], min[2]], [max[0], max[1], max[2]]],
      [[max[0], max[1], max[2]], [min[0], max[1], max[2]]],
      [[min[0], max[1], max[2]], [min[0], max[1], min[2]]],
      // Vertical edges
      [[min[0], min[1], min[2]], [min[0], max[1], min[2]]],
      [[max[0], min[1], min[2]], [max[0], max[1], min[2]]],
      [[max[0], min[1], max[2]], [max[0], max[1], max[2]]],
      [[min[0], min[1], max[2]], [min[0], max[1], max[2]]],
    ];

    edges.forEach((edge, index) => {
      const [start, end] = edge;
      const entity = this.createEdgeLine(
        [start[0] + position[0], start[1] + position[1], start[2] + position[2]],
        [end[0] + position[0], end[1] + position[1], end[2] + position[2]],
        index
      );
      this.wireframeEntities.push(entity);
    });
  }

  /**
   * Creates a single edge line
   */
  private createEdgeLine(start: Vec3, end: Vec3, index: number): Entity {
    const entity = new Entity(`model-forge-edge-${index}`);
    entity.userData.isModelForgeHelper = true;

    // Calculate center position
    const centerX = (start[0] + end[0]) / 2;
    const centerY = (start[1] + end[1]) / 2;
    const centerZ = (start[2] + end[2]) / 2;

    // Calculate length
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const dz = end[2] - start[2];
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

    entity.transform.position = [centerX, centerY, centerZ] as Vec3;

    // Determine which axis this edge runs along
    const lineThickness = 0.03;
    if (Math.abs(dx) > 0.01) {
      entity.transform.scale = [length, lineThickness, lineThickness] as Vec3;
    } else if (Math.abs(dy) > 0.01) {
      entity.transform.scale = [lineThickness, length, lineThickness] as Vec3;
    } else {
      entity.transform.scale = [lineThickness, lineThickness, length] as Vec3;
    }

    const mesh = new MeshComponent();
    mesh.meshType = 'cube';
    entity.addComponent(mesh);

    const material = new MaterialComponent();
    material.primaryColor = [0, 1, 0.53, 0.6]; // Green, semi-transparent
    material.alphaMode = 'blend';
    entity.addComponent(material);

    this.scene.addEntity(entity);
    return entity;
  }

  /**
   * Creates corner marker spheres
   */
  private createCornerMarkers(): void {
    const { min, max, position } = this.bounds;

    // 8 corners of the cube
    const corners: [number, number, number][] = [
      [min[0], min[1], min[2]],
      [max[0], min[1], min[2]],
      [max[0], min[1], max[2]],
      [min[0], min[1], max[2]],
      [min[0], max[1], min[2]],
      [max[0], max[1], min[2]],
      [max[0], max[1], max[2]],
      [min[0], max[1], max[2]],
    ];

    corners.forEach((corner, index) => {
      const entity = new Entity(`model-forge-corner-${index}`);
      entity.userData.isModelForgeHelper = true;

      entity.transform.position = [
        corner[0] + position[0],
        corner[1] + position[1],
        corner[2] + position[2],
      ] as Vec3;

      entity.transform.scale = [0.1, 0.1, 0.1] as Vec3;

      const mesh = new MeshComponent();
      mesh.meshType = 'sphere';
      entity.addComponent(mesh);

      const material = new MaterialComponent();
      material.primaryColor = [0, 1, 0.53, 0.8]; // Green
      material.alphaMode = 'blend';
      entity.addComponent(material);

      this.scene.addEntity(entity);
      this.cornerEntities.push(entity);
    });
  }

  /**
   * Updates the visualization (call every frame)
   */
  update(deltaTime: number): void {
    this.time += deltaTime;

    // Pulse effect
    const pulse = 0.5 + Math.sin(this.time * 2) * 0.2;

    // Update wireframe opacity
    for (const entity of this.wireframeEntities) {
      const material = entity.getComponent(MaterialComponent);
      if (material) {
        material.opacity = pulse * 0.6;
      }
    }

    // Update corner markers
    for (const entity of this.cornerEntities) {
      const scale = 0.1 + Math.sin(this.time * 3) * 0.02;
      entity.transform.scale = [scale, scale, scale] as Vec3;
    }

    // Update floor opacity
    if (this.floorEntity) {
      const material = this.floorEntity.getComponent(MaterialComponent);
      if (material) {
        material.opacity = 0.1 + Math.sin(this.time * 2) * 0.05;
      }
    }
  }

  /**
   * Gets the current bounds
   */
  getBounds(): BuildZoneBounds {
    return this.bounds;
  }

  /**
   * Checks if a position is within bounds
   */
  isWithinBounds(pos: Vec3): boolean {
    const { min, max, position } = this.bounds;
    const localX = pos[0] - position[0];
    const localY = pos[1] - position[1];
    const localZ = pos[2] - position[2];

    return (
      localX >= min[0] && localX <= max[0] &&
      localY >= min[1] && localY <= max[1] &&
      localZ >= min[2] && localZ <= max[2]
    );
  }

  /**
   * Cleans up all visualizations
   */
  dispose(): void {
    if (this.floorEntity) {
      this.scene.removeEntity(this.floorEntity);
      this.floorEntity = null;
    }

    for (const entity of this.wireframeEntities) {
      this.scene.removeEntity(entity);
    }
    this.wireframeEntities = [];

    for (const entity of this.cornerEntities) {
      this.scene.removeEntity(entity);
    }
    this.cornerEntities = [];

    this.disposables.dispose();
  }
}

