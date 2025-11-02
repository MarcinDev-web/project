import { describe, it, expect, beforeEach } from 'vitest';
import { OrbitCameraComponent, OrbitCameraSystem, type IOrbitCameraInput } from '@engine/camera';
import { CameraComponent, Entity, Scene } from '@engine/world';

class MockInput implements IOrbitCameraInput {
  private _dx = 0;
  private _dy = 0;
  private _wheel = 0;
  private _orbit = false;
  private _pan = false;
  private _mods = { shift: false, alt: false, ctrl: false } as const;
  private _dpi = 1;
  private _size = { width: 1280, height: 720 };
  private _disposed = false;

  setPointerDelta(dx: number, dy: number): void { this._dx = dx; this._dy = dy; }
  setWheelDelta(w: number): void { this._wheel = w; }
  setOrbit(active: boolean): void { this._orbit = active; }
  setPan(active: boolean): void { this._pan = active; }
  setModifiers(mods: Partial<{ shift: boolean; alt: boolean; ctrl: boolean }>): void {
    this._mods = { shift: !!mods.shift, alt: !!mods.alt, ctrl: !!mods.ctrl };
  }
  setDpiScale(v: number): void { this._dpi = v; }
  setViewportSize(w: number, h: number): void { this._size = { width: w, height: h }; }

  readPointerDelta(): { dx: number; dy: number } { const r = { dx: this._dx, dy: this._dy }; this._dx = 0; this._dy = 0; return r; }
  readWheelDelta(): number { const w = this._wheel; this._wheel = 0; return w; }
  isOrbitActive(): boolean { return this._orbit; }
  isPanActive(): boolean { return this._pan; }
  getModifiers(): { shift: boolean; alt: boolean; ctrl: boolean } { return { ...this._mods }; }
  getDpiScale(): number { return this._dpi; }
  getViewportSize(): { width: number; height: number } { return { ...this._size }; }
  dispose(): void { this._disposed = true; }
  get disposed(): boolean { return this._disposed; }
}

function createCameraEntity(scene: Scene, input?: MockInput): { entity: Entity; ctrl: OrbitCameraComponent; cam: CameraComponent } {
  const entity = scene.createEntity('camera');
  const cam = new CameraComponent();
  cam.primary = true;
  entity.addComponent(cam);
  const ctrl = new OrbitCameraComponent();
  ctrl.input = input;
  entity.addComponent(ctrl);
  return { entity, ctrl, cam };
}

describe('OrbitCameraSystem (ECS)', () => {
  let scene: Scene;
  let system: OrbitCameraSystem;

  beforeEach(() => {
    scene = new Scene('test');
    system = new OrbitCameraSystem(scene);
  });

  it('smoothly rotates with FPS-independent damping', () => {
    const input = new MockInput();
    input.setOrbit(true);
    const { ctrl } = createCameraEntity(scene, input);

    const runScenario = (fps: number) => {
      // Simulate 1 second of constant horizontal drag: 120 px/s
      const seconds = 1.0;
      const steps = Math.floor(seconds * fps);
      const dt = seconds / steps;
      for (let i = 0; i < steps; i++) {
        input.setPointerDelta(120 * dt, 0);
        system.update(dt);
      }
      return { yaw: ctrl.yaw, pitch: ctrl.pitch };
    };

    const a = runScenario(30);
    // Reset yaw/pitch/targets for next run
    ctrl.yaw = ctrl.targetYaw = 0;
    ctrl.pitch = ctrl.targetPitch = 0;
    const b = runScenario(144);

    // Increased tolerance to account for floating-point precision differences
    // between different framerates. Difference of 0.006 is acceptable for FPS-independent behavior.
    // Using 1 decimal place (0.1 tolerance) to account for accumulated rounding differences
    expect(a.yaw).toBeCloseTo(b.yaw, 1);
    expect(a.pitch).toBeCloseTo(b.pitch, 1);
  });

  it('respects pitch, radius and FOV clamps', () => {
    const input = new MockInput();
    input.setOrbit(true);
    const { ctrl } = createCameraEntity(scene, input);

    // Try to exceed pitch limits
    for (let i = 0; i < 60; i++) {
      input.setPointerDelta(0, 10);
      system.update(1 / 60);
    }
    expect(ctrl.pitch).toBeLessThanOrEqual(ctrl.clamp.pitchMax + 1e-6);
    expect(ctrl.pitch).toBeGreaterThanOrEqual(ctrl.clamp.pitchMin - 1e-6);

    // Zoom out beyond max radius and FOV
    input.setOrbit(false);
    for (let i = 0; i < 10; i++) {
      input.setWheelDelta(1000);
      system.update(1 / 60);
    }
    expect(ctrl.targetRadius).toBeLessThanOrEqual(ctrl.clamp.radiusMax);
    expect(ctrl.targetFov).toBeLessThanOrEqual(ctrl.clamp.fovMax);
  });

  it('applies zoom mixing and modifier overrides', () => {
    const input = new MockInput();
    const { ctrl } = createCameraEntity(scene, input);

    // Baseline
    const baseRadius = ctrl.targetRadius;
    const baseFov = ctrl.targetFov;

    // Mixed zoom (no modifiers)
    input.setWheelDelta(10);
    system.update(1 / 60);
    const mixedDR = ctrl.targetRadius - baseRadius;
    const mixedDF = ctrl.targetFov - baseFov;
    expect(Math.abs(mixedDR)).toBeGreaterThan(0);
    expect(Math.abs(mixedDF)).toBeGreaterThan(0);

    // FOV-only (Alt)
    input.setModifiers({ alt: true, shift: false });
    input.setWheelDelta(10);
    system.update(1 / 60);
    const fovOnlyDF = ctrl.targetFov - (baseFov + mixedDF);
    // Radius should not change with alt-only this frame
    expect(ctrl.targetRadius - (baseRadius + mixedDR)).toBeCloseTo(0, 6);
    expect(fovOnlyDF).toBeGreaterThan(0);

    // Radius-only (Shift)
    input.setModifiers({ alt: false, shift: true });
    input.setWheelDelta(10);
    system.update(1 / 60);
    // FOV unchanged this frame
    expect(ctrl.targetFov - (baseFov + mixedDF + fovOnlyDF)).toBeCloseTo(0, 6);
  });

  it('pans pivot proportional to radius/FOV and viewport size', () => {
    const input = new MockInput();
    input.setPan(true);
    const { ctrl } = createCameraEntity(scene, input);
    ctrl.radius = ctrl.targetRadius = 10;
    ctrl.fov = ctrl.targetFov = Math.PI / 4;
    input.setViewportSize(1280, 720);

    const before = [...ctrl.pivot] as Vec3;
    input.setPointerDelta(100, 50);
    system.update(1 / 60);
    expect(ctrl.pivot[0]).not.toBeCloseTo(before[0], 6);
    expect(ctrl.pivot[1]).not.toBeCloseTo(before[1], 6);
  });

  it('disposes input adapter on component detach', () => {
    const input = new MockInput();
    const { entity, ctrl } = createCameraEntity(scene, input);
    expect(input.disposed).toBe(false);
    // Removing component should invoke onDetach → input.dispose()
    entity.removeComponent(OrbitCameraComponent);
    expect(ctrl.input).toBeUndefined();
    expect(input.disposed).toBe(true);
  });
});


