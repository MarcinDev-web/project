import type { Mat4, Vec3 } from '@engine/core/math';
import { mat4Invert, mat4Multiply, mat4Ortho, mat4LookAt } from '@engine/core/math';

export interface CascadeResult {
  lightViewProj: [Float32Array, Float32Array, Float32Array, Float32Array];
  cascadeSplits: [number, number, number, number];
  atlasRects: [number, number, number, number][]; // uvMin.xy, uvMax.zw per cascade
}

export interface CascadeParams {
  viewMatrix: Mat4;
  projectionMatrix: Mat4;
  lightDirection: Vec3; // world-space, normalized
  cameraNear: number;
  cameraFar: number;
  atlasSize: number; // e.g., 2048
  cascades: number; // 4
}

function practicalSplit(near: number, far: number, index: number, cascadeCount: number, lambda = 0.5): number {
  const i = index + 1;
  const si = i / cascadeCount;
  const log = near * Math.pow(far / near, si);
  const uni = near + (far - near) * si;
  return lambda * log + (1 - lambda) * uni;
}

export class ShadowCascadeCalculator {
  private invView = new Float32Array(16);
  private lightView = new Float32Array(16);
  private lightProj = new Float32Array(16);
  
  // Scratch vectors for lookAt
  private center = new Float32Array(3);
  private up = new Float32Array(3);
  private eye = new Float32Array(3);

  // Corners: 8 points x 3 coords
  private corners = new Float32Array(8 * 3);

  // Reused result object
  private result: CascadeResult = {
    lightViewProj: [
      new Float32Array(16),
      new Float32Array(16),
      new Float32Array(16),
      new Float32Array(16),
    ],
    cascadeSplits: [0, 0, 0, 0],
    atlasRects: [
      [0, 0, 0.5, 0.5],
      [0.5, 0, 1.0, 0.5],
      [0, 0.5, 0.5, 1.0],
      [0.5, 0.5, 1.0, 1.0],
    ],
  };

  public compute(params: CascadeParams): CascadeResult {
    const { viewMatrix, projectionMatrix, lightDirection, cameraNear, cameraFar, atlasSize } = params;
    const cascadeCount = Math.max(1, Math.min(params.cascades | 0, 4));

    // Derive view inverse
    mat4Invert(this.invView, viewMatrix);

    // Derive fov and aspect from projection
    const m = projectionMatrix as unknown as Float32Array;
    const fovY = 2 * Math.atan(1 / Math.max(1e-6, m[5]!));
    const aspect = m[5]! / Math.max(1e-6, m[0]!);

    const tanHalfFovY = Math.tan(fovY * 0.5);

    let prevSplit = cameraNear;
    for (let c = 0; c < cascadeCount; c++) {
      const splitFar = practicalSplit(cameraNear, cameraFar, c, cascadeCount, 0.5);
      const splitNear = prevSplit;
      
      // Update splits in result
      this.result.cascadeSplits[c] = splitFar;
      
      prevSplit = splitFar;

      // Compute frustum corners (world space) for this slice
      // We fill this.corners directly
      let ci = 0;
      for (const d of [splitNear, splitFar]) {
        const h = tanHalfFovY * d;
        const w = h * aspect;
        const z = -d; // camera forward is -Z in view space
        
        // View space corners (implicit loop unrolled for performance)
        // TL: [-w, h, z], TR: [w, h, z], BL: [-w, -h, z], BR: [w, -h, z]
        // Order matches original: BL, BR, TR, TL
        const vxList = [-w, w, w, -w];
        const vyList = [-h, -h, h, h];

        for (let k = 0; k < 4; k++) {
          const vx = vxList[k];
          const vy = vyList[k];
          const vz = z;

          // Transform to world: invView * [vx,vy,vz,1]
          const x = vx * this.invView[0]! + vy * this.invView[4]! + vz * this.invView[8]! + this.invView[12]!;
          const y = vx * this.invView[1]! + vy * this.invView[5]! + vz * this.invView[9]! + this.invView[13]!;
          const zW = vx * this.invView[2]! + vy * this.invView[6]! + vz * this.invView[10]! + this.invView[14]!;
          
          this.corners[ci++] = x;
          this.corners[ci++] = y;
          this.corners[ci++] = zW;
        }
      }

      // Light view matrix (look from far away in light direction toward frustum center)
      let cx = 0, cy = 0, cz = 0;
      for (let i = 0; i < 8; i++) {
        cx += this.corners[i * 3 + 0];
        cy += this.corners[i * 3 + 1];
        cz += this.corners[i * 3 + 2];
      }
      cx /= 8; cy /= 8; cz /= 8;

      this.center[0] = cx;
      this.center[1] = cy;
      this.center[2] = cz;

      // Up vector
      if (Math.abs(lightDirection[1]) > 0.9) {
        this.up[0] = 0; this.up[1] = 0; this.up[2] = 1;
      } else {
        this.up[0] = 0; this.up[1] = 1; this.up[2] = 0;
      }

      // Eye position
      this.eye[0] = cx - lightDirection[0] * cameraFar;
      this.eye[1] = cy - lightDirection[1] * cameraFar;
      this.eye[2] = cz - lightDirection[2] * cameraFar;

      mat4LookAt(this.lightView, this.eye as unknown as Vec3, this.center as unknown as Vec3, this.up as unknown as Vec3);

      // Transform corners to light space and compute bounds
      let minX = Number.POSITIVE_INFINITY, minY = Number.POSITIVE_INFINITY, minZ = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY, maxZ = Number.NEGATIVE_INFINITY;
      let sumLX = 0, sumLY = 0;

      for (let i = 0; i < 8; i++) {
        const px = this.corners[i * 3 + 0];
        const py = this.corners[i * 3 + 1];
        const pz = this.corners[i * 3 + 2];

        const lx = px * this.lightView[0]! + py * this.lightView[4]! + pz * this.lightView[8]! + this.lightView[12]!;
        const ly = px * this.lightView[1]! + py * this.lightView[5]! + pz * this.lightView[9]! + this.lightView[13]!;
        const lz = px * this.lightView[2]! + py * this.lightView[6]! + pz * this.lightView[10]! + this.lightView[14]!;
        
        if (lx < minX) minX = lx; if (lx > maxX) maxX = lx;
        if (ly < minY) minY = ly; if (ly > maxY) maxY = ly;
        if (lz < minZ) minZ = lz; if (lz > maxZ) maxZ = lz;
        sumLX += lx; sumLY += ly;
      }

      // Stable cascade extents
      let cxL = sumLX / 8; let cyL = sumLY / 8;
      let maxRadius = 0.0;
      for (let i = 0; i < 8; i++) {
        const px = this.corners[i * 3 + 0];
        const py = this.corners[i * 3 + 1];
        const pz = this.corners[i * 3 + 2];

        const lx = px * this.lightView[0]! + py * this.lightView[4]! + pz * this.lightView[8]! + this.lightView[12]!;
        const ly = px * this.lightView[1]! + py * this.lightView[5]! + pz * this.lightView[9]! + this.lightView[13]!;
        
        const dx = lx - cxL; const dy = ly - cyL;
        const r = Math.hypot(dx, dy);
        if (r > maxRadius) maxRadius = r;
      }

      const width = maxRadius * 2.0;
      const height = width;
      const texelSizeX = width / (atlasSize * 0.5);
      const texelSizeY = height / (atlasSize * 0.5);
      
      cxL = Math.floor(cxL / texelSizeX) * texelSizeX;
      cyL = Math.floor(cyL / texelSizeY) * texelSizeY;
      minX = cxL - width * 0.5; maxX = cxL + width * 0.5;
      minY = cyL - height * 0.5; maxY = cyL + height * 0.5;

      const zMargin = (maxZ - minZ) * 0.05 + 5.0;
      minZ -= zMargin; maxZ += zMargin;

      mat4Ortho(this.lightProj, minX, maxX, minY, maxY, minZ, maxZ);
      
      // Result LVP
      mat4Multiply(this.result.lightViewProj[c], this.lightProj, this.lightView);
    }

    // Fill remaining splits if cascadeCount < 4 (though typically 4)
    for (let c = cascadeCount; c < 4; c++) {
      this.result.cascadeSplits[c] = cameraFar;
    }

    return this.result;
  }
}

/**
 * @deprecated Use ShadowCascadeCalculator for zero-allocation updates
 */
export function computeCascades(params: CascadeParams): CascadeResult {
  return new ShadowCascadeCalculator().compute(params);
}
