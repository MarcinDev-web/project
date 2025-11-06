import type { Skeleton } from '../core/Skeleton';
import type { AnimationClip } from '../core/AnimationClip';
import type { MorphTargetClip } from '../core/Morph';
export type GLTF = {
    nodes: Array<{
        name?: string;
        children?: number[];
        mesh?: number;
    }>;
    skins?: Array<{
        joints: number[];
        inverseBindMatrices?: number;
    }>;
    accessors: Array<{
        bufferView?: number;
        byteOffset?: number;
        componentType: number;
        count: number;
        type: string;
    }>;
    bufferViews: Array<{
        buffer: number;
        byteOffset?: number;
        byteLength: number;
        byteStride?: number;
    }>;
    buffers: Array<{
        uri?: string;
        byteLength: number;
    }>;
    animations?: Array<{
        name?: string;
        samplers: Array<{
            input: number;
            output: number;
            interpolation?: 'LINEAR' | 'STEP' | 'CUBICSPLINE';
        }>;
        channels: Array<{
            sampler: number;
            target: {
                node: number;
                path: 'translation' | 'rotation' | 'scale' | 'weights';
            };
        }>;
    }>;
    meshes?: Array<{
        primitives: Array<{
            targets?: Array<Record<string, unknown>>;
        }>;
    }>;
};
export type ConvertOptions = {
    skinIndex?: number;
};
export declare function convertFromGltf(gltf: GLTF, resolveBuffer: (bufferIndex: number) => ArrayBuffer, options?: ConvertOptions): {
    skeleton: Skeleton;
    clips: AnimationClip[];
    morphClips: MorphTargetClip[];
};
//# sourceMappingURL=convertFromGltf.d.ts.map