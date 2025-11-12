/**
 * ModelBuilderScene - Special scene for model building with blue room
 * 
 * Creates a closed square room with blue walls, good lighting, and orbit camera setup
 */

import { Scene, Entity, TransformComponent, MeshComponent, MaterialComponent, LightComponent, CameraComponent } from '@engine/world';
import { MicroBlockComponent } from '@engine/microblocks';
import { OrbitCameraComponent, OrbitCameraSystem } from '@engine/camera';
import type { ModelBuilder } from '@engine/blocks';
import type { Vec3 } from '@engine/core/math';
import { DisposableGroup } from '@engine/core';

/**
 * Configuration for ModelBuilderScene
 */
export interface ModelBuilderSceneConfig {
  /** Room size (default: 4 units) */
  roomSize?: number;
  /** Model position (default: center) */
  modelPosition?: Vec3;
  /** Camera distance from model (default: 3) */
  cameraDistance?: number;
  /** Logger for debugging */
  logger?: {
    debug: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (msg: string, error?: Error) => void;
  };
}

/**
 * ModelBuilderScene creates a blue room environment for model building
 */
export class ModelBuilderScene {
  private readonly scene: Scene;
  private readonly roomSize: number;
  private readonly modelPosition: Vec3;
  private readonly cameraDistance: number;
  private readonly logger: ModelBuilderSceneConfig['logger'];
  private readonly disposables = new DisposableGroup();

  private modelEntity: Entity | null = null;
  private cameraEntity: Entity | null = null;
  private cameraComponent: OrbitCameraComponent | null = null;
  private cameraSystem: OrbitCameraSystem | null = null;
  private roomEntities: Entity[] = [];

  constructor(config?: ModelBuilderSceneConfig) {
    this.roomSize = config?.roomSize ?? 4;
    this.modelPosition = config?.modelPosition ?? [0, 0, 0];
    this.cameraDistance = config?.cameraDistance ?? 3;
    this.logger = config?.logger ?? {
      debug: console.debug.bind(console),
      warn: console.warn.bind(console),
      error: (msg, err) => console.error(msg, err),
    };

    this.scene = new Scene('model-builder-scene');
    this.setupRoom();
    this.setupLighting();
    this.setupCamera();
  }

  /**
   * Gets the scene
   */
  getScene(): Scene {
    return this.scene;
  }

  /**
   * Gets the camera entity
   */
  getCameraEntity(): Entity | null {
    return this.cameraEntity;
  }

  /**
   * Gets the camera component
   */
  getCameraComponent(): OrbitCameraComponent | null {
    return this.cameraComponent;
  }

  /**
   * Gets the camera system
   */
  getCameraSystem(): OrbitCameraSystem | null {
    return this.cameraSystem;
  }

  /**
   * Gets the model entity
   */
  getModelEntity(): Entity | null {
    return this.modelEntity;
  }

  /**
   * Sets up the model entity with MicroBlockComponent
   */
  setupModel(builder: ModelBuilder): Entity {
    // Remove existing model entity if any
    if (this.modelEntity) {
      this.scene.removeEntity(this.modelEntity);
      this.modelEntity.dispose();
    }

    // Create new model entity
    const entity = new Entity('model-builder-model');
    entity.addComponent(new TransformComponent({ position: this.modelPosition }));

    // Add MicroBlockComponent with builder's store
    const store = builder.getStore();
    const component = new MicroBlockComponent({ store, chunkSize: store.chunkSize });
    entity.addComponent(component);

    // Add mesh component (will be updated by MicroBlockSystem)
    entity.addComponent(new MeshComponent());

    // Add material component
    const material = new MaterialComponent();
    material.primaryColor = [0.8, 0.8, 0.8, 1];
    material.roughness = 0.3;
    material.metallic = 0;
    entity.addComponent(material);

    this.scene.addEntity(entity);
    this.modelEntity = entity;

    // Update camera target
    if (this.cameraComponent) {
      this.cameraComponent.pivot = [...this.modelPosition];
    }

    return entity;
  }

  /**
   * Sets up the blue room (6 walls)
   */
  private setupRoom(): void {
    const halfSize = this.roomSize / 2;
    const wallThickness = 0.1;
    const blueColor: [number, number, number, number] = [0.4, 0.6, 0.9, 1]; // Light blue

    // Floor
    const floor = this.createWall(
      'floor',
      [0, -halfSize, 0],
      [this.roomSize, wallThickness, this.roomSize],
      blueColor
    );
    this.roomEntities.push(floor);

    // Ceiling
    const ceiling = this.createWall(
      'ceiling',
      [0, halfSize, 0],
      [this.roomSize, wallThickness, this.roomSize],
      blueColor
    );
    this.roomEntities.push(ceiling);

    // Front wall
    const frontWall = this.createWall(
      'front-wall',
      [0, 0, -halfSize],
      [this.roomSize, this.roomSize, wallThickness],
      blueColor
    );
    this.roomEntities.push(frontWall);

    // Back wall
    const backWall = this.createWall(
      'back-wall',
      [0, 0, halfSize],
      [this.roomSize, this.roomSize, wallThickness],
      blueColor
    );
    this.roomEntities.push(backWall);

    // Left wall
    const leftWall = this.createWall(
      'left-wall',
      [-halfSize, 0, 0],
      [wallThickness, this.roomSize, this.roomSize],
      blueColor
    );
    this.roomEntities.push(leftWall);

    // Right wall
    const rightWall = this.createWall(
      'right-wall',
      [halfSize, 0, 0],
      [wallThickness, this.roomSize, this.roomSize],
      blueColor
    );
    this.roomEntities.push(rightWall);
  }

  /**
   * Creates a wall entity
   */
  private createWall(
    name: string,
    position: Vec3,
    scale: Vec3,
    color: [number, number, number, number]
  ): Entity {
    const entity = new Entity(`room-${name}`);
    entity.addComponent(new TransformComponent({ position, scale }));

    const mesh = new MeshComponent();
    mesh.meshType = 'cube';
    entity.addComponent(mesh);

    const material = new MaterialComponent();
    material.primaryColor = color;
    material.roughness = 0.8;
    material.metallic = 0;
    entity.addComponent(material);

    this.scene.addEntity(entity);
    return entity;
  }

  /**
   * Sets up lighting (directional + point lights)
   */
  private setupLighting(): void {
    // Main directional light (from top)
    const directionalLight = new Entity('directional-light');
    directionalLight.addComponent(new TransformComponent({ position: [0, this.roomSize, 0] }));

    const dirLight = new LightComponent();
    dirLight.lightType = 'directional';
    dirLight.color = [1, 1, 1];
    dirLight.intensity = 1.2;
    dirLight.direction = [0, -1, 0];
    directionalLight.addComponent(dirLight);

    this.scene.addEntity(directionalLight);

    // Additional point light for better illumination
    const pointLight = new Entity('point-light');
    pointLight.addComponent(new TransformComponent({ position: [this.roomSize * 0.5, this.roomSize * 0.3, this.roomSize * 0.5] }));

    const ptLight = new LightComponent();
    ptLight.lightType = 'point';
    ptLight.color = [1, 1, 0.95];
    ptLight.intensity = 0.8;
    ptLight.range = this.roomSize * 1.5;
    pointLight.addComponent(ptLight);

    this.scene.addEntity(pointLight);

    // Ambient fill light (second point light)
    const fillLight = new Entity('fill-light');
    fillLight.addComponent(new TransformComponent({ position: [-this.roomSize * 0.5, this.roomSize * 0.3, -this.roomSize * 0.5] }));

    const fillLightComp = new LightComponent();
    fillLightComp.lightType = 'point';
    fillLightComp.color = [0.9, 0.95, 1];
    fillLightComp.intensity = 0.5;
    fillLightComp.range = this.roomSize * 1.5;
    fillLight.addComponent(fillLightComp);

    this.scene.addEntity(fillLight);
  }

  /**
   * Sets up orbit camera around the model
   */
  private setupCamera(): void {
    // Create camera entity
    this.cameraEntity = new Entity('model-builder-camera');
    this.cameraEntity.addComponent(new TransformComponent({ position: [0, 0, this.cameraDistance] }));

    // Add camera component
    const cameraComp = new CameraComponent();
    cameraComp.fov = 55;
    this.cameraEntity.addComponent(cameraComp);

    // Add orbit camera component
    this.cameraComponent = new OrbitCameraComponent({
      pivot: [...this.modelPosition],
      radius: this.cameraDistance,
      yaw: Math.PI / 4, // 45 degrees
      pitch: Math.PI / 3, // 60 degrees
      clamp: {
        radiusMin: 1,
        radiusMax: this.roomSize * 2,
        pitchMin: -Math.PI / 2 + 0.1,
        pitchMax: Math.PI / 2 - 0.1,
      },
    });
    this.cameraEntity.addComponent(this.cameraComponent);

    this.scene.addEntity(this.cameraEntity);

    // Create camera system
    this.cameraSystem = new OrbitCameraSystem(this.scene);
  }

  /**
   * Updates camera system (call each frame)
   */
  updateCamera(deltaTime: number): void {
    if (this.cameraSystem) {
      this.cameraSystem.update(deltaTime);
    }
  }

  /**
   * Disposes all resources
   */
  dispose(): void {
    this.disposables.dispose();
    
    if (this.modelEntity) {
      this.scene.removeEntity(this.modelEntity);
      this.modelEntity.dispose();
    }

    for (const entity of this.roomEntities) {
      this.scene.removeEntity(entity);
      entity.dispose();
    }
    this.roomEntities = [];

    // Note: Scene disposal is handled by caller
  }
}

