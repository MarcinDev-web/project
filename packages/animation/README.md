@engine/animation

Animation runtime library for the UGC 3D platform. GPU-agnostic core with ECS integration and WebGPU skinning contract.

Includes:
- Core: Skeleton, Pose (SoA), AnimationClip, samplers, blending
- Runtime: AnimatorController (FSM), Animator with crossfade
- Skinning: joint palette computation for vertex-shader skinning
- Morph: morph weight clips and sampling
- Import: minimal glTF/GLB conversion utilities

## Install

Use workspace imports:

```ts
import {
  Animator, AnimatorController,
  createSkeleton, createPose, createClip,
  computeJointPalette
} from '@engine/animation';
```

## Quick start

```ts
// Build a 1-joint skeleton (root)
const skeleton = createSkeleton([{ name: 'root' }], new Int16Array([-1]),
  Float32Array.of(1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1));

// Create a simple clip moving the root along X
const times = new Float32Array([0, 1]);
const values = new Float32Array([0,0,0, 1,0,0]);
const clip = createClip('move', [{ kind:'translation', jointIndex:0, times, values, interpolation:'linear' }]);

// Setup FSM and Animator
const ctrl = new AnimatorController().addState('move', clip);
const animator = new Animator(ctrl, skeleton.jointCount);
const pose = createPose(skeleton.jointCount);

// Each frame
animator.update(dt);
animator.sample(pose);

// Compute joint palette for rendering
const jointPalette = new Float32Array(skeleton.jointCount * 16);
computeJointPalette(jointPalette, skeleton, pose);
```

## Build

```bash
pnpm --filter @engine/animation build
```


