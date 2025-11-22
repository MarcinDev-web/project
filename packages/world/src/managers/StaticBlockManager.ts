import { Scene } from '../core/Scene.js';
import { Entity } from '../core/Entity.js';
import { InstancedMeshComponent } from '../components/InstancedMeshComponent.js';
import { PhysicsComponent, RigidbodyType } from '../components/PhysicsComponent.js';
import type { MeshKind } from '../components/MeshComponent.js';
import { MaterialComponent } from '../components/MaterialComponent.js';
import type { Vec3 } from '@engine/core/math';

export interface BlockInstanceDef {
  assetName: string;
  position: Vec3;
  rotation: [number, number, number, number];
  scale: Vec3;
  meshType?: MeshKind;
  color?: [number, number, number, number];
  materialId?: number;
  blockId?: string;
}

export class StaticBlockManager {
  private scene: Scene;
  
  // Map AssetName -> Entity with InstancedMeshComponent
  private visualEntities = new Map<string, Entity>();
  
  // Map ChunkKey "x,y,z" -> Entity with PhysicsComponent
  private chunkEntities = new Map<string, Entity>();
  
  private chunkSize = 16;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Adds a static block instance.
   */
  addBlock(def: BlockInstanceDef): void {
    this.updateVisuals(def);
    this.updatePhysics(def);
  }

  private updateVisuals(def: BlockInstanceDef) {
    const key = def.assetName;
    let visualEntity = this.visualEntities.get(key);
    
    if (!visualEntity) {
      visualEntity = new Entity(`Instanced_${key}`);
      // Ensure it's persistent/static
      visualEntity.userData.isInstancedContainer = true;
      
      const imc = new InstancedMeshComponent(1024);
      imc.meshType = def.meshType || 'cube';
      visualEntity.addComponent(imc);
      
      // Add material component to define base material properties
      const mat = new MaterialComponent();
      mat.materialId = def.materialId || 0;
      visualEntity.addComponent(mat);
      
      this.scene.addEntity(visualEntity);
      this.visualEntities.set(key, visualEntity);
    }
    
    const imc = visualEntity.getComponent(InstancedMeshComponent);
    if (imc) {
      imc.addInstance(def.position, def.rotation, def.scale, def.color);
    }
  }

  private updatePhysics(def: BlockInstanceDef) {
    // Simple spatial hashing
    const cx = Math.floor(def.position[0] / this.chunkSize);
    const cy = Math.floor(def.position[1] / this.chunkSize);
    const cz = Math.floor(def.position[2] / this.chunkSize);
    const chunkKey = `${cx},${cy},${cz}`;
    
    let chunkEntity = this.chunkEntities.get(chunkKey);
    if (!chunkEntity) {
      chunkEntity = new Entity(`Chunk_${chunkKey}`);
      // Center of chunk could be the position, but simpler to use origin (0,0,0) world space 
      // and have PhysicsComponent handle it?
      // If Rigidbody is Static, transform position matters.
      // Let's place chunk entity at (cx*size, cy*size, cz*size)
      chunkEntity.transform.position = [cx * this.chunkSize, cy * this.chunkSize, cz * this.chunkSize];
      
      const phys = new PhysicsComponent();
      phys.rigidbodyType = RigidbodyType.Static;
      chunkEntity.addComponent(phys);
      
      this.scene.addEntity(chunkEntity);
      this.chunkEntities.set(chunkKey, chunkEntity);
    }
    
    const phys = chunkEntity.getComponent(PhysicsComponent);
    if (phys) {
      // Calculate relative position
      const relX = def.position[0] - chunkEntity.transform.position[0];
      const relY = def.position[1] - chunkEntity.transform.position[1];
      const relZ = def.position[2] - chunkEntity.transform.position[2];
      
      // Add collider
      // Note: Assuming axis-aligned for now.
      if (def.meshType === 'sphere') {
        phys.addSphereCollider(def.scale[0], [relX, relY, relZ]);
      } else {
        // Default to box
        phys.addBoxCollider(def.scale, [relX, relY, relZ]);
      }
      
      // Force physics system to rebuild body
      phys._rapierId = -1;
    }
  }

  /**
   * Optimizes chunks by merging colliders (greedy meshing) and potentially visual meshes.
   */
  optimize(): void {
    // Placeholder for greedy meshing
  }
  
  clear(): void {
      // Remove all entities
      for (const entity of this.visualEntities.values()) {
          this.scene.removeEntity(entity);
      }
      this.visualEntities.clear();
      
      for (const entity of this.chunkEntities.values()) {
          this.scene.removeEntity(entity);
      }
      this.chunkEntities.clear();
  }
}

