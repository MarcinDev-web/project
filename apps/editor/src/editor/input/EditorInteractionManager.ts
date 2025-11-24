import type { OrbitControls, CameraDirector } from '@engine/camera';
import type { Ray } from '@engine/world';
import { Raycaster } from '@engine/world';
import type { Mat4 } from '@engine/core/math';
import { mat4Perspective, mat4LookAt } from '@engine/core/math';
import { FOV_RADIANS, Z_NEAR, Z_FAR } from '@engine/gfx-webgpu/config';
import { Logger } from '../../utils/logger';
import type { InteractionTool } from './InteractionTypes';

export interface EditorInteractionManagerConfig {
  canvas: HTMLCanvasElement;
  controls: OrbitControls;
  cameraDirector?: CameraDirector | undefined;
}

/**
 * EditorInteractionManager - The "Conductor" of input.
 * 
 * Centralizes event listeners and raycasting.
 * Delegates control to registered tools based on priority (Chain of Responsibility).
 */
export class EditorInteractionManager {
  private tools: InteractionTool[] = [];
  private activeTool: InteractionTool | null = null;
  private raycaster = new Raycaster();
  private abortController: AbortController | null = null;

  constructor(private readonly config: EditorInteractionManagerConfig) {}

  /**
   * Initializes event listeners.
   */
  public initialize(): () => void {
    this.abortController = new AbortController();
    const { canvas } = this.config;
    const signal = this.abortController.signal;

    // Use window for move/up to handle dragging outside canvas
    canvas.addEventListener('pointerdown', this.handlePointerDown, { signal });
    window.addEventListener('pointermove', this.handlePointerMove, { signal });
    window.addEventListener('pointerup', this.handlePointerUp, { signal });
    canvas.addEventListener('wheel', this.handleWheel, { signal, passive: false });
    window.addEventListener('keydown', this.handleKeyDown, { signal });

    // Prevent context menu on canvas
    canvas.addEventListener('contextmenu', (e) => e.preventDefault(), { signal });

    Logger.debug('EditorInteractionManager initialized');

    return () => this.dispose();
  }

  /**
   * Registers a tool. Order matters (Priority: First > Last).
   */
  public registerTool(tool: InteractionTool): void {
    this.tools.push(tool);
    Logger.debug(`Registered interaction tool: ${tool.name}`);
  }

  private handlePointerDown = (event: PointerEvent) => {
    // Only handle main button (0)
    if (event.button !== 0) return;
    
    // Ignore if not on canvas
    if (event.target !== this.config.canvas) return;

    const ray = this.createRay(event);
    if (!ray) return;

    // Find tool that wants to handle this interaction
    for (const tool of this.tools) {
      if (tool.checkHit(ray)) {
        this.activeTool = tool;
        // Prevent default to stop native behavior (text selection, etc.)
        // and to prevent 'click' event if we are handling it as an interaction
        event.preventDefault();
        this.activeTool.onPointerDown(event, ray);
        return;
      }
    }
  };

  private handlePointerMove = (event: PointerEvent) => {
    const ray = this.createRay(event);
    if (!ray) return;

    if (this.activeTool) {
      // If we have an active tool (dragging), only it gets the move
      event.preventDefault();
      this.activeTool.onPointerMove(event, ray);
    } else {
      // No active tool: Check for hover effects
      // Iterate tools in priority order. First one to claim hit gets the move event.
      for (const tool of this.tools) {
        if (tool.checkHit(ray)) {
          // We don't prevent default here to allow other hover effects if needed, 
          // but usually we want to consume it if a tool claims it.
          // However, for hover, preventing default might block UI interactions if canvas overlaps?
          // Canvas usually captures pointer events.
          tool.onPointerMove(event, ray);
          return; // Stop propagation
        }
      }
    }
  };

  private handlePointerUp = (event: PointerEvent) => {
    const ray = this.createRay(event);
    if (!ray) return;

    if (this.activeTool) {
      event.preventDefault();
      this.activeTool.onPointerUp(event, ray);
      this.activeTool = null; // Release lock
    }
  };

  private handleWheel = (event: WheelEvent) => {
    // Active tool gets priority
    if (this.activeTool && this.activeTool.onWheel) {
        event.preventDefault();
        this.activeTool.onWheel(event);
        return;
    }

    // Else check hover tools
    const ray = this.createRay(event);
    if (!ray) return; // Should we allow scroll even if ray fails? Usually yes for camera.

    for (const tool of this.tools) {
        if (tool.checkHit(ray) && tool.onWheel) {
            // Should we consume? Usually yes if tool claims it.
            // But if tool decides not to use it?
            // We assume onWheel implementation decides whether to prevent default or not.
            // But here we delegate.
            // Let's assume if tool claims hit, it wants the wheel.
            event.preventDefault();
            tool.onWheel(event);
            return;
        }
    }
  };

  private handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      if (this.activeTool) {
        this.activeTool.cancel();
        this.activeTool = null;
        event.preventDefault();
      } else {
        // Notify all tools to cancel any pending state (like placement ghost)
        this.tools.forEach(t => t.cancel());
      }
    }
  };

  public dispose(): void {
    this.abortController?.abort();
    this.activeTool = null;
    this.tools = [];
    Logger.debug('EditorInteractionManager disposed');
  }

  /**
   * Creates a world-space ray from a pointer event.
   * Unifies logic from all controllers.
   */
  private createRay(event: PointerEvent | MouseEvent): Ray | null {
    const rect = this.config.canvas.getBoundingClientRect();
    // Calculate mouse position in canvas coordinates (accounting for canvas size vs display size)
    const canvasDisplayWidth = rect.width;
    const canvasDisplayHeight = rect.height;
    const canvasInternalWidth = this.config.canvas.width;
    const canvasInternalHeight = this.config.canvas.height;
    
    const mouseX = ((event.clientX - rect.left) / canvasDisplayWidth) * canvasInternalWidth;
    const mouseY = ((event.clientY - rect.top) / canvasDisplayHeight) * canvasInternalHeight;

    // Prefer CameraDirector matrices (supports free-fly/FPS/third-person)
    const director = this.config.cameraDirector;
    if (director) {
      const viewMatrix = director.getViewMatrix();
      const projectionMatrix = director.getProjectionMatrix();
      
      if (viewMatrix && projectionMatrix && viewMatrix.length === 16 && projectionMatrix.length === 16) {
         return this.raycaster.createRayFromScreen(
            mouseX,
            mouseY,
            canvasInternalWidth,
            canvasInternalHeight,
            viewMatrix,
            projectionMatrix
          );
      }
    }

    // Fallback to orbit controls
    try {
      const { yaw, pitch, distance } = this.config.controls.getState();
      const aspect = canvasInternalWidth / canvasInternalHeight;

      const projectionMatrix = new Float32Array(16) as Mat4;
      const viewMatrix = new Float32Array(16) as Mat4;

      mat4Perspective(projectionMatrix, FOV_RADIANS, aspect, Z_NEAR, Z_FAR);

      const eyeX = Math.cos(pitch) * Math.sin(yaw) * distance;
      const eyeY = Math.sin(pitch) * distance;
      const eyeZ = Math.cos(pitch) * Math.cos(yaw) * distance;
      mat4LookAt(viewMatrix, [eyeX, eyeY, eyeZ], [0, 0, 0], [0, 1, 0]);

      return this.raycaster.createRayFromScreen(
        mouseX,
        mouseY,
        canvasInternalWidth,
        canvasInternalHeight,
        viewMatrix,
        projectionMatrix
      );
    } catch (error) {
      return null;
    }
  }
}
