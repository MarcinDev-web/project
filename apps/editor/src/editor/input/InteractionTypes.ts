import type { Ray } from '@engine/world';

export interface InteractionTool {
  name: string;
  
  /**
   * Checks if this tool wants to handle the input at the given ray.
   * Used for both hover prioritization and click handling.
   * 
   * @param ray The ray from camera
   * @returns true if the tool claims priority (e.g. hovering a handle or active placement mode)
   */
  checkHit(ray: Ray): boolean;

  /**
   * Called when the tool becomes active (mousedown on a claimed hit).
   */
  onPointerDown(event: PointerEvent, ray: Ray): void;

  /**
   * Called on mouse move. 
   * If the tool is active (dragging), it always receives this.
   * If no tool is active, this is called if checkHit() returned true (hover).
   */
  onPointerMove(event: PointerEvent, ray: Ray): void;

  /**
   * Called on mouse up if the tool was active.
   */
  onPointerUp(event: PointerEvent, ray: Ray): void;

  /**
   * Called on mouse wheel event.
   */
  onWheel?(event: WheelEvent): void;

  /**
   * Called to cancel the current operation (e.g. Esc key).
   */
  cancel(): void;
}

