import type { CharacterInput } from '@engine/world';
import { ReplicationClient } from '../ReplicationClient';
import type { InputMessage } from '../types/replication';

/**
 * Input event for replication.
 */
export interface InputEvent {
  type: 'move' | 'jump' | 'sprint' | 'sprint-end';
  timestamp: number;
  moveDirection?: [number, number]; // [forward, right] normalized
  cameraForward?: [number, number, number];
  cameraRight?: [number, number, number];
}

/**
 * Buffered input event with sequencing.
 */
interface BufferedInputEvent extends InputEvent {
  sequence: number;
}

/**
 * Configuration for InputReplicator.
 */
export interface InputReplicatorConfig {
  /** Replication client for network communication. */
  replicationClient: ReplicationClient;
  /** Enable input buffering for lag compensation. */
  enableBuffering?: boolean; // Default: true
  /** Buffer size for input events. */
  bufferSize?: number; // Default: 50
  /** Enable timestamp synchronization. */
  enableTimestampSync?: boolean; // Default: true
}

/**
 * Replicates input events (movement, actions) to other clients.
 * Handles:
 * - Input event buffering
 * - Timestamp synchronization
 * - Sequence numbering for ordering
 * - Lag compensation via buffering
 */
export class InputReplicator {
  private readonly config: Required<InputReplicatorConfig>;
  private inputBuffer: BufferedInputEvent[] = [];
  private sequenceNumber = 0;
  private lastSentInput: CharacterInput | null = null;
  private lastSendTime = 0;
  private readonly sendThrottle = 50; // Minimum 50ms between sends (20 updates/second)

  constructor(config: InputReplicatorConfig) {
    this.config = {
      enableBuffering: config.enableBuffering ?? true,
      bufferSize: config.bufferSize ?? 50,
      enableTimestampSync: config.enableTimestampSync ?? true,
      ...config,
    };
  }

  /**
   * Record and replicate an input event.
   * Called when local player provides input.
   */
  recordInput(input: CharacterInput): void {
    const now = Date.now();
    
    // Throttle sends
    if (now - this.lastSendTime < this.sendThrottle) {
      // Still buffer the input even if not sending immediately
      if (this.config.enableBuffering) {
        this.bufferInput(input, now);
      }
      return;
    }

    // Check if input changed significantly
    if (this.lastSentInput && this.isInputSimilar(this.lastSentInput, input)) {
      // Buffer small changes but don't send immediately
      if (this.config.enableBuffering) {
        this.bufferInput(input, now);
      }
      return;
    }

    // Send input event
    this.sendInput(input, now);
    
    // Buffer for redundancy/retransmission
    if (this.config.enableBuffering) {
      this.bufferInput(input, now);
    }

    this.lastSentInput = { ...input };
    this.lastSendTime = now;
  }

  /**
   * Send input immediately (for critical actions like jump).
   */
  sendImmediate(input: CharacterInput): void {
    const now = Date.now();
    this.sendInput(input, now);
    this.lastSentInput = { ...input };
    this.lastSendTime = now;
  }

  /**
   * Flush buffered inputs (call periodically or when connection is stable).
   */
  flushBuffer(): void {
    if (this.inputBuffer.length === 0) {
      return;
    }

    // Send all buffered inputs (server can handle ordering)
    for (const event of this.inputBuffer) {
      this.sendInputEvent(event);
    }

    this.inputBuffer = [];
  }

  /**
   * Get buffered inputs for a given sequence range.
   * Used for retransmission or lag compensation.
   */
  getBufferedInputs(fromSequence: number, toSequence: number): BufferedInputEvent[] {
    return this.inputBuffer.filter(
      (event) => event.sequence >= fromSequence && event.sequence <= toSequence
    );
  }

  /**
   * Clear input buffer.
   */
  clearBuffer(): void {
    this.inputBuffer = [];
  }

  /**
   * Get current sequence number.
   */
  getCurrentSequence(): number {
    return this.sequenceNumber;
  }

  /**
   * Send input event to server.
   */
  private sendInput(input: CharacterInput, timestamp: number): void {
    // Determine input event type
    let type: InputEvent['type'] = 'move';
    if (input.jump) {
      type = 'jump';
    } else if (input.sprint) {
      type = 'sprint';
    }

    const moveDirection: [number, number] | undefined = 
      input.moveDirection ? [input.moveDirection[2], input.moveDirection[0]] as [number, number] : undefined;

    const cameraForward: [number, number, number] | undefined = 
      input.cameraForward ? [...input.cameraForward] as [number, number, number] : undefined;

    const cameraRight: [number, number, number] | undefined = 
      input.cameraRight ? [...input.cameraRight] as [number, number, number] : undefined;

    const event: BufferedInputEvent = {
      type,
      timestamp: this.config.enableTimestampSync ? timestamp : Date.now(),
      sequence: this.sequenceNumber++,
      ...(moveDirection && { moveDirection }),
      ...(cameraForward && { cameraForward }),
      ...(cameraRight && { cameraRight }),
    };

    this.sendInputEvent(event);
  }

  /**
   * Send input event via replication client.
   * Uses dedicated InputMessage type instead of operations.
   */
  private sendInputEvent(event: BufferedInputEvent): void {
    const message: Omit<InputMessage, 'type' | 'timestamp' | 'sessionId' | 'userId'> = {
      sequence: event.sequence,
      inputType: event.type,
      ...(event.moveDirection && { moveDirection: event.moveDirection }),
      ...(event.cameraForward && { cameraForward: event.cameraForward }),
      ...(event.cameraRight && { cameraRight: event.cameraRight }),
    };
    
    this.config.replicationClient.sendInput(message);
  }

  /**
   * Buffer input event.
   */
  private bufferInput(input: CharacterInput, timestamp: number): void {
    if (this.inputBuffer.length >= this.config.bufferSize) {
      // Remove oldest
      this.inputBuffer.shift();
    }

    const moveDirection: [number, number] | undefined = 
      input.moveDirection ? [input.moveDirection[2], input.moveDirection[0]] as [number, number] : undefined;

    const cameraForward: [number, number, number] | undefined = 
      input.cameraForward ? [...input.cameraForward] as [number, number, number] : undefined;

    const cameraRight: [number, number, number] | undefined = 
      input.cameraRight ? [...input.cameraRight] as [number, number, number] : undefined;

    const event: BufferedInputEvent = {
      type: input.jump ? 'jump' : input.sprint ? 'sprint' : 'move',
      timestamp: this.config.enableTimestampSync ? timestamp : Date.now(),
      sequence: this.sequenceNumber++,
      ...(moveDirection && { moveDirection }),
      ...(cameraForward && { cameraForward: cameraForward }),
      ...(cameraRight && { cameraRight: cameraRight }),
    };

    this.inputBuffer.push(event);
  }

  /**
   * Check if two inputs are similar enough to skip sending.
   */
  private isInputSimilar(a: CharacterInput, b: CharacterInput): boolean {
    // Compare move direction
    const dirA = a.moveDirection ?? [0, 0, 0];
    const dirB = b.moveDirection ?? [0, 0, 0];
    const dirDiff = Math.sqrt(
      Math.pow(dirA[0] - dirB[0], 2) +
      Math.pow(dirA[1] - dirB[1], 2) +
      Math.pow(dirA[2] - dirB[2], 2)
    );

    // Consider inputs similar if direction change is small and other flags match
    const threshold = 0.1;
    return (
      dirDiff < threshold &&
      a.jump === b.jump &&
      a.sprint === b.sprint
    );
  }

  /**
   * Cleanup - call when input replicator is no longer needed.
   */
  dispose(): void {
    this.inputBuffer = [];
    this.lastSentInput = null;
    this.sequenceNumber = 0;
  }
}

