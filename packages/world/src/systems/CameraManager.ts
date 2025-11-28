/**
 * CameraManager - Handles camera registration and management for scenes.
 *
 * Extracted from Scene to provide cleaner separation of concerns.
 */

import type { Entity, EntityId } from '../core/Entity.js';
import { CameraComponent } from '../components/CameraComponent.js';

/**
 * CameraManager handles camera registration, lookup, and primary camera selection.
 */
export class CameraManager {
  /** Scene cameras indexed by entity id */
  private _cameraMap = new Map<EntityId, Entity>();
  /** Cached primary camera entity id */
  private _primaryCameraId: EntityId | null = null;

  /**
   * Returns the primary camera entity if present.
   */
  get primaryCamera(): Entity | null {
    if (this._primaryCameraId) {
      const entity = this._cameraMap.get(this._primaryCameraId);
      if (entity) {
        return entity;
      }
      this._primaryCameraId = null;
    }
    return null;
  }

  /**
   * Returns all entities that have a camera component.
   */
  get cameras(): Entity[] {
    return Array.from(this._cameraMap.values());
  }

  /**
   * Sets the primary camera entity.
   * @param entity - The entity to set as primary camera, or null to clear.
   * @throws Error if entity is not registered as a camera.
   */
  setPrimaryCamera(entity: Entity | null): void {
    if (entity === null) {
      this._primaryCameraId = null;
      for (const cameraEntity of this._cameraMap.values()) {
        const cameraComponent = cameraEntity.getComponent(CameraComponent);
        if (cameraComponent) {
          cameraComponent.primary = false;
        }
      }
      this.ensurePrimaryCamera();
      return;
    }

    if (!this._cameraMap.has(entity.id)) {
      throw new Error('Primary camera must be registered and have a CameraComponent');
    }

    this._setPrimaryCamera(entity);
  }

  /**
   * Registers a camera entity.
   * @param entity - The entity with a CameraComponent.
   * @param camera - The CameraComponent instance.
   */
  registerCamera(entity: Entity, camera: CameraComponent): void {
    this._cameraMap.set(entity.id, entity);
    if (camera.primary) {
      this._setPrimaryCamera(entity);
    }
  }

  /**
   * Unregisters a camera entity.
   * @param entity - The entity to unregister.
   */
  unregisterCamera(entity: Entity): void {
    if (!this._cameraMap.has(entity.id)) return;
    this._cameraMap.delete(entity.id);
    if (this._primaryCameraId === entity.id) {
      this._primaryCameraId = null;
    }
  }

  /**
   * Checks if a camera is registered.
   * @param entityId - The entity ID to check.
   */
  hasCamera(entityId: EntityId): boolean {
    return this._cameraMap.has(entityId);
  }

  /**
   * Ensures a primary camera is set if any cameras exist.
   */
  ensurePrimaryCamera(): void {
    if (this._primaryCameraId && this._cameraMap.has(this._primaryCameraId)) {
      return;
    }

    const cameras = Array.from(this._cameraMap.values());
    const fallback =
      cameras.find((entity) => {
        const camera = entity.getComponent(CameraComponent);
        return camera?.primary;
      }) ??
      cameras[0] ??
      null;

    if (fallback) {
      this._setPrimaryCamera(fallback);
    }
  }

  /**
   * Internal method to set primary camera and update component flags.
   */
  private _setPrimaryCamera(entity: Entity): void {
    for (const cameraEntity of this._cameraMap.values()) {
      const component = cameraEntity.getComponent(CameraComponent);
      if (component) {
        component.primary = cameraEntity === entity;
      }
    }
    this._primaryCameraId = entity.id;
  }

  /**
   * Clears all camera registrations.
   */
  clear(): void {
    this._cameraMap.clear();
    this._primaryCameraId = null;
  }
}

