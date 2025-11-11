/**
 * Example: Using GPU-accelerated texture generation
 * 
 * This example shows how to initialize and use GPU-accelerated
 * procedural texture generation in TextureManager.
 */

import { TextureManager } from './TextureManager';
import { PipelineCache } from '../pipeline/PipelineCache';
import type { BlockFaceTexture } from '@engine/blocks';

/**
 * Example: Initialize TextureManager with GPU support
 */
export async function initializeTextureManagerWithGPU(device: GPUDevice): Promise<TextureManager> {
  // Create pipeline cache for optimization
  const pipelineCache = new PipelineCache(device);
  
  // Create TextureManager with GPU support
  const textureManager = new TextureManager(device, 128, pipelineCache);
  
  // Or initialize GPU support later:
  // textureManager.initializeGPU(device, pipelineCache);
  
  return textureManager;
}

/**
 * Example: Generate texture using GPU (with CPU fallback)
 */
export async function generateTextureExample(textureManager: TextureManager): Promise<void> {
  const faceTexture: BlockFaceTexture = {
    color: [0.9, 0.2, 0.2, 1], // Red
    pattern: 'noise',
    brightness: 1.0,
  };
  
  // This will use GPU if available, fallback to CPU automatically
  const texture = await textureManager.loadTexture('red_noise_block', faceTexture);
  
  console.log('Generated texture:', texture.id);
  console.log('Is procedural:', texture.isProcedural);
  console.log('Texture size:', texture.albedo.width, 'x', texture.albedo.height);
}

/**
 * Example: Batch texture generation (GPU-accelerated)
 */
export async function batchGenerateTextures(textureManager: TextureManager): Promise<void> {
  const textures = [
    { id: 'grass', faceTexture: { color: [0.3, 0.7, 0.2, 1], pattern: 'noise', brightness: 1.0 } },
    { id: 'stone', faceTexture: { color: [0.6, 0.6, 0.6, 1], pattern: 'cobble', brightness: 1.0 } },
    { id: 'wood', faceTexture: { color: [0.6, 0.4, 0.2, 1], pattern: 'planks', brightness: 1.0 } },
  ];
  
  // All textures will be generated in parallel, using GPU if available
  const results = await textureManager.loadBatch(
    textures.map(t => ({ id: t.id, faceTexture: t.faceTexture as BlockFaceTexture }))
  );
  
  console.log(`Generated ${results.length} textures`);
}

/**
 * Example: Using globalTextureManager (CPU-only by default)
 */
export async function useGlobalTextureManager(): Promise<void> {
  // Import globalTextureManager
  const { globalTextureManager } = await import('./TextureManager');
  
  // Initialize GPU support if you have a device
  // globalTextureManager.initializeGPU(device, pipelineCache);
  
  // Use it normally - will use CPU, or GPU if initialized
  const texture = await globalTextureManager.loadTexture('test', {
    color: [1, 1, 1, 1],
    pattern: 'solid',
    brightness: 1.0,
  });
  
  console.log('Texture loaded:', texture.id);
}

