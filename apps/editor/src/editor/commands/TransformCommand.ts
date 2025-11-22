/**
 * Command for entity transformation (move/resize)
 */
import type { Entity } from '@engine/world';
import type { UIElementComponent } from '@engine/world';
import { Vec2 } from '@engine/core';

export interface TransformState {
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export class TransformCommand {
  private readonly entityId: string;
  private readonly before: TransformState;
  private readonly after: TransformState;

  constructor(entity: Entity, before: TransformState, after: TransformState) {
    this.entityId = entity.id;
    this.before = before;
    this.after = after;
  }

  execute(scene: any): void {
    const entity = scene.findEntityById(this.entityId);
    if (!entity) return;
    
    const component = entity.getComponent('UIElementComponent');
    if (component) {
      component.position.x = this.after.position.x;
      component.position.y = this.after.position.y;
      component.size.width = this.after.size.width;
      component.size.height = this.after.size.height;
    }
  }

  undo(scene: any): void {
    const entity = scene.findEntityById(this.entityId);
    if (!entity) return;

    const component = entity.getComponent('UIElementComponent');
    if (component) {
      component.position.x = this.before.position.x;
      component.position.y = this.before.position.y;
      component.size.width = this.before.size.width;
      component.size.height = this.before.size.height;
    }
  }
}

