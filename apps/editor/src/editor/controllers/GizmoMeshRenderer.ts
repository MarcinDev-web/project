import type { Scene, Entity } from '@engine/world';
import { MeshComponent, MaterialComponent, Transform } from '@engine/world';
import { GizmoMeshFactory } from './GizmoMeshFactory';
import type { HandleKey, GizmoMode } from './GizmoTypes';
import { GIZMO_COLORS } from './GizmoTypes';
import type { Vec3, Quat } from '@engine/core/math';
import { DisposableGroup } from '@engine/core/utils';

export class GizmoMeshRenderer {
  private rootEntity: Entity | null = null;
  
  // Map entity ID to handle key (for picking)
  private entityHandleMap = new Map<string, HandleKey>();
  
  // Map handle key to list of entities (for highlighting)
  private handleEntitiesMap = new Map<HandleKey, Entity[]>();
  
  private materials = new Map<string, MaterialComponent>();
  private disposables = new DisposableGroup();
  
  private transformSpace: 'world' | 'local' = 'world';

  constructor(private scene: Scene) {
    this.initializeMaterials();
    this.createGizmoEntities();
  }

  private initializeMaterials() {
    const createMat = (colorHex: string, opacity = 1) => {
      const mat = new MaterialComponent();
      mat.primaryColor = this.hexToRgba(colorHex, opacity);
      mat.emissiveColor = this.hexToRgba(colorHex, 1);
      mat.emissiveIntensity = 0.5;
      mat.metallic = 0;
      mat.roughness = 1;
      // Ensure depth testing is ON for now (default), but maybe we can hack it later
      return mat;
    };

    // X Axis (Red)
    this.materials.set('x', createMat(GIZMO_COLORS.x.base));
    this.materials.set('x_hover', createMat(GIZMO_COLORS.x.hover));
    
    // Y Axis (Green)
    this.materials.set('y', createMat(GIZMO_COLORS.y.base));
    this.materials.set('y_hover', createMat(GIZMO_COLORS.y.hover));

    // Z Axis (Blue)
    this.materials.set('z', createMat(GIZMO_COLORS.z.base));
    this.materials.set('z_hover', createMat(GIZMO_COLORS.z.hover));

    // Planes
    this.materials.set('xy', createMat(GIZMO_COLORS.xy.base, 0.5));
    this.materials.set('xy_hover', createMat(GIZMO_COLORS.xy.hover, 0.6));
    this.materials.set('xz', createMat(GIZMO_COLORS.xz.base, 0.5));
    this.materials.set('xz_hover', createMat(GIZMO_COLORS.xz.hover, 0.6));
    this.materials.set('yz', createMat(GIZMO_COLORS.yz.base, 0.5));
    this.materials.set('yz_hover', createMat(GIZMO_COLORS.yz.hover, 0.6));

    // Center
    this.materials.set('center', createMat(GIZMO_COLORS.center.base));
    this.materials.set('center_hover', createMat(GIZMO_COLORS.center.hover));
  }

  private hexToRgba(hex: string, alpha = 1): [number, number, number, number] {
    if (hex.startsWith('rgba')) {
      const parts = hex.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (parts) {
        return [
          parseInt(parts[1]!) / 255,
          parseInt(parts[2]!) / 255,
          parseInt(parts[3]!) / 255,
          parseFloat(parts[4] ?? '1')
        ];
      }
    }

    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b, alpha];
  }

  private createGizmoEntities() {
    this.rootEntity = this.scene.createEntity('GizmoRoot');
    if (!this.rootEntity.getComponent(Transform)) {
        this.rootEntity.addComponent(new Transform());
    }

    const axisLength = 1.5;
    const axisRadius = 0.03;
    const arrowHeadLength = 0.4;
    const arrowHeadRadius = 0.12;
    const scaleBoxSize = 0.15;
    const planeSize = 0.5;
    const planeOffset = planeSize / 2;
    
    const addMesh = (name: string, mesh: any, materialKey: string, parent: Entity, handle: HandleKey, pos: Vec3 = [0, 0, 0], rot: Quat = [0, 0, 0, 1], scale: Vec3 = [1, 1, 1]) => {
        const entity = this.scene.createEntity(name);
        const meshComp = new MeshComponent();
        meshComp.meshType = 'custom';
        meshComp.meshData = mesh;
        entity.addComponent(meshComp);
        
        const matComp = this.materials.get(materialKey)!.clone();
        entity.addComponent(matComp);
        
        entity.transform.position = pos;
        entity.transform.rotation = rot;
        entity.transform.scale = scale;
        entity.transform.parent = parent.transform;
        
        // Register
        this.entityHandleMap.set(entity.id, handle);
        
        if (!this.handleEntitiesMap.has(handle)) {
            this.handleEntitiesMap.set(handle, []);
        }
        this.handleEntitiesMap.get(handle)!.push(entity);
        
        return entity;
    };

    const rotX90: Quat = [0.7071068, 0, 0, 0.7071068]; 
    const rotY90: Quat = [0, 0.7071068, 0, 0.7071068]; 
    const rotZ90: Quat = [0, 0, 0.7071068, 0.7071068]; 
    const rotZNeg90: Quat = [0, 0, -0.7071068, 0.7071068]; 
    
    const arrowShaft = GizmoMeshFactory.createArrowShaftMesh(axisLength, axisRadius);
    const arrowHead = GizmoMeshFactory.createArrowHeadMesh(arrowHeadLength, arrowHeadRadius);
    const boxMesh = GizmoMeshFactory.createScaleBoxMesh(scaleBoxSize);
    const planeMesh = GizmoMeshFactory.createPlaneHandleMesh(planeSize);
    const ringMesh = GizmoMeshFactory.createRingMesh(1.0, 0.02);

    // Groups
    const xGroup = this.scene.createEntity('Gizmo_X_Group');
    xGroup.transform.parent = this.rootEntity.transform;
    const yGroup = this.scene.createEntity('Gizmo_Y_Group');
    yGroup.transform.parent = this.rootEntity.transform;
    const zGroup = this.scene.createEntity('Gizmo_Z_Group');
    zGroup.transform.parent = this.rootEntity.transform;

    // --- X Axis ---
    addMesh('Gizmo_X_Shaft', arrowShaft, 'x', xGroup, 'x', [axisLength / 2, 0, 0], rotZNeg90);
    addMesh('Gizmo_X_Head', arrowHead, 'x', xGroup, 'x', [axisLength, 0, 0], rotZNeg90);
    addMesh('Gizmo_X_Scale', boxMesh, 'x', xGroup, 'x', [axisLength, 0, 0]);
    addMesh('Gizmo_X_Rotate', ringMesh, 'x', xGroup, 'x', [0, 0, 0], rotY90);

    // --- Y Axis ---
    addMesh('Gizmo_Y_Shaft', arrowShaft, 'y', yGroup, 'y', [0, axisLength / 2, 0]);
    addMesh('Gizmo_Y_Head', arrowHead, 'y', yGroup, 'y', [0, axisLength, 0]);
    addMesh('Gizmo_Y_Scale', boxMesh, 'y', yGroup, 'y', [0, axisLength, 0]);
    addMesh('Gizmo_Y_Rotate', ringMesh, 'y', yGroup, 'y', [0, 0, 0], rotX90);

    // --- Z Axis ---
    addMesh('Gizmo_Z_Shaft', arrowShaft, 'z', zGroup, 'z', [0, 0, axisLength / 2], rotX90);
    addMesh('Gizmo_Z_Head', arrowHead, 'z', zGroup, 'z', [0, 0, axisLength], rotX90);
    addMesh('Gizmo_Z_Scale', boxMesh, 'z', zGroup, 'z', [0, 0, axisLength]);
    addMesh('Gizmo_Z_Rotate', ringMesh, 'z', zGroup, 'z', [0, 0, 0], [0, 0, 0, 1]);

    // --- Planes ---
    addMesh('Gizmo_XY', planeMesh, 'xy', this.rootEntity, 'xy', [planeOffset, planeOffset, 0], [0, 0, 0, 1]);
    addMesh('Gizmo_XZ', planeMesh, 'xz', this.rootEntity, 'xz', [planeOffset, 0, planeOffset], rotX90);
    addMesh('Gizmo_YZ', planeMesh, 'yz', this.rootEntity, 'yz', [0, planeOffset, planeOffset], rotZ90);
    
    // --- Uniform Scale ---
    addMesh('Gizmo_Center_Scale', boxMesh, 'center', this.rootEntity, 'center', [0, 0, 0]);

    // Initial visibility update
    this.setMode('translate');
  }

  public setMode(mode: GizmoMode) {
    
    const setVisible = (entities: Entity[] | undefined, visible: boolean) => {
        if (!entities) return;
        for (const e of entities) {
            const mesh = e.getComponent(MeshComponent);
            if (mesh) {
                mesh.meshType = visible ? 'custom' : 'none';
            }
        }
    };

    // Helper to check if name matches part
    const matches = (entities: Entity[], part: string) => {
        return entities.filter(e => e.name.includes(part));
    };

    const axes = ['x', 'y', 'z'] as HandleKey[];
    
    axes.forEach(axis => {
        const entities = this.handleEntitiesMap.get(axis) || [];
        
        if (mode === 'translate') {
            setVisible(matches(entities, 'Shaft'), true);
            setVisible(matches(entities, 'Head'), true);
            setVisible(matches(entities, 'Scale'), false);
            setVisible(matches(entities, 'Rotate'), false);
        } else if (mode === 'rotate') {
            setVisible(matches(entities, 'Shaft'), false);
            setVisible(matches(entities, 'Head'), false);
            setVisible(matches(entities, 'Scale'), false);
            setVisible(matches(entities, 'Rotate'), true);
        } else if (mode === 'scale') {
            setVisible(matches(entities, 'Shaft'), true);
            setVisible(matches(entities, 'Head'), false);
            setVisible(matches(entities, 'Scale'), true);
            setVisible(matches(entities, 'Rotate'), false);
        } else if (mode === 'uniform') {
             // Uniform might show center block + shafts?
             // Or just center block.
             setVisible(matches(entities, 'Shaft'), true);
             setVisible(matches(entities, 'Head'), false);
             setVisible(matches(entities, 'Scale'), false);
             setVisible(matches(entities, 'Rotate'), false);
        }
    });

    // Planes
    const planes = ['xy', 'xz', 'yz'] as HandleKey[];
    planes.forEach(plane => {
        setVisible(this.handleEntitiesMap.get(plane), mode === 'translate');
    });

    // Center
    const center = this.handleEntitiesMap.get('center');
    setVisible(center, mode === 'scale' || mode === 'uniform');
  }

  public setHighlight(handle: HandleKey | null) {
    // Reset all to base materials
    for (const [key, entities] of this.handleEntitiesMap) {
        const baseMatName = key === 'center' ? 'center' : key;
        // Check if this key is an axis or plane
        // We need to be careful about suffixes.
        // My materials map has 'x', 'x_hover'.
        
        const mat = this.materials.get(baseMatName);
        if (mat) {
            for (const entity of entities) {
                // Remove existing material before adding new one
                entity.removeComponent(MaterialComponent);
                entity.addComponent(mat.clone());
            }
        }
    }

    if (handle) {
        const hoverMatName = handle === 'center' ? 'center_hover' : `${handle}_hover`;
        const mat = this.materials.get(hoverMatName);
        const entities = this.handleEntitiesMap.get(handle);
        
        if (mat && entities) {
            // Only highlight visible parts for this mode!
            for (const entity of entities) {
                // Check if visible
                const mesh = entity.getComponent(MeshComponent);
                if (mesh && mesh.meshType !== 'none') {
                    // Remove existing material before adding new one
                    entity.removeComponent(MaterialComponent);
                    entity.addComponent(mat.clone());
                }
            }
        }
    }
  }
  
  public setVisible(visible: boolean) {
      if (this.rootEntity) {
          this.rootEntity.transform.scale = visible ? [1, 1, 1] : [0, 0, 0];
      }
  }

  public update(position: Vec3, rotation: Quat, scale: number) {
      if (!this.rootEntity) return;
      this.rootEntity.transform.position = position;
      
      if (this.transformSpace === 'local') {
           this.rootEntity.transform.rotation = rotation;
      } else {
           this.rootEntity.transform.rotation = [0, 0, 0, 1];
      }
      
      // Scale compensation
      // We apply the uniform scale to root
      this.rootEntity.transform.scale = [scale, scale, scale];
  }
  
  public setTransformSpace(space: 'world' | 'local') {
      this.transformSpace = space;
  }

  public getEntityHandle(entityId: string): HandleKey | undefined {
      return this.entityHandleMap.get(entityId);
  }

  public getPickableEntities(): Entity[] {
      // Return only entities that are currently visible
       const pickables: Entity[] = [];
       for (const [_, entities] of this.handleEntitiesMap) {
           for (const e of entities) {
               const mesh = e.getComponent(MeshComponent);
               if (mesh && mesh.meshType !== 'none') {
                   pickables.push(e);
               }
           }
       }
       return pickables;
  }

  public dispose() {
      this.disposables.dispose();
      if (this.rootEntity) {
          this.scene.removeEntity(this.rootEntity);
      }
      this.handleEntitiesMap.clear();
      this.entityHandleMap.clear();
      this.materials.clear();
  }
}
