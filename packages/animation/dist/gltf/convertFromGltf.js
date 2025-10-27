import { createSkeleton } from '../core/Skeleton';
import { createClip } from '../core/AnimationClip';
import { createMorphClip } from '../core/Morph';
export function convertFromGltf(gltf, resolveBuffer, options) {
    if (!gltf.skins || gltf.skins.length === 0) {
        throw new Error('glTF has no skins');
    }
    const skin = gltf.skins[options?.skinIndex ?? 0];
    const jointNodeIndices = skin.joints;
    const jointCount = jointNodeIndices.length;
    const joints = jointNodeIndices.map((ni) => ({ name: gltf.nodes[ni]?.name ?? `joint_${ni}` }));
    // Build parent indices for joint list by scanning node children
    const nodeParent = new Int16Array(gltf.nodes.length).fill(-1);
    for (let i = 0; i < gltf.nodes.length; i++) {
        const children = gltf.nodes[i]?.children ?? [];
        for (const c of children)
            nodeParent[c] = i;
    }
    // Map node index -> joint index
    const nodeToJoint = new Map();
    jointNodeIndices.forEach((ni, idx) => nodeToJoint.set(ni, idx));
    const parents = new Int16Array(jointCount).fill(-1);
    for (let j = 0; j < jointCount; j++) {
        const nodeIndex = jointNodeIndices[j];
        const parentNode = nodeParent[nodeIndex];
        parents[j] = parentNode >= 0 && nodeToJoint.has(parentNode) ? nodeToJoint.get(parentNode) : -1;
    }
    // Inverse bind matrices
    let inverseBindMatrices = new Float32Array(jointCount * 16);
    if (typeof skin.inverseBindMatrices === 'number') {
        const ibAcc = gltf.accessors[skin.inverseBindMatrices];
        const ibData = readAccessorAsFloat32(gltf, resolveBuffer, skin.inverseBindMatrices);
        if (ibAcc && ibAcc.count !== jointCount) {
            // Truncate or pad if mismatch (robustness)
            const out = new Float32Array(jointCount * 16);
            out.set(ibData.subarray(0, out.length));
            inverseBindMatrices = out;
        }
        else {
            inverseBindMatrices.set(ibData.subarray(0, inverseBindMatrices.length));
        }
    }
    const skeleton = createSkeleton(joints, parents, inverseBindMatrices);
    // Animations → build tracks per joint
    const clips = [];
    const morphClips = [];
    for (const anim of gltf.animations ?? []) {
        const tracks = [];
        const morphChannelsByTarget = new Map();
        const name = anim.name ?? 'clip';
        for (const ch of anim.channels) {
            const sampler = anim.samplers[ch.sampler];
            const times = readAccessorAsFloat32(gltf, resolveBuffer, sampler.input);
            let interp = 'linear';
            if (sampler.interpolation === 'STEP')
                interp = 'step';
            else if (sampler.interpolation === 'CUBICSPLINE')
                interp = 'cubic';
            // Node to joint mapping
            const jIdx = nodeToJoint.get(ch.target.node);
            if (ch.target.path === 'weights') {
                // Split combined weights into per-target channels
                const out = readAccessorAsFloat32(gltf, resolveBuffer, sampler.output);
                const meshIndex = gltf.nodes[ch.target.node]?.mesh;
                const targetCount = meshIndex != null ? (gltf.meshes?.[meshIndex]?.primitives?.[0]?.targets?.length ?? 0) : 0;
                if (targetCount > 0) {
                    const values = unwrapCubicIfNeeded(out, sampler.interpolation, targetCount);
                    for (let t = 0; t < targetCount; t++) {
                        const chs = morphChannelsByTarget.get(t) ?? [];
                        const flat = new Float32Array(times.length);
                        for (let k = 0; k < times.length; k++)
                            flat[k] = values[k * targetCount + t];
                        chs.push({ targetIndex: t, times, values: flat, interpolation: interp });
                        morphChannelsByTarget.set(t, chs);
                    }
                }
                continue;
            }
            if (jIdx === undefined)
                continue; // not a joint animation
            if (ch.target.path === 'translation' || ch.target.path === 'scale') {
                const stride = 3;
                const out = readAccessorAsFloat32(gltf, resolveBuffer, sampler.output);
                const values = unwrapCubicIfNeeded(out, sampler.interpolation, stride);
                const kind = ch.target.path;
                tracks.push({ kind, jointIndex: jIdx, times, values, interpolation: interp });
            }
            else if (ch.target.path === 'rotation') {
                const stride = 4;
                const out = readAccessorAsFloat32(gltf, resolveBuffer, sampler.output);
                const values = unwrapCubicIfNeeded(out, sampler.interpolation, stride);
                tracks.push({ kind: 'rotation', jointIndex: jIdx, times, values, interpolation: interp });
            }
        }
        if (tracks.length > 0) {
            clips.push(createClip(name, tracks));
        }
        if (morphChannelsByTarget.size > 0) {
            // Flatten channels (one per target)
            const targetCount = Math.max(...Array.from(morphChannelsByTarget.keys())) + 1;
            const channels = [];
            for (const list of morphChannelsByTarget.values())
                channels.push(...list);
            morphClips.push(createMorphClip(name + '_morph', channels, targetCount));
        }
    }
    return { skeleton, clips, morphClips };
}
function readAccessorAsFloat32(gltf, resolveBuffer, accessorIndex) {
    const acc = gltf.accessors[accessorIndex];
    if (!acc)
        throw new Error(`Missing accessor ${accessorIndex}`);
    if (acc.bufferView == null)
        throw new Error('Accessor without bufferView not supported');
    const bv = gltf.bufferViews[acc.bufferView];
    if (!bv)
        throw new Error(`Missing bufferView ${acc.bufferView}`);
    const baseBuffer = resolveBuffer(bv.buffer);
    const buf = new Uint8Array(baseBuffer);
    const byteOffset = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
    const byteLength = acc.count * elementStrideBytes(acc.type, acc.componentType);
    const slice = buf.subarray(byteOffset, byteOffset + byteLength);
    // Normalize to Float32 regardless of component type
    const stride = numComponents(acc.type);
    const out = new Float32Array(acc.count * stride);
    switch (acc.componentType) {
        case 5126: { // FLOAT
            const view = new Float32Array(slice.buffer, slice.byteOffset, acc.count * stride);
            out.set(view);
            break;
        }
        case 5123: // UNSIGNED_SHORT
        case 5122: // SHORT
        case 5121: // UNSIGNED_BYTE
        case 5120: // BYTE
        case 5125: { // UNSIGNED_INT
            // Convert integers to floats
            const view = componentArray(acc.componentType, slice);
            for (let i = 0; i < out.length; i++)
                out[i] = view[i] ?? 0;
            break;
        }
        default:
            throw new Error(`Unsupported componentType ${acc.componentType}`);
    }
    return out;
}
function numComponents(type) {
    switch (type) {
        case 'SCALAR':
            return 1;
        case 'VEC2':
            return 2;
        case 'VEC3':
            return 3;
        case 'VEC4':
            return 4;
        case 'MAT4':
            return 16;
        default:
            throw new Error(`Unsupported accessor type ${type}`);
    }
}
function elementStrideBytes(type, componentType) {
    const comps = numComponents(type);
    const bytes = componentTypeBytes(componentType);
    return comps * bytes;
}
function componentTypeBytes(componentType) {
    switch (componentType) {
        case 5120: // BYTE
        case 5121: // UNSIGNED_BYTE
            return 1;
        case 5122: // SHORT
        case 5123: // UNSIGNED_SHORT
            return 2;
        case 5125: // UNSIGNED_INT
        case 5126: // FLOAT
            return 4;
        default:
            throw new Error(`Unsupported componentType ${componentType}`);
    }
}
function componentArray(componentType, slice) {
    switch (componentType) {
        case 5120:
            return new Int8Array(slice.buffer, slice.byteOffset, slice.byteLength);
        case 5121:
            return new Uint8Array(slice.buffer, slice.byteOffset, slice.byteLength);
        case 5122:
            return new Int16Array(slice.buffer, slice.byteOffset, slice.byteLength / 2);
        case 5123:
            return new Uint16Array(slice.buffer, slice.byteOffset, slice.byteLength / 2);
        case 5125:
            return new Uint32Array(slice.buffer, slice.byteOffset, slice.byteLength / 4);
        default:
            throw new Error(`Unsupported componentType ${componentType}`);
    }
}
function unwrapCubicIfNeeded(values, interpolation, stride) {
    if (interpolation !== 'CUBICSPLINE')
        return values;
    // CUBICSPLINE layout: [inTangent, value, outTangent] per keyframe
    const keyCount = Math.floor(values.length / (stride * 3));
    const out = new Float32Array(keyCount * stride);
    for (let k = 0; k < keyCount; k++) {
        const valueOffset = k * stride * 3 + stride; // middle block
        for (let c = 0; c < stride; c++) {
            out[k * stride + c] = values[valueOffset + c];
        }
    }
    return out;
}
//# sourceMappingURL=convertFromGltf.js.map