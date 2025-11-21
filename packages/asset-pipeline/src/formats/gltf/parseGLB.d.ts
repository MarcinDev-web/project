import type { GLTF } from './types.js';
export type ParsedGlb = {
    gltf: GLTF;
    binChunk: ArrayBuffer | null;
};
export declare function parseGlb(buffer: ArrayBuffer): ParsedGlb;
//# sourceMappingURL=parseGLB.d.ts.map