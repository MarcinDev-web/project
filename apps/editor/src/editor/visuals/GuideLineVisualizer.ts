import { Entity, Transform, MeshComponent, MaterialComponent } from '@engine/world';
import type { Scene } from '@engine/world';
import type { Vec3 } from '@engine/core/math';
import { crossVec3, dotVec3, normalizeVec3, quatFromAxisAngle } from '@engine/core/math';
import { DisposableGroup } from '@engine/core';

/**
 * Visualizes guide lines for tools
 */
export class GuideLineVisualizer {
  private readonly scene: Scene;
  private readonly disposables = new DisposableGroup();
  private lineEntities: Entity[] = [];
  private materialCache = new Map<string, MaterialComponent>();

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Clears all guide lines
   */
  public clear(): void {
    for (const entity of this.lineEntities) {
      this.scene.removeEntity(entity);
    }
    this.lineEntities = [];
  }

  /**
   * Draws a line from start to end with specified color
   */
  public drawLine(start: Vec3, end: Vec3, color: [number, number, number, number], thickness = 0.02): void {
    const entity = new Entity('guide-line');
    
    const center: Vec3 = [
      (start[0] + end[0]) / 2,
      (start[1] + end[1]) / 2,
      (start[2] + end[2]) / 2,
    ];
    
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const dz = end[2] - start[2];
    const length = Math.sqrt(dx*dx + dy*dy + dz*dz);

    const scale: Vec3 = [length, thickness, thickness];
    const rotation = this.computeRotationForDirection([dx, dy, dz]);

    entity.addComponent(
      new Transform(
        center,
        rotation,
        scale
      )
    );

    const mesh = new MeshComponent();
    mesh.meshType = 'cube';
    entity.addComponent(mesh);

    const materialKey = color.join(',');
    let material = this.materialCache.get(materialKey);
    if (!material) {
        material = new MaterialComponent();
        material.primaryColor = color;
        material.emissiveColor = color; // Make it glow slightly
        material.emissiveIntensity = 0.5;
        material.opacity = color[3];
        material.alphaMode = 'blend';
        material.depthTest = false; // Always visible on top? Maybe
        this.materialCache.set(materialKey, material);
    }
    entity.addComponent(material);

    this.scene.addEntity(entity);
    this.lineEntities.push(entity);
  }

  /**
   * Draws a ruler-like line with tick marks
   */
  public drawRuler(start: Vec3, end: Vec3, color: [number, number, number, number], step = 1.0, tickSize = 0.2): void {
    this.drawLine(start, end, color, 0.03); // Main line

    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const dz = end[2] - start[2];
    const length = Math.sqrt(dx*dx + dy*dy + dz*dz);
    const steps = Math.floor(length / step);

    const dir: Vec3 = [dx/length, dy/length, dz/length];
    
    // Find perpendicular vector for ticks
    let perp: Vec3 = [1, 0, 0];
    if (Math.abs(dir[0]) > 0.9) perp = [0, 1, 0]; // If vertical is close to X, use Y
    
    // Ticks
    for (let i = 1; i <= steps; i++) {
        const t = i * step;
        if (t >= length) break;
        
        const p: Vec3 = [
            start[0] + dir[0] * t,
            start[1] + dir[1] * t,
            start[2] + dir[2] * t
        ];
        
        // Draw tick
        // Assuming perpendicular is enough
        // To be proper we should cross product but for vertical lines (most common ruler), X/Z works.
        if (Math.abs(dir[1]) > 0.9) { // Vertical ruler
             const tickStart: Vec3 = [p[0] - tickSize/2, p[1], p[2]];
             const tickEnd: Vec3 = [p[0] + tickSize/2, p[1], p[2]];
             this.drawLine(tickStart, tickEnd, color, 0.02);
        } else {
             const tickStart: Vec3 = [p[0], p[1] - tickSize/2, p[2]];
             const tickEnd: Vec3 = [p[0], p[1] + tickSize/2, p[2]];
             this.drawLine(tickStart, tickEnd, color, 0.02);
        }
    }
  }

  /**
   * Draws a circle (approximated by lines)
   */
  public drawCircle(center: Vec3, radius: number, axis: 'x'|'y'|'z', color: [number, number, number, number], segments = 32): void {
      const angleStep = (Math.PI * 2) / segments;
      
      for (let i = 0; i < segments; i++) {
          const a1 = i * angleStep;
          const a2 = (i + 1) * angleStep;
          
          let p1: Vec3, p2: Vec3;
          
          if (axis === 'y') {
              p1 = [center[0] + Math.cos(a1) * radius, center[1], center[2] + Math.sin(a1) * radius];
              p2 = [center[0] + Math.cos(a2) * radius, center[1], center[2] + Math.sin(a2) * radius];
          } else if (axis === 'x') {
              p1 = [center[0], center[1] + Math.cos(a1) * radius, center[2] + Math.sin(a1) * radius];
              p2 = [center[0], center[1] + Math.cos(a2) * radius, center[2] + Math.sin(a2) * radius];
          } else { // z
              p1 = [center[0] + Math.cos(a1) * radius, center[1] + Math.sin(a1) * radius, center[2]];
              p2 = [center[0] + Math.cos(a2) * radius, center[1] + Math.sin(a2) * radius, center[2]];
          }
          
          this.drawLine(p1, p2, color, 0.02);
      }
  }

  /**
   * Disposes resources
   */
  dispose(): void {
    this.clear();
    this.disposables.dispose();
  }

  private computeRotationForDirection(direction: Vec3): [number, number, number, number] {
    const base: Vec3 = [1, 0, 0];
    const dir = normalizeVec3(direction);
    const d = dotVec3(base, dir);

    // If already aligned with +X
    if (d > 0.9999) {
      return [0, 0, 0, 1];
    }

    // Opposite to +X: rotate 180 degrees around any perpendicular axis (use Y)
    if (d < -0.9999) {
      return quatFromAxisAngle([0, 1, 0], Math.PI);
    }

    const axis = crossVec3(base, dir);
    const axisNorm = normalizeVec3(axis);
    const angle = Math.acos(Math.max(-1, Math.min(1, d)));
    return quatFromAxisAngle(axisNorm, angle);
  }
}

