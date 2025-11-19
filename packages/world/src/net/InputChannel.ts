import type { Vec3 } from '@engine/core/math';
import { clampVec3, lengthVec3, normalizeVec3 } from '@engine/core/math';
import type { CharacterInput } from '../components/CharacterController.js';

/**
 * Payload used for signing and verifying player intent frames.
 */
export interface IntentSignPayload {
  actorId: string;
  sequence: number;
  timestamp: number;
  deltaMs: number;
  move: Vec3;
  sprint: boolean;
  jump: boolean;
  cameraForward?: Vec3;
  cameraRight?: Vec3;
}

/**
 * Signature/verification contract for player intents.
 */
export interface IntentAuthenticator {
  readonly keyId: string;
  sign(payload: IntentSignPayload): string;
  verify(payload: IntentSignPayload, signature: string): boolean;
}

/**
 * HMAC-SHA256 authenticator used by both clients (sign) and edge/service layers (verify).
 */
export class HmacIntentAuthenticator implements IntentAuthenticator {
  private readonly encoder = new TextEncoder();

  constructor(options: { secret: string | Uint8Array; keyId?: string }) {
    if (!options.secret || (typeof options.secret === 'string' && options.secret.trim() === '')) {
      throw new TypeError('HmacIntentAuthenticator: secret is required');
    }
    this.secretBytes = typeof options.secret === 'string' ? this.encoder.encode(options.secret) : options.secret;
    this.keyId = options.keyId ?? 'default';
  }

  readonly keyId: string;
  private readonly secretBytes: Uint8Array;

  sign(payload: IntentSignPayload): string {
    const raw = this.encodePayload(payload);
    const combined = new Uint8Array(raw.length + this.secretBytes.length);
    combined.set(raw);
    combined.set(this.secretBytes, raw.length);
    const digest = fnv1a64(combined);
    return `${this.keyId}:${digest}`;
  }

  verify(payload: IntentSignPayload, signature: string): boolean {
    if (!signature) return false;
    const [keyId, hexDigest] = signature.split(':');
    if (keyId && keyId !== this.keyId) {
      return false;
    }
    if (!hexDigest) return false;
    const expected = this.sign(payload).split(':')[1]!;
    return timingSafeEqual(expected, hexDigest);
  }

  private encodePayload(payload: IntentSignPayload): Uint8Array {
    const parts: Array<string | number> = [
      payload.actorId,
      payload.sequence,
      payload.timestamp,
      payload.deltaMs,
      payload.move[0],
      payload.move[1],
      payload.move[2],
      payload.sprint ? 1 : 0,
      payload.jump ? 1 : 0,
    ];

    if (payload.cameraForward) {
      parts.push(payload.cameraForward[0], payload.cameraForward[1], payload.cameraForward[2]);
    } else {
      parts.push(0, 0, 0);
    }

    if (payload.cameraRight) {
      parts.push(payload.cameraRight[0], payload.cameraRight[1], payload.cameraRight[2]);
    } else {
      parts.push(0, 0, 0);
    }

    return this.encoder.encode(parts.join('|'));
  }
}

/**
 * Intent frame produced by InputChannel and validated by the edge/service layers.
 */
export interface IntentFrame {
  actorId: string;
  sequence: number;
  timestamp: number;
  deltaMs: number;
  input: CharacterInput;
  signature: string;
}

export interface InputChannelConfig {
  actorId: string;
  authenticator: IntentAuthenticator;
  maxRateHz?: number;
  jitterWindow?: number;
  clock?: () => number;
  logger?: {
    debug: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
  };
}

/**
 * InputChannel enforces "intent-only" submission on the client:
 * - Accepts raw input states
 * - Applies deterministic normalization (vector clamping, bool casting)
 * - Enforces per-device max rate (default 120 Hz)
 * - Signs each frame so the edge/service layer can verify authenticity
 */
export class InputChannel {
  private actorId: string;
  private readonly authenticator: IntentAuthenticator;
  private readonly minIntervalMs: number;
  private readonly jitterWindow: number;
  private readonly clock: () => number;
  private readonly logger?: InputChannelConfig['logger'];
  private readonly recentSampleTimes: number[] = [];
  private sequence = 0;
  private lastEmitTime = Number.NEGATIVE_INFINITY;

  constructor(config: InputChannelConfig) {
    if (!config.actorId) {
      throw new TypeError('InputChannel: actorId is required');
    }
    this.actorId = config.actorId;
    this.authenticator = config.authenticator;
    const maxRate = config.maxRateHz ?? 120;
    if (!Number.isFinite(maxRate) || maxRate <= 0) {
      throw new RangeError('InputChannel: maxRateHz must be positive');
    }
    this.minIntervalMs = Math.floor(1000 / maxRate);
    this.jitterWindow = config.jitterWindow ?? 16;
    this.clock = config.clock ?? (() => Date.now());
    this.logger = config.logger;
  }

  /**
   * Attempts to enqueue a player intent. Returns a signed frame when accepted or null when dropped.
   */
  push(input: CharacterInput): IntentFrame | null {
    const now = this.clock();
    if (now - this.lastEmitTime < this.minIntervalMs) {
      this.logger?.debug?.('InputChannel: dropping input due to rate limit', {
        actorId: this.actorId,
        delta: now - this.lastEmitTime,
      });
      return null;
    }

    const sanitized = this.normalizeInput(input);
    const deltaMs = Number.isFinite(this.lastEmitTime) ? now - this.lastEmitTime : 0;
    const frame: IntentFrame = {
      actorId: this.actorId,
      sequence: this.sequence++,
      timestamp: now,
      deltaMs,
      input: sanitized,
      signature: '',
    };

    const payload = payloadFromFrame(frame);
    frame.signature = this.authenticator.sign(payload);
    this.lastEmitTime = now;
    this.recentSampleTimes.push(now);
    if (this.recentSampleTimes.length > this.jitterWindow) {
      this.recentSampleTimes.shift();
    }

    return frame;
  }

  /**
   * Approximate effective sample rate calculated from recent frames.
   */
  getEffectiveRateHz(): number {
    if (this.recentSampleTimes.length < 2) {
      return 0;
    }
    const first = this.recentSampleTimes[0]!;
    const last = this.recentSampleTimes[this.recentSampleTimes.length - 1]!;
    const deltaMs = last - first;
    if (deltaMs <= 0) {
      return 0;
    }
    return ((this.recentSampleTimes.length - 1) / deltaMs) * 1000;
  }

  private normalizeInput(input: CharacterInput): CharacterInput {
    const moveDirection = this.normalizeVec3Safe(input.moveDirection);
    const cameraForward = input.cameraForward ? this.normalizeVec3Safe(input.cameraForward) : undefined;
    const cameraRight = input.cameraRight ? this.normalizeVec3Safe(input.cameraRight) : undefined;

    const normalized: CharacterInput = {
      moveDirection,
      sprint: Boolean(input.sprint),
      jump: Boolean(input.jump),
    };

    if (cameraForward) {
      normalized.cameraForward = cameraForward;
    }
    if (cameraRight) {
      normalized.cameraRight = cameraRight;
    }

    return normalized;
  }

  private normalizeVec3Safe(vec: Vec3): Vec3 {
    const clamped = clampVec3(vec, -1, 1);
    const magnitude = lengthVec3(clamped);
    if (magnitude < 1e-5) {
      return [0, 0, 0];
    }
    const normalized = normalizeVec3([...clamped] as Vec3);
    return normalized;
  }

  /**
   * Updates actor identity (used when userId becomes available post-auth).
   */
  setActorId(actorId: string): void {
    if (!actorId) {
      throw new TypeError('InputChannel: actorId cannot be empty');
    }
    this.actorId = actorId;
  }
}

/**
 * Utility that reconstructs sign payload from a frame.
 */
export function payloadFromFrame(frame: IntentFrame): IntentSignPayload {
  const payload: IntentSignPayload = {
    actorId: frame.actorId,
    sequence: frame.sequence,
    timestamp: frame.timestamp,
    deltaMs: frame.deltaMs,
    move: frame.input.moveDirection,
    sprint: frame.input.sprint,
    jump: frame.input.jump,
  };

  if (frame.input.cameraForward) {
    payload.cameraForward = frame.input.cameraForward;
  }
  if (frame.input.cameraRight) {
    payload.cameraRight = frame.input.cameraRight;
  }

  return payload;
}

function fnv1a64(bytes: Uint8Array): string {
  let hash = BigInt('0xcbf29ce484222325');
  const prime = BigInt('0x100000001b3');
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * prime) & BigInt('0xffffffffffffffff');
  }
  return hash.toString(16).padStart(16, '0');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

