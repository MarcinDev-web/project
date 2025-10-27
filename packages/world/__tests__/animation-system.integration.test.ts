import { describe, it, expect } from 'vitest';
import { Scene } from '@engine/world';
import { AnimatorComponent, SkeletalBindingComponent } from '@engine/world';
import { AnimationSystem } from '@engine/world';
import { AnimatorController, createClip, createSkeleton } from '@engine/animation';

describe('AnimationSystem integration', () => {
  it('updates joint palette each frame', () => {
    const scene = new Scene('test');
    const entity = scene.createEntity('char');
    const anim = entity.addComponent(AnimatorComponent);
    const bind = entity.addComponent(SkeletalBindingComponent);

    // Minimal skeleton: 1 joint root with identity inverse bind
    const joints = [{ name: 'root' }];
    const parents = new Int16Array([ -1 ]);
    const ib = new Float32Array(16); ib[0]=1; ib[5]=1; ib[10]=1; ib[15]=1;
    const skeleton = createSkeleton(joints, parents, ib);
    anim.setSkeleton(skeleton);

    // Clip translating root along X from 0 to 1 (not strictly needed for palette)
    const times = new Float32Array([0, 1]);
    const values = new Float32Array([0,0,0, 1,0,0]);
    const clip = createClip('move', [{ kind:'translation', jointIndex:0, times, values, interpolation:'linear' } as any]);
    const ctrl = new AnimatorController().addState('S', clip);
    anim.controller = ctrl;

    const sys = new AnimationSystem(scene);
    sys.update(0.016);

    expect(bind.jointPalette).toBeTruthy();
    expect(bind!.jointPalette!.length).toBe(16);
  });
});


