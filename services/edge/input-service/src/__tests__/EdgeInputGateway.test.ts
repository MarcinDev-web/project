import { describe, expect, it, vi } from 'vitest';
import type { IntentFrame } from '@engine/world/net/InputChannel';
import { HmacIntentAuthenticator, payloadFromFrame } from '@engine/world/net/InputChannel';
import { EdgeInputGateway } from '../EdgeInputGateway.js';

function makeFrame(sequence: number, timestamp: number, overrides?: Partial<IntentFrame>): IntentFrame {
  return {
    actorId: 'player-1',
    sequence,
    timestamp,
    deltaMs: sequence === 0 ? 0 : timestamp - (timestamp - 10),
    signature: '',
    input: {
      moveDirection: [0, 0, 1],
      sprint: false,
      jump: false,
      cameraForward: [0, 0, 1],
      cameraRight: [1, 0, 0],
    },
    ...overrides,
  };
}

describe('EdgeInputGateway', () => {
  const authenticator = new HmacIntentAuthenticator({ secret: 'edge-secret', keyId: 'edge' });

  function sign(frame: IntentFrame): IntentFrame {
    return {
      ...frame,
      signature: authenticator.sign(payloadFromFrame(frame)),
    };
  }

  it('normalizes intents using profile-specific rate limits', async () => {
    const forwarder = { forward: vi.fn() };
    const gateway = new EdgeInputGateway({
      forwarder,
      authenticator,
      deviceProfiles: {
        desktop: { name: 'desktop', maxHz: 200 },
      },
    });

    const frames = [sign(makeFrame(0, 0)), sign(makeFrame(1, 10)), sign(makeFrame(2, 20))];
    const batch = await gateway.handleBatch({
      actorId: 'player-1',
      deviceId: 'deck',
      profile: 'desktop',
      frames,
    });

    expect(batch.frames).toHaveLength(3);
    expect(batch.appliedProfile).toBe('desktop');
    expect(forwarder.forward).toHaveBeenCalledWith(batch);
  });

  it('drops bursts that exceed maxHz and invalid signatures', async () => {
    const forwarder = { forward: vi.fn() };
    const gateway = new EdgeInputGateway({
      forwarder,
      authenticator,
      defaultProfile: { name: 'mobile', maxHz: 60, burstLimit: 5 },
    });

    const legit = sign(makeFrame(0, 0));
    const tooFast = sign(makeFrame(1, 1));
    const tampered = { ...sign(makeFrame(2, 20)), signature: 'edge:deadbeef' };

    const batch = await gateway.handleBatch({
      actorId: 'player-1',
      deviceId: 'mobile',
      frames: [legit, tooFast, tampered],
    });

    expect(batch.frames).toHaveLength(1);
    expect(batch.droppedFrames).toBe(2);
  });

  it('applies max batch size cap', async () => {
    const forwarder = { forward: vi.fn() };
    const gateway = new EdgeInputGateway({
      forwarder,
      authenticator,
      maxBatchSize: 2,
    });

    const frames = [
      sign(makeFrame(0, 0)),
      sign(makeFrame(1, 12)),
      sign(makeFrame(2, 24)),
    ];

    const batch = await gateway.handleBatch({
      actorId: 'player-1',
      deviceId: 'desktop',
      frames,
    });

    expect(batch.frames).toHaveLength(2);
    expect(batch.droppedFrames).toBeGreaterThanOrEqual(1);
  });
});

