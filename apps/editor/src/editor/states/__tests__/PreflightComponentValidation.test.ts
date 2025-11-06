import { describe, it, expect, beforeEach } from 'vitest';
import { Scene } from '@engine/world';
import { Entity } from '@engine/world';
import {
  LightComponent,
  PhysicsComponent,
  MeshComponent,
  MaterialComponent,
  HealthComponent,
  RigidbodyType,
  ColliderShape,
} from '@engine/world';
import { PreflightState } from '../PreflightState';
import { PlayModeStateType, type PlayModeContext } from '../../core/PlayModeStateMachine';

describe('PreflightState - Component Validation', () => {
  let scene: Scene;
  let context: PlayModeContext;

  beforeEach(() => {
    scene = new Scene('Preflight Component Validation');
    context = {
      authoringSnapshot: null,
      selectionPath: null,
      manifest: null,
      errors: [],
      warnings: [],
      data: new Map<string, any>(),
    };
  });

  describe('LightComponent validation', () => {
    it('reports error for negative intensity', () => {
      const entity = new Entity('Light');
      const light = new LightComponent();
      light.intensity = -1;
      entity.addComponent(light);
      scene.addEntity(entity);

      const preflight = new PreflightState({
        getScene: () => scene,
        isRendererReady: () => true,
      });

      preflight.onEnter(context);

      expect(context.errors.some((e) => e.includes('LightComponent') && e.includes('intensity'))).toBe(true);
    });

    it('reports warning for zero intensity', () => {
      const entity = new Entity('Light');
      const light = new LightComponent();
      light.intensity = 0;
      entity.addComponent(light);
      scene.addEntity(entity);

      const preflight = new PreflightState({
        getScene: () => scene,
        isRendererReady: () => true,
      });

      preflight.onEnter(context);

      expect(context.warnings.some((w) => w.includes('LightComponent') && w.includes('zero intensity'))).toBe(true);
    });

    it('reports error for invalid spot light range', () => {
      const entity = new Entity('SpotLight');
      const light = new LightComponent();
      light.lightType = 'spot';
      light.range = -1;
      entity.addComponent(light);
      scene.addEntity(entity);

      const preflight = new PreflightState({
        getScene: () => scene,
        isRendererReady: () => true,
      });

      preflight.onEnter(context);

      expect(context.errors.some((e) => e.includes('LightComponent') && e.includes('range'))).toBe(true);
    });

    it('reports error when innerConeAngle > outerConeAngle for spot light', () => {
      const entity = new Entity('SpotLight');
      const light = new LightComponent();
      light.lightType = 'spot';
      light.innerConeAngle = Math.PI / 2;
      light.outerConeAngle = Math.PI / 4;
      entity.addComponent(light);
      scene.addEntity(entity);

      const preflight = new PreflightState({
        getScene: () => scene,
        isRendererReady: () => true,
      });

      preflight.onEnter(context);

      expect(
        context.errors.some((e) => e.includes('LightComponent') && e.includes('innerConeAngle') && e.includes('outerConeAngle'))
      ).toBe(true);
    });
  });

  describe('PhysicsComponent validation', () => {
    it('reports error for invalid mass on dynamic body', () => {
      const entity = new Entity('PhysicsObject');
      const physics = new PhysicsComponent();
      physics.rigidbodyType = RigidbodyType.Dynamic;
      physics.mass = -1;
      entity.addComponent(physics);
      scene.addEntity(entity);

      const preflight = new PreflightState({
        getScene: () => scene,
        isRendererReady: () => true,
      });

      preflight.onEnter(context);

      expect(context.errors.some((e) => e.includes('PhysicsComponent') && e.includes('mass'))).toBe(true);
    });

    it('reports warning for physics component without colliders', () => {
      const entity = new Entity('PhysicsObject');
      const physics = new PhysicsComponent();
      physics.colliders = [];
      entity.addComponent(physics);
      scene.addEntity(entity);

      const preflight = new PreflightState({
        getScene: () => scene,
        isRendererReady: () => true,
      });

      preflight.onEnter(context);

      expect(context.warnings.some((w) => w.includes('PhysicsComponent') && w.includes('no colliders'))).toBe(true);
    });

    it('reports error for box collider with invalid size', () => {
      const entity = new Entity('PhysicsObject');
      const physics = new PhysicsComponent();
      physics.addBoxCollider([-1, 1, 1]);
      entity.addComponent(physics);
      scene.addEntity(entity);

      const preflight = new PreflightState({
        getScene: () => scene,
        isRendererReady: () => true,
      });

      preflight.onEnter(context);

      expect(context.errors.some((e) => e.includes('PhysicsComponent') && e.includes('size'))).toBe(true);
    });

    it('reports error for sphere collider with invalid radius', () => {
      const entity = new Entity('PhysicsObject');
      const physics = new PhysicsComponent();
      physics.addSphereCollider(-1);
      entity.addComponent(physics);
      scene.addEntity(entity);

      const preflight = new PreflightState({
        getScene: () => scene,
        isRendererReady: () => true,
      });

      preflight.onEnter(context);

      expect(context.errors.some((e) => e.includes('PhysicsComponent') && e.includes('radius'))).toBe(true);
    });
  });

  describe('MeshComponent validation', () => {
    it('reports error for invalid mesh type', () => {
      const entity = new Entity('Mesh');
      const mesh = new MeshComponent();
      (mesh as any).meshType = 'invalid_type';
      entity.addComponent(mesh);
      scene.addEntity(entity);

      const preflight = new PreflightState({
        getScene: () => scene,
        isRendererReady: () => true,
      });

      preflight.onEnter(context);

      expect(context.errors.some((e) => e.includes('MeshComponent') && e.includes('meshType'))).toBe(true);
    });

    it('reports error for custom mesh without meshData', () => {
      const entity = new Entity('CustomMesh');
      const mesh = new MeshComponent();
      mesh.meshType = 'custom';
      mesh.meshData = undefined;
      entity.addComponent(mesh);
      scene.addEntity(entity);

      const preflight = new PreflightState({
        getScene: () => scene,
        isRendererReady: () => true,
      });

      preflight.onEnter(context);

      expect(context.errors.some((e) => e.includes('MeshComponent') && e.includes('missing meshData'))).toBe(true);
    });
  });

  describe('MaterialComponent validation', () => {
    it('does not report error for materialId that was clamped to valid range', () => {
      const entity = new Entity('Material');
      const material = new MaterialComponent();
      // Setting a value that exceeds MAX_MATERIAL_ID will be clamped by the setter
      material.materialId = 100; // Exceeds MAX_MATERIAL_ID, will be clamped
      entity.addComponent(material);
      scene.addEntity(entity);

      const preflight = new PreflightState({
        getScene: () => scene,
        isRendererReady: () => true,
      });

      preflight.onEnter(context);

      // Should not have errors since the component clamps the value
      // The component handles validation internally
      expect(context.errors.some((e) => e.includes('MaterialComponent') && e.includes('materialId'))).toBe(false);
    });

    it('reports error for opacity out of range', () => {
      const entity = new Entity('Material');
      const material = new MaterialComponent();
      material.opacity = 2.0; // Out of [0,1] range
      entity.addComponent(material);
      scene.addEntity(entity);

      const preflight = new PreflightState({
        getScene: () => scene,
        isRendererReady: () => true,
      });

      preflight.onEnter(context);

      expect(context.errors.some((e) => e.includes('MaterialComponent') && e.includes('opacity'))).toBe(true);
    });
  });

  describe('HealthComponent validation', () => {
    it('reports error for invalid maxHealth', () => {
      const entity = new Entity('Health');
      const health = new HealthComponent();
      health.maxHealth = -1;
      entity.addComponent(health);
      scene.addEntity(entity);

      const preflight = new PreflightState({
        getScene: () => scene,
        isRendererReady: () => true,
      });

      preflight.onEnter(context);

      expect(context.errors.some((e) => e.includes('HealthComponent') && e.includes('maxHealth'))).toBe(true);
    });

    it('does not report warning when currentHealth is clamped to maxHealth', () => {
      const entity = new Entity('Health');
      const health = new HealthComponent();
      health.maxHealth = 100;
      // Setting currentHealth > maxHealth will be clamped by the setter
      health.currentHealth = 150; // Will be clamped to maxHealth
      entity.addComponent(health);
      scene.addEntity(entity);

      const preflight = new PreflightState({
        getScene: () => scene,
        isRendererReady: () => true,
      });

      preflight.onEnter(context);

      // Should not have warnings since the component clamps the value
      // The component handles validation internally
      expect(
        context.warnings.some((w) => w.includes('HealthComponent') && w.includes('currentHealth') && w.includes('maxHealth'))
      ).toBe(false);
    });
  });

  describe('Multiple components validation', () => {
    it('validates all components on an entity', () => {
      const entity = new Entity('MultiComponent');
      const light = new LightComponent();
      light.intensity = -1;
      entity.addComponent(light);

      const health = new HealthComponent();
      health.maxHealth = -1;
      entity.addComponent(health);

      scene.addEntity(entity);

      const preflight = new PreflightState({
        getScene: () => scene,
        isRendererReady: () => true,
      });

      preflight.onEnter(context);

      expect(context.errors.some((e) => e.includes('LightComponent'))).toBe(true);
      expect(context.errors.some((e) => e.includes('HealthComponent'))).toBe(true);
    });

    it('passes validation when all components are valid', () => {
      const entity = new Entity('ValidEntity');
      const light = new LightComponent();
      light.intensity = 1.0;
      light.lightType = 'directional';
      entity.addComponent(light);

      const mesh = new MeshComponent();
      mesh.meshType = 'cube';
      entity.addComponent(mesh);

      const material = new MaterialComponent();
      material.materialId = 0;
      material.opacity = 1.0;
      entity.addComponent(material);

      scene.addEntity(entity);

      const preflight = new PreflightState({
        getScene: () => scene,
        isRendererReady: () => true,
      });

      preflight.onEnter(context);

      // Should have no component-related errors
      const componentErrors = context.errors.filter(
        (e) =>
          e.includes('LightComponent') ||
          e.includes('MeshComponent') ||
          e.includes('MaterialComponent') ||
          e.includes('PhysicsComponent') ||
          e.includes('HealthComponent')
      );
      expect(componentErrors.length).toBe(0);
    });
  });
});

