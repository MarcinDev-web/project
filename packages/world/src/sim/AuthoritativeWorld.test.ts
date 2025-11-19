import { describe, expect, it, vi } from 'vitest';
import { Scene } from '../core/Scene.js';
import { AuthoritativeWorld } from './AuthoritativeWorld.js';
import type { IntentFrame } from '../net/InputChannel.js';

function makeFrame(sequence: number): IntentFrame {
  return {
    actorId: 'player-1',
    sequence,
    timestamp: Date.now(),
    deltaMs: 16,
    signature: 'sig',
    input: {
      moveDirection: [1, 0, 0],
      sprint: false,
      jump: false,
    },
  };
}

describe('AuthoritativeWorld', () => {
  it('applies intents and emits diffs', () => {
    const scene = new Scene('test');
    const entity = scene.createEntity('player');
    const handler = vi.fn((frame: IntentFrame, dt: number) => {
      entity.transform.position[0] += frame.input.moveDirection[0] * dt * 5;
    });

    const world = new AuthoritativeWorld({ scene, tickRate: 60 });
    world.registerIntentHandler('player-1', handler);

    const diffs: unknown[] = [];
    world.onStateDiff((diff) => diffs.push(diff));

    world.enqueueIntent(makeFrame(0));
    world.update(Date.now());
    world.update(Date.now() + 20); // trigger tick

    expect(handler).toHaveBeenCalled();
    expect(diffs).toHaveLength(1);
    world.dispose();
  });
});

