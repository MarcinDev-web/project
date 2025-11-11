/**
 * Integration: Initialize TextureManager with GPU support from Renderer
 * 
 * This shows how to integrate GPU-accelerated texture generation
 * with the existing Renderer system.
 */

import { TextureManager } from '../textures/TextureManager';
import { PipelineCache } from '../pipeline/PipelineCache';
import type { Renderer } from './Renderer';

/**
 * Initialize TextureManager with GPU support using device from Renderer
 * 
 * @param renderer - The initialized Renderer instance
 * @param textureSize - Size of procedural textures (default: 128)
 * @returns TextureManager with GPU acceleration enabled
 */
export function createTextureManagerWithGPU(
  renderer: Renderer,
  textureSize: number = 128
): TextureManager {
  // Get GPU device from renderer
  const device = renderer.getDevice();
  
  // Create pipeline cache for optimization (reuse if available)
  // Note: You might want to share PipelineCache instance across systems
  const pipelineCache = new PipelineCache(device);
  
  // Create TextureManager with GPU support
  const textureManager = new TextureManager(device, textureSize, pipelineCache);
  
  return textureManager;
}

/**
 * Initialize global TextureManager with GPU support
 * 
 * This updates the globalTextureManager instance to use GPU acceleration.
 * Useful if you're already using globalTextureManager elsewhere.
 * 
 * @param renderer - The initialized Renderer instance
 */
export function initializeGlobalTextureManagerWithGPU(renderer: Renderer): void {
  const { globalTextureManager } = require('../textures/TextureManager');
  const device = renderer.getDevice();
  const pipelineCache = new PipelineCache(device);
  
  // Initialize GPU support on global instance
  globalTextureManager.initializeGPU(device, pipelineCache);
}

/**
 * Example usage in renderer initialization
 */
export async function exampleRendererIntegration() {
  // Assuming you have a renderer instance
  // const renderer = await initRenderer({ canvas, statusEl, getOrbitState });
  
  // Option 1: Create new TextureManager with GPU support
  // const textureManager = createTextureManagerWithGPU(renderer, 128);
  
  // Option 2: Initialize global TextureManager with GPU support
  // initializeGlobalTextureManagerWithGPU(renderer);
  
  // Now all texture generation will use GPU acceleration automatically
  // const texture = await textureManager.loadTexture('my_texture', {
  //   color: [0.9, 0.2, 0.2, 1],
  //   pattern: 'noise',
  //   brightness: 1.0,
  // });
}

