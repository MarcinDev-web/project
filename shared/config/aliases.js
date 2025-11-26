import path from 'path';
import fs from 'fs';
const pickPackagesRoot = (rootDir) => {
    const candidates = [
        path.resolve(rootDir, 'packages'),
        path.resolve(rootDir, '../packages'),
        path.resolve(rootDir, '../../packages'),
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate))
            return candidate;
    }
    // Fallback: assume two levels up (apps/* case)
    return path.resolve(rootDir, '../../packages');
};
const pickSharedRoot = (rootDir) => {
    const candidates = [
        path.resolve(rootDir, 'shared'),
        path.resolve(rootDir, '../shared'),
        path.resolve(rootDir, '../../shared'),
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate))
            return candidate;
    }
    return path.resolve(rootDir, '../../shared');
};
/**
 * Returns Vite/Vitest-compatible alias map for @engine/* packages
 * Pass __dirname of the consuming config file.
 */
export const engineAliases = (rootDir) => {
    const pkgs = pickPackagesRoot(rootDir);
    const shared = pickSharedRoot(rootDir);
    const p = (...segs) => path.resolve(pkgs, ...segs);
    return {
        '@engine/core': p('core/src'),
        '@engine/animation': p('animation/src'),
        '@engine/avatar': p('avatar/src'),
        '@engine/camera': p('camera/src'),
        '@engine/editor-utils': p('editor-utils/src'),
        '@engine/stdlib': p('stdlib/src'),
        '@engine/world': p('world/src'),
        '@engine/world/components': p('world/src/components'),
        '@engine/world/physics': p('world/src/physics'),
        // Prefer explicit file mapping for reliability on Windows
        '@engine/world-templates': p('world-templates/src/index.ts'),
        '@engine/world-templates/*': p('world-templates/src/*'),
        '@engine/gfx-webgpu': p('gfx-webgpu/src'),
        '@engine/script': p('script/src'),
        '@engine/input': p('input/src'),
        '@engine/economy': p('economy/src'),
        '@engine/blocks': p('blocks/src'),
        '@engine/microblocks': p('microblocks/src'),
        '@engine/net': p('net/src'),
        '@engine/net-protocol': p('net-protocol/src'),
        '@engine/voxel': p('voxel/src'),
        '@engine/voxel/terrain': p('voxel/src/terrain'),
        '@engine/wasm-collision': p('wasm-collision/src'),
        '@engine/wasm-physics': p('wasm-physics/src'),
        '@engine/wasm-voxel': p('wasm-voxel/src'),
        '@engine/wasm-animation': p('wasm-animation/src'),
        '@engine/wasm-mesh': p('wasm-mesh/src'),
        '@engine/wasm-render-logic': p('wasm-render-logic/src'),
        '@shared': shared,
        '@shared/types': path.resolve(shared, 'types'),
    };
};
//# sourceMappingURL=aliases.js.map