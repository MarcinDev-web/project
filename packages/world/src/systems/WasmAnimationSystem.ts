import { Scene } from '../core/Scene.js';
import { AnimatorComponent } from '../components/AnimatorComponent.js';
import { SkeletalBindingComponent } from '../components/SkeletalBindingComponent.js';
import { 
  initAnimationWasm, 
  AnimationWorld, 
  getOutputBufferView, 
  getInstanceLocalTransforms,
} from '@engine/wasm-animation';
import type { AnimationClip } from '@engine/animation';

// Map to track registered resources
const skeletonIds = new WeakMap<object, number>();
const clipIds = new WeakMap<object, number>();
let nextId = 1;

export class WasmAnimationSystem {
  private wasmWorld: AnimationWorld | null = null;
  private initialized = false;
  
  private entityIdMap = new Map<string, number>();
  private nextInstanceId = 1;
  
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
    this.initialize();
  }

  private async initialize() {
    try {
      this.wasmWorld = await initAnimationWasm();
      // We can access memory via the export helper or from the init return
      // But initAnimationWasm sets the internal memory ref in the package
      this.initialized = true;
      console.log('WASM Animation System Initialized');
    } catch (e) {
      console.error('Failed to init WASM Animation:', e);
    }
  }

  update(deltaSeconds: number): void {
    if (!this.initialized || !this.wasmWorld) return;

    const entities = this.scene.queryEntities(AnimatorComponent);
    
    // 1. Sync State
    for (const entity of entities) {
      const anim = entity.getComponent(AnimatorComponent);
      const skel = entity.getComponent(SkeletalBindingComponent);
      
      if (!anim || !skel || !skel.skeleton) continue;

      let instanceId = this.entityIdMap.get(entity.id);
      if (instanceId === undefined) {
          instanceId = this.nextInstanceId++;
          this.entityIdMap.set(entity.id, instanceId);
      }
      
      // Ensure Skeleton is registered
      let skelId = skeletonIds.get(skel.skeleton);
      if (skelId === undefined) {
        skelId = nextId++;
        skeletonIds.set(skel.skeleton, skelId);
        
        // Flatten IBM
        const ibm = skel.skeleton.inverseBindMatrices;
        // Assume ibm is Float32Array (length = bones * 16)
        
        // Convert parents to i32 array
        const parents = new Int32Array(skel.skeleton.parents);
        
        this.wasmWorld.add_skeleton(skelId, parents, ibm);
      }

      // Ensure Instance exists
      if (!this.hasInstance(instanceId)) {
         this.wasmWorld.create_instance(instanceId, skelId);
         this.markInstance(instanceId);
      }

      // Sync Clip
      if (anim.animator) {
        const currentClip = anim.animator.activeClip;
        const currentTime = anim.animator.activeTime;
        
        if (currentClip) {
            let cId = clipIds.get(currentClip);
            if (cId === undefined) {
                cId = nextId++;
                clipIds.set(currentClip, cId);
                this.registerClip(cId, currentClip);
            }
            
            this.wasmWorld.set_instance_state(instanceId, cId, currentTime);
        }
      }
    }

    // 2. Step Simulation
    this.wasmWorld.step(deltaSeconds);

    // 3. Output
    // Get the view into WASM memory (Zero Copy)
    // Note: This view is valid only until the next WASM memory allocation (growth).
    // Since we consume it immediately within this frame loop, it is safe.
    const outputView = getOutputBufferView(this.wasmWorld);
    
    // 4. Sync back to components
    // We iterate entities in the same deterministic order as Rust (sorted by ID)
    // This assumes Rust's `get_output_buffer` iterates sorted keys (which we implemented).
    
    const sortedEntities = entities.slice().sort((a, b) => {
        const idA = this.entityIdMap.get(a.id) || 0;
        const idB = this.entityIdMap.get(b.id) || 0;
        return idA - idB;
    });
    let offset = 0;
    
    for (const entity of sortedEntities) {
        const skel = entity.getComponent(SkeletalBindingComponent)!;
        const anim = entity.getComponent(AnimatorComponent);
        const instanceId = this.entityIdMap.get(entity.id);

        if (instanceId === undefined) continue;

        // Check if active instance (Rust only outputs active instances)
        // We should mirror "active" state. Assuming all queried entities are active.
        
        if (skel.skeleton) {
            const jointCount = skel.skeleton.jointCount;
            const len = jointCount * 16;
            
            if (offset + len <= outputView.length) {
                // Create a view (no copy)
                const instanceSlice = outputView.subarray(offset, offset + len);
                skel.jointPalette = instanceSlice;
                offset += len;
            }

            // Sync local transforms to pose if present (for attachments)
            if (anim && anim.pose) {
                const locals = getInstanceLocalTransforms(this.wasmWorld, instanceId);
                if (locals.translations && locals.rotations && locals.scales) {
                    // Copy from WASM view to JS array
                    if (anim.pose.localTranslations.length === locals.translations.length) {
                        anim.pose.localTranslations.set(locals.translations);
                    }
                    if (anim.pose.localRotations.length === locals.rotations.length) {
                        anim.pose.localRotations.set(locals.rotations);
                    }
                    if (anim.pose.localScales.length === locals.scales.length) {
                        anim.pose.localScales.set(locals.scales);
                    }
                }
            }
        }
    }
    
    // 5. Direct GPU Upload (Optional)
    // if (this.globalSkinningBuffer && this.renderer) {
    //    uploadToGPU(this.renderer.device, this.renderer.queue, this.globalSkinningBuffer, this.wasmWorld);
    // }
  }
  
  private instanceSet = new Set<number>();
  private hasInstance(id: number) { return this.instanceSet.has(id); }
  private markInstance(id: number) { this.instanceSet.add(id); }

  private registerClip(id: number, clip: AnimationClip) {
      if (!this.wasmWorld) return;
      
      // Flatten tracks
      const jointIndices: number[] = [];
      const trackTypes: number[] = [];
      const interpolations: number[] = [];
      const timesAll: number[] = [];
      const valuesAll: number[] = [];
      const timesCounts: number[] = [];

      for (const track of clip.tracks) {
          jointIndices.push(track.jointIndex);
          
          let type = 0; // T
          if (track.kind === 'rotation') type = 1;
          else if (track.kind === 'scale') type = 2;
          trackTypes.push(type);
          
          let interp = 0; // Step
          if (track.interpolation === 'linear') interp = 1;
          else if (track.interpolation === 'cubic') interp = 2;
          interpolations.push(interp);
          
          timesCounts.push(track.times.length);
          
          // Append data
          for (let i=0; i<track.times.length; i++) {
              timesAll.push(track.times[i]!);
          }
          for (let i=0; i<track.values.length; i++) {
              valuesAll.push(track.values[i]!);
          }
      }

      this.wasmWorld.add_clip(
          id,
          clip.duration,
          new Uint32Array(jointIndices),
          new Uint8Array(trackTypes),
          new Uint8Array(interpolations),
          new Float32Array(timesAll),
          new Float32Array(valuesAll),
          new Uint32Array(timesCounts)
      );
  }
}
