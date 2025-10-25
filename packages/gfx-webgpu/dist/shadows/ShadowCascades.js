import { mat4Invert, mat4Multiply, mat4Ortho, mat4LookAt } from '@engine/core/math';
function practicalSplit(near, far, index, cascadeCount, lambda = 0.5) {
    const i = index + 1;
    const si = i / cascadeCount;
    const log = near * Math.pow(far / near, si);
    const uni = near + (far - near) * si;
    return lambda * log + (1 - lambda) * uni;
}
export function computeCascades(params) {
    const { viewMatrix, projectionMatrix, lightDirection, cameraNear, cameraFar, atlasSize } = params;
    const cascadeCount = Math.max(1, Math.min(params.cascades | 0, 4));
    // Derive view inverse
    const invView = new Float32Array(16);
    mat4Invert(invView, viewMatrix);
    // Derive fov and aspect from projection
    const m = projectionMatrix;
    const fovY = 2 * Math.atan(1 / Math.max(1e-6, m[5]));
    const aspect = m[5] / Math.max(1e-6, m[0]);
    const tanHalfFovY = Math.tan(fovY * 0.5);
    const splits = [];
    for (let c = 0; c < cascadeCount; c++) {
        splits.push(practicalSplit(cameraNear, cameraFar, c, cascadeCount, 0.5));
    }
    const lightVP = [
        new Float32Array(16),
        new Float32Array(16),
        new Float32Array(16),
        new Float32Array(16),
    ];
    const atlasRects = [
        [0, 0, 0.5, 0.5],
        [0.5, 0, 1.0, 0.5],
        [0, 0.5, 0.5, 1.0],
        [0.5, 0.5, 1.0, 1.0],
    ];
    // Build cascades
    let prevSplit = cameraNear;
    for (let c = 0; c < cascadeCount; c++) {
        const splitNear = prevSplit;
        const splitFar = splits[c];
        prevSplit = splitFar;
        // Compute frustum corners (world space) for this slice
        const corners = new Array(8);
        let ci = 0;
        for (const d of [splitNear, splitFar]) {
            const h = tanHalfFovY * d;
            const w = h * aspect;
            const z = -d; // camera forward is -Z in view space
            const viewCorners = [
                [-w, -h, z],
                [w, -h, z],
                [w, h, z],
                [-w, h, z],
            ];
            for (let k = 0; k < 4; k++) {
                const vx = viewCorners[k][0];
                const vy = viewCorners[k][1];
                const vz = viewCorners[k][2];
                // Transform to world: invView * [vx,vy,vz,1]
                const x = vx * invView[0] + vy * invView[4] + vz * invView[8] + invView[12];
                const y = vx * invView[1] + vy * invView[5] + vz * invView[9] + invView[13];
                const zW = vx * invView[2] + vy * invView[6] + vz * invView[10] + invView[14];
                corners[ci++] = [x, y, zW];
            }
        }
        // Light view matrix (look from far away in light direction toward frustum center)
        let cx = 0, cy = 0, cz = 0;
        for (let i = 0; i < 8; i++) {
            const p = corners[i];
            cx += p[0];
            cy += p[1];
            cz += p[2];
        }
        cx /= 8;
        cy /= 8;
        cz /= 8;
        const center = [cx, cy, cz];
        const up = Math.abs(lightDirection[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0];
        const eye = [cx - lightDirection[0] * cameraFar, cy - lightDirection[1] * cameraFar, cz - lightDirection[2] * cameraFar];
        const lightView = new Float32Array(16);
        mat4LookAt(lightView, eye, center, up);
        // Transform corners to light space to compute ortho bounds
        let minX = Number.POSITIVE_INFINITY, minY = Number.POSITIVE_INFINITY, minZ = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY, maxZ = Number.NEGATIVE_INFINITY;
        for (let i = 0; i < 8; i++) {
            const p = corners[i];
            const lx = p[0] * lightView[0] + p[1] * lightView[4] + p[2] * lightView[8] + lightView[12];
            const ly = p[0] * lightView[1] + p[1] * lightView[5] + p[2] * lightView[9] + lightView[13];
            const lz = p[0] * lightView[2] + p[1] * lightView[6] + p[2] * lightView[10] + lightView[14];
            if (lx < minX)
                minX = lx;
            if (lx > maxX)
                maxX = lx;
            if (ly < minY)
                minY = ly;
            if (ly > maxY)
                maxY = ly;
            if (lz < minZ)
                minZ = lz;
            if (lz > maxZ)
                maxZ = lz;
        }
        // Stabilize by snapping center to texel grid
        const width = maxX - minX;
        const height = maxY - minY;
        const texelSizeX = width / (atlasSize * 0.5); // quadrant resolution (2048/2)
        const texelSizeY = height / (atlasSize * 0.5);
        let cxL = (minX + maxX) * 0.5;
        let cyL = (minY + maxY) * 0.5;
        cxL = Math.floor(cxL / texelSizeX) * texelSizeX;
        cyL = Math.floor(cyL / texelSizeY) * texelSizeY;
        minX = cxL - width * 0.5;
        maxX = cxL + width * 0.5;
        minY = cyL - height * 0.5;
        maxY = cyL + height * 0.5;
        // Expand Z range a bit to include casters slightly outside slice
        const zMargin = (maxZ - minZ) * 0.05 + 5.0;
        minZ -= zMargin;
        maxZ += zMargin;
        const lightProj = new Float32Array(16);
        mat4Ortho(lightProj, minX, maxX, minY, maxY, minZ, maxZ);
        const lvp = new Float32Array(16);
        mat4Multiply(lvp, lightProj, lightView);
        lightVP[c] = lvp;
    }
    const cascadeSplits = [
        splits[0] ?? cameraFar,
        splits[1] ?? cameraFar,
        splits[2] ?? cameraFar,
        cameraFar,
    ];
    return {
        lightViewProj: lightVP,
        cascadeSplits,
        atlasRects,
    };
}
//# sourceMappingURL=ShadowCascades.js.map