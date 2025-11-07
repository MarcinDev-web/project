import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const resolveFromRoot = (relativePath: string): string =>
  path.resolve(__dirname, relativePath);

export const createEditorAlias = (isBuild: boolean): Record<string, string> => {
  if (isBuild) {
    return {};
  }

  return {
    '@engine/animation': resolveFromRoot('../../packages/animation/src'),
    '@engine/animation/*': resolveFromRoot('../../packages/animation/src/*'),
    '@engine/core': resolveFromRoot('../../packages/core/src'),
    '@engine/core/*': resolveFromRoot('../../packages/core/src/*'),
    '@engine/world': resolveFromRoot('../../packages/world/src'),
    '@engine/world/*': resolveFromRoot('../../packages/world/src/*'),
    '@engine/world/components': resolveFromRoot('../../packages/world/src/components'),
    '@engine/world/components/*': resolveFromRoot('../../packages/world/src/components/*'),
    '@engine/world-templates': resolveFromRoot('../../packages/world-templates/src'),
    '@engine/world-templates/*': resolveFromRoot('../../packages/world-templates/src/*'),
    '@engine/gfx-webgpu': resolveFromRoot('../../packages/gfx-webgpu/src'),
    '@engine/gfx-webgpu/*': resolveFromRoot('../../packages/gfx-webgpu/src/*'),
    '@engine/assets': resolveFromRoot('../../packages/assets/src'),
    '@engine/assets/*': resolveFromRoot('../../packages/assets/src/*'),
    '@engine/script': resolveFromRoot('../../packages/script/src'),
    '@engine/script/*': resolveFromRoot('../../packages/script/src/*'),
    '@engine/input': resolveFromRoot('../../packages/input/src'),
    '@engine/input/*': resolveFromRoot('../../packages/input/src/*'),
    '@engine/camera': resolveFromRoot('../../packages/camera/src'),
    '@engine/camera/*': resolveFromRoot('../../packages/camera/src/*'),
    '@engine/avatar': resolveFromRoot('../../packages/avatar/src'),
    '@engine/avatar/*': resolveFromRoot('../../packages/avatar/src/*'),
    '@engine/stdlib': resolveFromRoot('../../packages/stdlib/src'),
    '@engine/stdlib/*': resolveFromRoot('../../packages/stdlib/src/*'),
    '@engine/wasm-collision': resolveFromRoot('../../packages/wasm-collision/src'),
    '@engine/wasm-collision/*': resolveFromRoot('../../packages/wasm-collision/src/*'),
    '@engine/net': resolveFromRoot('../../packages/net/src'),
    '@engine/net/*': resolveFromRoot('../../packages/net/src/*'),
    '@engine/net-protocol': resolveFromRoot('../../packages/net-protocol/src'),
    '@engine/net-protocol/*': resolveFromRoot('../../packages/net-protocol/src/*'),
    '@engine/editor-utils': resolveFromRoot('../../packages/editor-utils/src'),
    '@engine/editor-utils/*': resolveFromRoot('../../packages/editor-utils/src/*'),
    '@engine/economy': resolveFromRoot('../../packages/economy/src'),
    '@engine/economy/*': resolveFromRoot('../../packages/economy/src/*'),
    '@engine/voxel': resolveFromRoot('../../packages/voxel/src'),
    '@engine/voxel/*': resolveFromRoot('../../packages/voxel/src/*'),
    '@engine/voxel/terrain': resolveFromRoot('../../packages/voxel/src/terrain'),
    '@engine/voxel/terrain/*': resolveFromRoot('../../packages/voxel/src/terrain/*'),
  };
};


