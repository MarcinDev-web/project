import { describe, it, expect, beforeEach } from 'vitest';
import { Scene } from '@engine/world';
import { Entity } from '@engine/world';
import { AnimationComponent } from '@engine/world';
import { AnimationClip } from '../animation/AnimationClip';
import { AnimationSystem } from '../animation/AnimationSystem';
import { Skeleton } from '../animation/Skeleton';
import { createTestClip } from './helpers/animationTestUtils';

const IDENTITY_QUAT: [number, number, number, number] = [0, 0, 0, 1];

let scene: Scene;
let system: AnimationSystem;
let entity: Entity;
let animation: AnimationComponent;

beforeEach(() => {
  scene = new Scene('Animation Test');
  system = new AnimationSystem(scene);
  entity = new Entity('Animated');
  animation = new AnimationComponent();
  entity.addComponent(animation);
  scene.addEntity(entity);
});

describe('AnimationSystem', () => {
  it('applies sampled transform values to entity transform component', () => {
    const clip = createTestClip('Move', [
      { time: 0, value: [0, 0, 0] },
      { time: 1, value: [0, 1, 0] },
    ]);
    animation.addClip(clip);
    animation.stateMachine.setState('Move', { resetTime: true, autoPlay: true });

    system.update(0.5);

    expect(entity.transform.position).toEqual([0, 0.5, 0]);
  });

  it('loops clips when exceeding duration', () => {
    const clip = createTestClip('Loop', [
      { time: 0, value: [0, 0, 0] },
      { time: 0.5, value: [0, 1, 0] },
      { time: 1, value: [0, 0, 0] },
    ]);
    animation.addClip(clip);
    animation.stateMachine.setState('Loop', { resetTime: true, autoPlay: true });

    system.update(1.25);

    expect(entity.transform.position).toEqual([0, 0.5, 0]);
  });

  it('updates skeletal pose when skeleton is present', () => {
    const skeleton = new Skeleton([
      {
        name: 'root',
        parentIndex: -1,
        bindPosition: [0, 0, 0],
        bindRotation: IDENTITY_QUAT,
        bindScale: [1, 1, 1],
      },
    ]);
    animation.setSkeleton(skeleton);

    const clip = new AnimationClip({
      name: 'BoneTranslate',
      duration: 1,
      tracks: [
        {
          id: 'bone-pos',
          target: { type: 'bone', bone: 'root', property: 'position' },
          interpolation: 'linear',
          valueType: 'vec3',
          keyframes: [
            { time: 0, value: [0, 0, 0] },
            { time: 1, value: [0, 1, 0] },
          ],
        },
      ],
    });

    animation.addClip(clip);
    animation.stateMachine.setState('BoneTranslate', { resetTime: true, autoPlay: true });

    system.update(0.5);

    expect(animation.pose).not.toBeNull();
    expect(Array.from(animation.pose?.[0]?.position ?? [])).toEqual([0, 0.5, 0]);
  });

  it('honors state transitions and blend weights', () => {
    const clipIdle = createTestClip('Idle', [
      { time: 0, value: [0, 0, 0] },
      { time: 1, value: [0, 0, 0] },
    ]);
    const clipJump = createTestClip('Jump', [
      { time: 0, value: [0, 0, 0] },
      { time: 1, value: [0, 2, 0] },
    ]);
    animation.addClip(clipIdle);
    animation.addClip(clipJump);
    animation.stateMachine.setState('Idle', { resetTime: true, autoPlay: true });

    animation.stateMachine.setState('Jump', { resetTime: true, autoPlay: true });

    system.update(0.25);

    expect(entity.transform.position[1]).toBeGreaterThan(0);
  });

  it('mixes controller weights when blending', () => {
    const clipPrimary = createTestClip('Primary', [
      { time: 0, value: [0, 0, 0] },
      { time: 1, value: [0, 2, 0] },
    ]);
    const clipSecondary = createTestClip('Secondary', [
      { time: 0, value: [0, 0, 0] },
      { time: 1, value: [0, 4, 0] },
    ]);

    const primaryController = animation.addClip(clipPrimary);
    const secondaryController = animation.addClip(clipSecondary);

    animation.stateMachine.replaceStates([
      { name: 'Primary', controller: primaryController },
      { name: 'Secondary', controller: secondaryController },
    ]);

    animation.stateMachine.setState('Primary', { resetTime: true, autoPlay: true });
    primaryController.weight.value = 1;
    secondaryController.weight.value = 0.5;

    animation.stateMachine.setTrigger('blend');
    animation.stateMachine.replaceStates([
      {
        name: 'Primary',
        controller: primaryController,
        transitions: [
          {
            to: 'Secondary',
            blendDuration: 1,
            conditions: [{ parameter: 'blend', operator: 'triggered' }],
          },
        ],
      },
      { name: 'Secondary', controller: secondaryController },
    ]);

    animation.stateMachine.setState('Primary', { resetTime: true, autoPlay: true });
    animation.stateMachine.setTrigger('blend');

    system.update(0.5);

    const blendedY = entity.transform.position[1];

    // Calculate expected value using weighted blend with weights 1 and 0.5 and blendWeight ~0.5
    const expectedPrimary = 1; // 0 -> 2 half way
    const expectedSecondary = 2; // 0 -> 4 half way
    const primaryWeight = (1 - 0.5) * 1;
    const secondaryWeight = 0.5 * 0.5;
    const totalWeight = primaryWeight + secondaryWeight;
    const expected = (expectedPrimary * primaryWeight + expectedSecondary * secondaryWeight) / totalWeight;

    expect(blendedY).toBeCloseTo(expected, 5);
  });
});
