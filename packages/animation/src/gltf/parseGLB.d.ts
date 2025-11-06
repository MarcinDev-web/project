/**
 * Minimal GLB (glTF Binary) v2.0 parser.
 * Supports JSON + one BIN chunk. External buffers/data URIs are not handled.
 */
import { type GLTF } from './convertFromGltf';
export type ParsedGlb = {
    gltf: GLTF;
    binChunk: ArrayBuffer | null;
};
export declare function parseGlb(buffer: ArrayBuffer): ParsedGlb;
export declare function importFromGlb(buffer: ArrayBuffer): {
    skeleton: import("..").Skeleton;
    clips: import("..").AnimationClip[];
    morphClips: import("..").MorphTargetClip[];
};
//# sourceMappingURL=parseGLB.d.ts.map