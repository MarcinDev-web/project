import { describe, expect, it, beforeEach } from 'vitest';
import type { CharacterInput } from '../components/CharacterController.js';
import { InputChannel, HmacIntentAuthenticator, payloadFromFrame } from './InputChannel.js';
import { lengthVec3 } from '@engine/core/math';

class FakeClock {
  private current = 0;
  now = (): number => this.current;
  advance(ms: number): void {
    this.current += ms;
  }
}

const BASE_INPUT: CharacterInput = {
  moveDirection: [0, 0, 1],
  sprint: false,
  jump: false,
  cameraForward: [0, 0, 1],
  cameraRight: [1, 0, 0],
};

describe('InputChannel', () => {
  let clock: FakeClock;
  let authenticator: HmacIntentAuthenticator;
  let channel: InputChannel;

  beforeEach(() => {
    clock = new FakeClock();
    authenticator = new HmacIntentAuthenticator({ secret: 'test-secret', keyId: 'test' });
    channel = new InputChannel({
      actorId: 'player-1',
      authenticator,
      clock: clock.now,
      maxRateHz: 120,
    });
  });

  it('drops inputs above rate limit', () => {
    const first = channel.push(BASE_INPUT);
    expect(first).not.toBeNull();
    const immediate = channel.push(BASE_INPUT);
    expect(immediate).toBeNull();

    clock.advance(10); // above ~8ms min interval for 120 Hz
    const second = channel.push(BASE_INPUT);
    expect(second).not.toBeNull();
    expect(second?.deltaMs).toBeGreaterThanOrEqual(10);
  });

  it('normalizes vectors before signing', () => {
    const frame = channel.push({
      ...BASE_INPUT,
      moveDirection: [4, 0.1, -2],
      cameraForward: [0, 10, 0],
      cameraRight: [5, 0, 0],
      sprint: true,
    });
    expect(frame).not.toBeNull();
    expect(lengthVec3(frame!.input.moveDirection)).toBeCloseTo(1, 5);
    expect(frame!.input.cameraForward).toEqual([0, 1, 0]);
    expect(frame!.input.cameraRight).toEqual([1, 0, 0]);
    expect(frame!.input.sprint).toBe(true);
  });

  it('produces verifiable signatures', () => {
    const frame = channel.push(BASE_INPUT);
    expect(frame).not.toBeNull();
    const payload = payloadFromFrame(frame!);
    expect(authenticator.verify(payload, frame!.signature)).toBe(true);
  });
});

