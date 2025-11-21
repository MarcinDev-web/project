import type { Vec3 } from '@engine/core/math';
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
export declare class HmacIntentAuthenticator implements IntentAuthenticator {
    private readonly encoder;
    constructor(options: {
        secret: string | Uint8Array;
        keyId?: string;
    });
    readonly keyId: string;
    private readonly secretBytes;
    sign(payload: IntentSignPayload): string;
    verify(payload: IntentSignPayload, signature: string): boolean;
    private encodePayload;
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
export declare class InputChannel {
    private actorId;
    private readonly authenticator;
    private readonly minIntervalMs;
    private readonly jitterWindow;
    private readonly clock;
    private readonly logger?;
    private readonly recentSampleTimes;
    private sequence;
    private lastEmitTime;
    constructor(config: InputChannelConfig);
    /**
     * Attempts to enqueue a player intent. Returns a signed frame when accepted or null when dropped.
     */
    push(input: CharacterInput): IntentFrame | null;
    /**
     * Approximate effective sample rate calculated from recent frames.
     */
    getEffectiveRateHz(): number;
    private normalizeInput;
    private normalizeVec3Safe;
    /**
     * Updates actor identity (used when userId becomes available post-auth).
     */
    setActorId(actorId: string): void;
}
/**
 * Utility that reconstructs sign payload from a frame.
 */
export declare function payloadFromFrame(frame: IntentFrame): IntentSignPayload;
//# sourceMappingURL=InputChannel.d.ts.map