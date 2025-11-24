import { SDFRenderer } from '../sdf/SDFRenderer';
import type { Renderer } from './Renderer';
import { Logger } from '@engine/core/utils';
import { mat4Invert, type Mat4 } from '@engine/core/math';

/**
 * SDF Test Harness
 * 
 * This utility class allows injecting the SDF Renderer into the main render loop
 * for testing and demonstration purposes without disrupting the main engine.
 */
export class SDFTestHarness {
  private sdfRenderer: SDFRenderer | null = null;
  private active = false;
  private device: GPUDevice;
  private canvas: HTMLCanvasElement;
  private context: GPUCanvasContext;
  private presentationFormat: GPUTextureFormat;
  private invViewProj = new Float32Array(16);

  constructor(
    device: GPUDevice,
    canvas: HTMLCanvasElement,
    context: GPUCanvasContext,
    presentationFormat: GPUTextureFormat
  ) {
    this.device = device;
    this.canvas = canvas;
    this.context = context;
    this.presentationFormat = presentationFormat;
  }

  async initialize() {
    if (this.sdfRenderer) return;

    this.sdfRenderer = new SDFRenderer();
    await this.sdfRenderer.initialize(this.device, this.presentationFormat);
    Logger.info('SDF Test Harness Initialized');
  }

  toggle() {
    this.active = !this.active;
    Logger.info(`SDF Render Mode: ${this.active ? 'ACTIVE' : 'INACTIVE'}`);
    
    // If activating, ensure initialized
    if (this.active && !this.sdfRenderer) {
      this.initialize().catch(err => {
        Logger.error('Failed to initialize SDF Renderer', err);
        this.active = false;
      });
    }
  }

  isActive(): boolean {
    return this.active;
  }

  update(time: number) {
    if (!this.active || !this.sdfRenderer) return;
    
    // Animate parameters
    this.sdfRenderer.updateParams({
      time: time,
      smoothness: 0.5 + Math.sin(time * 0.5) * 0.3 // Vary smoothness over time
    });
  }

  render(
    passEncoder: GPURenderPassEncoder,
    viewProjectionMatrix: Float32Array,
    cameraPosition: Float32Array | number[]
  ) {
    if (!this.active || !this.sdfRenderer) return;

    // Invert VP matrix
    mat4Invert(this.invViewProj, viewProjectionMatrix as unknown as Mat4);

    this.sdfRenderer.render(passEncoder, this.invViewProj, cameraPosition);
  }
  
  dispose() {
    if (this.sdfRenderer) {
      this.sdfRenderer.dispose();
      this.sdfRenderer = null;
    }
  }
}

