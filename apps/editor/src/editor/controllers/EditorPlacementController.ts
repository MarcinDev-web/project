import type { OrbitControls, CameraDirector } from '@engine/camera';
import type { Scene, Entity, Ray } from '@engine/world';
import { CameraComponent, TerrainComponent } from '@engine/world';
import type { SelectionManager } from '@engine/world';
import type { EditorState } from '../core/state';
import type { PlacementMode } from '../placement/PlacementMode';
import { Raycaster } from '@engine/world';
import type { Vec3, Mat4 } from '@engine/core/math';
import { CollisionDetector } from '../placement/CollisionDetector';
import { mat4Invert, normalizeVec3Out, dotVec3 } from '@engine/core/math';
import { Logger } from '../../utils/logger';
import type { GridRenderer } from '../grid/GridRenderer';
import type { InteractionTool } from '../input/InteractionTypes';

export interface EditorPlacementControllerConfig {
  canvas: HTMLCanvasElement;
  controls: OrbitControls;
  /** Active camera director (preferred for view/projection) */
  cameraDirector?: CameraDirector;
  scene: Scene;
  selection: SelectionManager;
  state: EditorState;
  placementMode: PlacementMode;
  updateSceneBuffers: () => void;
  recordSnapshot: (description: string) => void;
  onStatusMessage?: (message: string, duration?: number) => void;
  getGridRenderer?: () => GridRenderer | null;
}

/**
 * Manages placement mode interactions and raycasting.
 */
export class EditorPlacementController implements InteractionTool {
  public readonly name = 'EditorPlacementController';
  private raycaster: Raycaster;
  
  /** Helper for OBB math (reuses CollisionDetector's OBB helpers) */
  private obbHelper: CollisionDetector;
  
  private rafId: number | null = null;
  private pendingRay: Ray | null = null;
  private abortController: AbortController | null = null;

  constructor(private readonly config: EditorPlacementControllerConfig) {
    this.raycaster = new Raycaster();
    this.obbHelper = new CollisionDetector(this.config.scene);
  }

  public checkHit(_ray: Ray): boolean {
    // If placement mode is active, we want to handle interactions (unless gizmo claimed it)
    // We also handle hover updates via onPointerMove even if we don't "claim" a drag yet,
    // but the Manager prioritization handles that.
    return this.config.placementMode.isActive();
  }

  public onPointerDown(_event: PointerEvent, ray: Ray): void {
    if (!this.config.placementMode.isActive()) return;
    
    const action = this.config.placementMode.handleInput('down', ray);
    if (action === 'confirm') {
      void this.performPlacement(ray);
    }
  }

  public onPointerMove(_event: PointerEvent, ray: Ray): void {
    if (!this.config.placementMode.isActive()) {
        this.config.getGridRenderer?.()?.setHighlight(null);
        return;
    }

    // Throttle updates using RAF
    this.pendingRay = ray;
    
    if (this.rafId === null) {
        this.rafId = requestAnimationFrame(() => {
            this.updatePreview();
            this.rafId = null;
        });
    }
  }

  public onPointerUp(_event: PointerEvent, ray: Ray): void {
    if (!this.config.placementMode.isActive()) return;

    const action = this.config.placementMode.handleInput('up', ray);
    if (action === 'confirm') {
        void this.performPlacement(ray);
    }
  }

  public cancel(): void {
    if (this.config.placementMode.isActive()) {
      try {
        this.config.placementMode.cancelPlacement();
        this.config.state.placementMode.value = false;
        this.config.onStatusMessage?.('Placement cancelled', 500);
      } catch {}
    }
    this.config.getGridRenderer?.()?.setHighlight(null);
  }

  private updatePreview(): void {
      if (!this.pendingRay || !this.config.placementMode.isActive()) {
           this.config.getGridRenderer?.()?.setHighlight(null);
           return;
      }
      
      const ray = this.pendingRay;

      // Notify tool of move
      this.config.placementMode.handleInput('move', ray);

      // Check for Global Grid Snap mode
      const isGridSnap = this.config.state.snapConfig.value.enabled;
      const gridRenderer = this.config.getGridRenderer?.();

      // Try adjacent placement first
      const adjacent = !isGridSnap ? this.getAdjacentPlacementFromRay(ray) : null;

      if (adjacent) {
        gridRenderer?.setHighlight(null); 
        const exclude = this.getLastRaycastEntity(ray);
        const ignoreEntities = this.getIgnoreEntities(ray);

        const options = {
          ignoreEntities: ignoreEntities,
          applySnap: false,
          surfaceNormal: adjacent.normal,
          targetEntity: exclude || undefined
        };
        
        void this.config.placementMode.updatePreviewPosition(adjacent.position, options);
        return;
      }

      // Fall back to ground plane
      const groundIntersection = this.raycastToGroundPlane(ray);
      if (groundIntersection) {
         if (gridRenderer && this.config.state.showGrid.value) {
           const cellSize = this.config.state.gridConfig.value.cellSize;
           const snappedX = Math.floor(groundIntersection[0] / cellSize) * cellSize + cellSize / 2;
           const snappedZ = Math.floor(groundIntersection[2] / cellSize) * cellSize + cellSize / 2;
           const gridHeight = this.config.state.gridConfig.value.height;
           gridRenderer.setHighlight([snappedX, gridHeight, snappedZ]);
         }

         let targetPos = groundIntersection;
         let shouldSnap = true; 

         if (isGridSnap) {
           const cellSize = this.config.state.gridConfig.value.cellSize;
           const snap = (val: number) => Math.round(val / cellSize) * cellSize;
           targetPos = [
             snap(groundIntersection[0]),
             snap(groundIntersection[1]),
             snap(groundIntersection[2])
           ];
           shouldSnap = false;
         }
         
         const ignoreEntities = this.getIgnoreEntities(ray);

        void this.config.placementMode.updatePreviewPosition(targetPos, {
          applySnap: shouldSnap,
          surfaceNormal: [0, 1, 0],
          ignoreEntities: ignoreEntities
        });
        return;
      }
      
      gridRenderer?.setHighlight(null);
  }

  private async performPlacement(ray: Ray): Promise<void> {
        // Update position one last time before confirming
        const isGridSnap = this.config.state.snapConfig.value.enabled;
        const adjacent = !isGridSnap ? this.getAdjacentPlacementFromRay(ray) : null;
        
        if (adjacent) {
          const exclude = this.getLastRaycastEntity(ray);
          const ignoreEntities = this.getIgnoreEntities(ray);
          
          const options = {
            ignoreEntities: ignoreEntities,
            applySnap: false,
            surfaceNormal: adjacent.normal,
            targetEntity: exclude || undefined
          };
          
          await this.config.placementMode.updatePreviewPosition(adjacent.position, options);
        } else {
          const groundIntersection = this.raycastToGroundPlane(ray);
          if (groundIntersection) {
             let targetPos = groundIntersection;
             let shouldSnap = true;

             if (isGridSnap) {
               const cellSize = this.config.state.gridConfig.value.cellSize;
               const snap = (val: number) => Math.round(val / cellSize) * cellSize;
               targetPos = [
                 snap(groundIntersection[0]),
                 snap(groundIntersection[1]),
                 snap(groundIntersection[2])
               ];
               shouldSnap = false;
             }
              
            const ignoreEntities = this.getIgnoreEntities(ray);
            await this.config.placementMode.updatePreviewPosition(targetPos, {
               applySnap: shouldSnap,
               surfaceNormal: [0, 1, 0],
               ignoreEntities: ignoreEntities
            });
          }
        }

        const placed = this.config.placementMode.confirmPlacement();
        
        if (placed) {
          const entities = Array.isArray(placed) ? placed : [placed];
          
          if (entities.length > 0) {
              this.config.selection.selectMultiple(entities);
          }
          
          this.config.updateSceneBuffers();
          
          if (!this.config.state.easyPlaceMode.value) {
            setTimeout(() => {
              if (!this.config.placementMode.isActive()) {
                this.config.state.placementMode.value = false;
              }
            }, 50);
          }
          
          const count = entities.length > 0 ? entities.length : 1; 
          this.config.recordSnapshot(count > 1 ? `Place ${count} objects` : 'Place object');
          try {
            this.config.state?.adaptiveUI?.trackPlacement?.();
          } catch {}
          this.config.onStatusMessage?.(count > 1 ? `${count} objects placed!` : 'Object placed!', 1000);
          Logger.debug(`Placed ${count} entities`);
        } else {
          this.config.onStatusMessage?.('Cannot place here (collision/invalid)', 1000);
          Logger.debug('Placement failed: collision detected or invalid state');
        }
  }
  
  private getIgnoreEntities(ray: { origin: Vec3; direction: Vec3 }): Entity[] {
      const previews = this.config.placementMode.getPreviewEntities();
      const hitEntity = this.getLastRaycastEntity(ray);
      
      const list = [...previews];
      if (hitEntity) list.push(hitEntity);
      
      return list.length > 0 ? list : [];
  }

  private getAdjacentPlacementFromRay(ray: { origin: Vec3; direction: Vec3 }): { position: Vec3; normal: Vec3 } | null {
    const previews = this.config.placementMode.getPreviewEntities();

    // Exclude preview entities from raycast
    const entities = this.config.scene
      .getActiveEntities()
      .filter((e) => !previews.includes(e) && !e.userData.isPreview && !e.getComponent(CameraComponent));

    if (entities.length === 0) return null;

    let hit = this.raycaster.raycastClosest(ray as any, entities) as { entity: Entity; point: Vec3 } | null;
    if (!hit) {
      hit = this.raycastClosestOBB(ray, entities);
      if (!hit) return null;
    }

    const target = hit.entity;
    const targetWorld = target.transform.getWorldMatrix();
    const preview = previews[0];
    const previewWorld = preview ? preview.transform.getWorldMatrix() : new Float32Array(16) as Mat4; 
    if (!preview) {
        previewWorld[0] = 1; previewWorld[5] = 1; previewWorld[10] = 1; previewWorld[15] = 1;
    }

    const invTargetWorld = new Float32Array(16) as Mat4;
    try {
      mat4Invert(invTargetWorld, targetWorld);
    } catch {
      return null;
    }

    const hx = hit.point[0];
    const hy = hit.point[1];
    const hz = hit.point[2];
    const lx =
      (invTargetWorld[0] ?? 0) * hx +
      (invTargetWorld[4] ?? 0) * hy +
      (invTargetWorld[8] ?? 0) * hz +
      (invTargetWorld[12] ?? 0);
    const ly =
      (invTargetWorld[1] ?? 0) * hx +
      (invTargetWorld[5] ?? 0) * hy +
      (invTargetWorld[9] ?? 0) * hz +
      (invTargetWorld[13] ?? 0);
    const lz =
      (invTargetWorld[2] ?? 0) * hx +
      (invTargetWorld[6] ?? 0) * hy +
      (invTargetWorld[10] ?? 0) * hz +
      (invTargetWorld[14] ?? 0);
    const lw =
      (invTargetWorld[3] ?? 0) * hx +
      (invTargetWorld[7] ?? 0) * hy +
      (invTargetWorld[11] ?? 0) * hz +
      (invTargetWorld[15] ?? 1);
    const invW = Math.abs(lw) > 1e-6 && Math.abs(lw - 1) > 1e-6 ? 1 / lw : 1;
    const hitLocal: Vec3 = [lx * invW, ly * invW, lz * invW];

    const targetScale = target.transform.scale;
    const halfTargetLocal: Vec3 = [
      Math.max(Math.abs(targetScale[0]) * 0.5, 0.0005),
      Math.max(Math.abs(targetScale[1]) * 0.5, 0.0005),
      Math.max(Math.abs(targetScale[2]) * 0.5, 0.0005),
    ];

    const deltaX = Math.abs(Math.abs(hitLocal[0]) - halfTargetLocal[0]);
    const deltaY = Math.abs(Math.abs(hitLocal[1]) - halfTargetLocal[1]);
    const deltaZ = Math.abs(Math.abs(hitLocal[2]) - halfTargetLocal[2]);

    let axis: 0 | 1 | 2 = 0;
    let minDelta = deltaX;
    if (deltaY <= minDelta && deltaY <= deltaZ) {
      axis = 1;
      minDelta = deltaY;
    } else if (deltaZ < minDelta && deltaZ <= deltaY) {
      axis = 2;
      minDelta = deltaZ;
    }

    const sign = hitLocal[axis] >= 0 ? 1 : -1;
    const axisColumnOffset = axis * 4;
    const axisVector: Vec3 = [
      targetWorld[axisColumnOffset + 0] ?? 0,
      targetWorld[axisColumnOffset + 1] ?? 0,
      targetWorld[axisColumnOffset + 2] ?? 0,
    ];
    const axisLength = Math.hypot(axisVector[0], axisVector[1], axisVector[2]) || 1;
    normalizeVec3Out(axisVector, axisVector);
    const targetHalf = Math.max(0.0005, axisLength * 0.5);

    const previewColX = [
      previewWorld[0] ?? 0,
      previewWorld[1] ?? 0,
      previewWorld[2] ?? 0,
    ] as Vec3;
    const previewColY = [
      previewWorld[4] ?? 0,
      previewWorld[5] ?? 0,
      previewWorld[6] ?? 0,
    ] as Vec3;
    const previewColZ = [
      previewWorld[8] ?? 0,
      previewWorld[9] ?? 0,
      previewWorld[10] ?? 0,
    ] as Vec3;

    const previewHalf = Math.max(
      0.0005,
      0.5 *
        (Math.abs(dotVec3(axisVector, previewColX)) +
          Math.abs(dotVec3(axisVector, previewColY)) +
          Math.abs(dotVec3(axisVector, previewColZ)))
    );

    const placementConfig = this.config.placementMode.getConfig();
    const minHalfForTolerance = Math.min(targetHalf, previewHalf);
    const dimensionForTolerance =
      Number.isFinite(minHalfForTolerance) && minHalfForTolerance > 0
        ? minHalfForTolerance * 2
        : 1;
    const epsilon = Math.max(
      1e-4,
      (placementConfig.contactTolerance ?? 0) * dimensionForTolerance
    );

    const offset = (targetHalf + previewHalf + epsilon) * sign;

    const centerWorld: Vec3 = [
      targetWorld[12] ?? 0,
      targetWorld[13] ?? 0,
      targetWorld[14] ?? 0,
    ];

    const pos: Vec3 = [
      centerWorld[0] + axisVector[0] * offset,
      centerWorld[1] + axisVector[1] * offset,
      centerWorld[2] + axisVector[2] * offset,
    ];

    return { position: pos, normal: axisVector };
  }

  private raycastClosestOBB(
    ray: { origin: Vec3; direction: Vec3 },
    entities: Entity[]
  ): { entity: Entity; point: Vec3 } | null {
    let bestT = Number.POSITIVE_INFINITY;
    let best: { entity: Entity; point: Vec3 } | null = null;

    const EPS = 1e-6;
    for (const ent of entities) {
      try { if (ent.getComponent(CameraComponent)) continue; } catch {}
      const obb = this.obbHelper.getOBB(ent);
      const px = ray.origin[0] - obb.center[0];
      const py = ray.origin[1] - obb.center[1];
      const pz = ray.origin[2] - obb.center[2];
      const p: Vec3 = [
        px * obb.axes[0][0] + py * obb.axes[0][1] + pz * obb.axes[0][2],
        px * obb.axes[1][0] + py * obb.axes[1][1] + pz * obb.axes[1][2],
        px * obb.axes[2][0] + py * obb.axes[2][1] + pz * obb.axes[2][2],
      ];
      const d: Vec3 = [
        ray.direction[0] * obb.axes[0][0] + ray.direction[1] * obb.axes[0][1] + ray.direction[2] * obb.axes[0][2],
        ray.direction[0] * obb.axes[1][0] + ray.direction[1] * obb.axes[1][1] + ray.direction[2] * obb.axes[1][2],
        ray.direction[0] * obb.axes[2][0] + ray.direction[1] * obb.axes[2][1] + ray.direction[2] * obb.axes[2][2],
      ];

      let tmin = -Infinity;
      let tmax = Infinity;
      const half = obb.halfSizes;

      for (let i = 0; i < 3; i++) {
        const pi = p[i]!;
        const di = d[i]!;
        const hi = half[i]!;
        if (Math.abs(di) < EPS) {
          if (pi < -hi || pi > hi) {
            tmin = Infinity;
            break; 
          }
          continue;
        }
        let t1 = (-hi - pi) / di;
        let t2 = (hi - pi) / di;
        if (t1 > t2) {
          const tmp = t1; t1 = t2; t2 = tmp;
        }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) { tmin = Infinity; break; }
      }

      if (tmin !== Infinity) {
        const tHit = tmin >= 0 ? tmin : tmax;
        if (tHit >= 0 && tHit < bestT) {
          bestT = tHit;
          const point: Vec3 = [
            ray.origin[0] + ray.direction[0] * tHit,
            ray.origin[1] + ray.direction[1] * tHit,
            ray.origin[2] + ray.direction[2] * tHit,
          ];
          best = { entity: ent, point };
        }
      }
    }

    return best;
  }

  private getLastRaycastEntity(ray: { origin: Vec3; direction: Vec3 }): Entity | null {
    const previews = this.config.placementMode.getPreviewEntities();
    const entities = this.config.scene
      .getActiveEntities()
      .filter((e) => !previews.includes(e) && !e.userData.isPreview && !e.getComponent(CameraComponent));
    
    if (entities.length === 0) return null;
    
    const hit = this.raycaster.raycastClosest(ray as any, entities) as { entity: Entity } | null;
    if (hit?.entity) return hit.entity;
    const obbHit = this.raycastClosestOBB(ray, entities);
    return obbHit?.entity ?? null;
  }

  private raycastToGroundPlane(ray: { origin: Vec3; direction: Vec3 }): Vec3 | null {
    const { origin, direction } = ray;

    if (!origin || !direction) {
      return null;
    }

    const previews = this.config.placementMode.getPreviewEntities();
    const allEntities = this.config.scene
      .getActiveEntities()
      .filter((e) => !previews.includes(e) && !e.userData.isPreview);

    const terrainEntities: Entity[] = [];
    const otherEntities: Entity[] = [];
    
    for (const entity of allEntities) {
      try {
        if (entity.hasComponent(TerrainComponent)) {
          terrainEntities.push(entity);
        } else {
          otherEntities.push(entity);
        }
      } catch {
        otherEntities.push(entity);
      }
    }

    if (terrainEntities.length > 0) {
      const terrainHit = this.raycaster.raycastClosest(ray as any, terrainEntities);
      if (terrainHit && terrainHit.point) {
        const hitY = terrainHit.point[1];
        const previewScale = previews[0]?.transform.scale ?? [1, 1, 1];
        const placementY = hitY + Math.max(0.001, Math.abs(previewScale[1]) / 2);
        return [terrainHit.point[0], placementY, terrainHit.point[2]];
      }
    }

    if (otherEntities.length > 0) {
      const hit = this.raycaster.raycastClosest(ray as any, otherEntities);
      if (hit && hit.point) {
        const hitY = hit.point[1];
        const originY = origin[1];
        
        if (hitY <= originY + 0.1) {
          const previewScale = previews[0]?.transform.scale ?? [1, 1, 1];
          const placementY = hitY + Math.max(0.001, Math.abs(previewScale[1]) / 2);
          return [hit.point[0], placementY, hit.point[2]];
        }
      }
    }

    if (terrainEntities.length === 0) {
      const dy = direction[1];
      if (!Number.isFinite(dy) || Math.abs(dy) < 0.0001) {
        return null;
      }
      
      const gridHeight = this.config.state.gridConfig.value.height;

      const t = -(origin[1] - gridHeight) / dy;

      if (!Number.isFinite(t) || t < 0) {
        return null;
      }

      const x = origin[0] + t * direction[0];
      const z = origin[2] + t * direction[2];
      
      if (!Number.isFinite(x) || !Number.isFinite(z)) {
        return null;
      }

      const previewScale = previews[0]?.transform.scale ?? [1, 1, 1];
      const placementY = gridHeight + Math.max(0.001, Math.abs(previewScale[1]) / 2);

      return [x, placementY, z];
    }

    return null;
  }

  public dispose(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    Logger.debug('EditorPlacementController disposed');
  }
}
