import type { Mat4, Vec3 } from '@engine/core/math';
export interface CascadeResult {
    lightViewProj: [Float32Array, Float32Array, Float32Array, Float32Array];
    cascadeSplits: [number, number, number, number];
    atlasRects: [number, number, number, number][];
}
export interface CascadeParams {
    viewMatrix: Mat4;
    projectionMatrix: Mat4;
    lightDirection: Vec3;
    cameraNear: number;
    cameraFar: number;
    atlasSize: number;
    cascades: number;
}
export declare function computeCascades(params: CascadeParams): CascadeResult;
//# sourceMappingURL=ShadowCascades.d.ts.map