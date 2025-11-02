import { describe, it, expect, beforeEach } from 'vitest';
import { Scene } from '@engine/world';
import { Entity } from '@engine/world';
import { ScriptComponent } from '@engine/script';
import { PreflightState } from '../PreflightState';
import { PlayModeStateType, type PlayModeContext } from '../../core/PlayModeStateMachine';
import { BehaviorInstance, type BehaviorConstructor } from '@engine/script';
import { BehaviorRegistry } from '@engine/script';

describe('PreflightState - Script Validation', () => {
  let scene: Scene;
  let context: PlayModeContext;

  beforeEach(() => {
    scene = new Scene('Preflight Script Validation');
    context = {
      authoringSnapshot: null,
      selectionPath: null,
      manifest: null,
      errors: [],
      warnings: [],
      data: new Map<string, any>(),
    };
  });

  it('fails when an entity references an unregistered script', () => {
    const entity = new Entity('Actor');
    const scripts = new ScriptComponent();
    scripts.fromJSON({ scripts: [{ name: 'MissingBehavior' }] });
    entity.addComponent(scripts);
    scene.addEntity(entity);

    const preflight = new PreflightState({
      getScene: () => scene,
      isRendererReady: () => true,
    });

    preflight.onEnter(context);

    expect(context.errors.length).toBeGreaterThan(0);
    expect(context.errors.some((e) => e.includes('MissingBehavior'))).toBe(true);

    const next = preflight.onUpdate(0, context);
    expect(next).toBe(PlayModeStateType.EDIT);
  });

  it('passes when all scripts are registered', () => {
    class TestBehavior extends BehaviorInstance {}
    BehaviorRegistry.register('TestBehavior', TestBehavior as unknown as BehaviorConstructor);

    const entity = new Entity('Actor');
    const scripts = new ScriptComponent();
    scripts.fromJSON({ scripts: [{ name: 'TestBehavior' }] });
    entity.addComponent(scripts);
    scene.addEntity(entity);

    const preflight = new PreflightState({
      getScene: () => scene,
      isRendererReady: () => true,
    });

    preflight.onEnter(context);

    expect(context.errors.length).toBe(0);
    const next = preflight.onUpdate(0, context);
    expect(next).toBe(PlayModeStateType.LOADING);
  });
});



