import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InputReplicator } from './InputReplicator';
import { ReplicationClient } from '../ReplicationClient';
import type { CharacterInput } from '@engine/world';

describe('InputReplicator', () => {
  let replicationClient: ReplicationClient;
  let inputReplicator: InputReplicator;

  beforeEach(() => {
    replicationClient = {
      sendInput: vi.fn(),
      getLocalUserId: vi.fn(() => 'test-user-id'),
    } as unknown as ReplicationClient;

    inputReplicator = new InputReplicator({
      replicationClient,
    });
  });

  it('should initialize with replication client', () => {
    expect(inputReplicator).toBeDefined();
  });

  it('should send input event when recorded', () => {
    const input: CharacterInput = {
      moveDirection: [0, 0, 1],
      cameraForward: [0, 0, -1],
      jump: false,
      sprint: false,
    };

    inputReplicator.recordInput(input);

    expect(replicationClient.sendInput).toHaveBeenCalledWith(
      expect.objectContaining({
        inputType: 'move',
      })
    );
  });

  it('should send jump input immediately', () => {
    const input: CharacterInput = {
      moveDirection: [0, 0, 1],
      jump: true,
      sprint: false,
    };

    inputReplicator.sendImmediate(input);

    expect(replicationClient.sendInput).toHaveBeenCalledWith(
      expect.objectContaining({
        inputType: 'jump',
      })
    );
  });

  it('should throttle rapid input events', () => {
    const input: CharacterInput = {
      moveDirection: [0, 0, 1],
      jump: false,
      sprint: false,
    };

    // Record multiple inputs quickly
    inputReplicator.recordInput(input);
    inputReplicator.recordInput(input);
    inputReplicator.recordInput(input);

    // Should only send once (throttled)
    expect(replicationClient.sendInput).toHaveBeenCalled();
    const callCount = (replicationClient.sendInput as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(callCount).toBeLessThanOrEqual(2); // May buffer or send once
  });

  it('should buffer inputs when enabled', () => {
    const input: CharacterInput = {
      moveDirection: [0, 0, 1],
      jump: false,
      sprint: false,
    };

    inputReplicator.recordInput(input);
    inputReplicator.recordInput(input);

    const buffered = inputReplicator.getBufferedInputs(0, 100);
    expect(buffered.length).toBeGreaterThan(0);
  });

  it('should clear buffer on dispose', () => {
    const input: CharacterInput = {
      moveDirection: [0, 0, 1],
      jump: false,
      sprint: false,
    };

    inputReplicator.recordInput(input);
    inputReplicator.dispose();

    const buffered = inputReplicator.getBufferedInputs(0, 100);
    expect(buffered.length).toBe(0);
  });

  it('should increment sequence numbers', () => {
    const input: CharacterInput = {
      moveDirection: [0, 0, 1],
      jump: false,
      sprint: false,
    };

    const seq1 = inputReplicator.getCurrentSequence();
    inputReplicator.recordInput(input);
    const seq2 = inputReplicator.getCurrentSequence();

    expect(seq2).toBeGreaterThan(seq1);
  });

  it('should reject invalid moveDirection (NaN)', () => {
    const errorHandler = (inputReplicator as any).config.errorHandler;
    const handleErrorSpy = vi.spyOn(errorHandler, 'handleError');

    const input: CharacterInput = {
      moveDirection: [NaN, 0, 1],
      jump: false,
      sprint: false,
    };

    inputReplicator.recordInput(input);

    // Should handle error gracefully (may not send)
    expect(handleErrorSpy).toHaveBeenCalled();
  });

  it('should reject invalid moveDirection (extreme values)', () => {
    const errorHandler = (inputReplicator as any).config.errorHandler;
    const handleErrorSpy = vi.spyOn(errorHandler, 'handleError');

    const input: CharacterInput = {
      moveDirection: [1e7, 0, 1],
      jump: false,
      sprint: false,
    };

    inputReplicator.recordInput(input);

    expect(handleErrorSpy).toHaveBeenCalled();
  });

  it('should reject invalid cameraForward (Infinity)', () => {
    const errorHandler = (inputReplicator as any).config.errorHandler;
    const handleErrorSpy = vi.spyOn(errorHandler, 'handleError');

    const input: CharacterInput = {
      moveDirection: [0, 0, 1],
      cameraForward: [Infinity, 0, -1],
      jump: false,
      sprint: false,
    };

    inputReplicator.recordInput(input);

    expect(handleErrorSpy).toHaveBeenCalled();
  });

  it('should reject invalid timestamp (future)', () => {
    const errorHandler = (inputReplicator as any).config.errorHandler;
    const handleErrorSpy = vi.spyOn(errorHandler, 'handleError');

    const input: CharacterInput = {
      moveDirection: [0, 0, 1],
      jump: false,
      sprint: false,
    };

    // Use sendImmediate with future timestamp
    const sendInput = (inputReplicator as any).sendInput.bind(inputReplicator);
    sendInput(input, Date.now() + 2000);

    expect(handleErrorSpy).toHaveBeenCalled();
  });

  it('should reject invalid timestamp (too old)', () => {
    const errorHandler = (inputReplicator as any).config.errorHandler;
    const handleErrorSpy = vi.spyOn(errorHandler, 'handleError');

    const input: CharacterInput = {
      moveDirection: [0, 0, 1],
      jump: false,
      sprint: false,
    };

    // Use sendImmediate with old timestamp
    const sendInput = (inputReplicator as any).sendInput.bind(inputReplicator);
    sendInput(input, Date.now() - 10000);

    expect(handleErrorSpy).toHaveBeenCalled();
  });

  it('should flush buffer', () => {
    const input: CharacterInput = {
      moveDirection: [0, 0, 1],
      jump: false,
      sprint: false,
    };

    inputReplicator.recordInput(input);
    inputReplicator.flushBuffer();

    const buffered = inputReplicator.getBufferedInputs(0, 100);
    expect(buffered.length).toBe(0);
  });
});

