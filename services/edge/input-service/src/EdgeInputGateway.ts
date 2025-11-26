import type { IntentFrame, IntentAuthenticator } from '@engine/world/net/InputChannel';
import { payloadFromFrame } from '@engine/world/net/InputChannel';

export interface DeviceProfile {
  name: string;
  maxHz: number;
  burstLimit?: number;
}

export interface ResolvedProfile extends DeviceProfile {
  minIntervalMs: number;
}

export interface EdgeIntentRequest {
  actorId: string;
  deviceId: string;
  profile?: string;
  frames: IntentFrame[];
  ipAddress?: string;
}

export interface NormalizedIntentBatch {
  actorId: string;
  deviceId: string;
  frames: IntentFrame[];
  droppedFrames: number;
  appliedProfile: string;
  ipAddress?: string | undefined;
}

export interface IntentForwarder {
  forward(batch: NormalizedIntentBatch): Promise<void> | void;
}

export interface EdgeInputGatewayConfig {
  forwarder: IntentForwarder;
  deviceProfiles?: Record<string, DeviceProfile>;
  defaultProfile?: DeviceProfile;
  authenticator?: IntentAuthenticator;
  maxBatchSize?: number;
  logger?: {
    debug: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
  };
}

/**
 * EdgeInputGateway inspects player intents before they reach the authoritative simulation.
 * Responsibilities:
 * - Device-aware rate limiting (desktop vs mobile controllers)
 * - Signature verification (zero-trust pipeline)
 * - Burst dropping & stats for trust-and-safety
 */
export class EdgeInputGateway {
  private readonly forwarder: IntentForwarder;
  private readonly authenticator?: IntentAuthenticator | undefined;
  private readonly deviceProfiles = new Map<string, ResolvedProfile>();
  private readonly defaultProfile: ResolvedProfile;
  private readonly maxBatchSize: number;
  private readonly logger?: EdgeInputGatewayConfig['logger'];

  constructor(config: EdgeInputGatewayConfig) {
    if (!config.forwarder) {
      throw new Error('EdgeInputGateway requires forwarder');
    }
    this.forwarder = config.forwarder;
    this.authenticator = config.authenticator;
    this.maxBatchSize = config.maxBatchSize ?? 32;
    this.logger = config.logger;

    const fallbackProfile: DeviceProfile = config.defaultProfile ?? {
      name: 'default',
      maxHz: 120,
      burstLimit: 16,
    };
    this.defaultProfile = this.resolveProfileConfig(fallbackProfile);

    const entries = Object.entries(config.deviceProfiles ?? {});
    for (const [key, profile] of entries) {
      this.deviceProfiles.set(key, this.resolveProfileConfig(profile));
    }
  }

  registerDeviceProfile(name: string, profile: DeviceProfile): void {
    this.deviceProfiles.set(name, this.resolveProfileConfig(profile));
  }

  async handleBatch(request: EdgeIntentRequest): Promise<NormalizedIntentBatch> {
    if (!request.frames || request.frames.length === 0) {
      throw new Error('EdgeInputGateway: empty intent batch');
    }
    const profile = this.deviceProfiles.get(request.profile ?? '') ?? this.defaultProfile;
    const normalized: IntentFrame[] = [];
    let dropped = 0;
    let lastTimestamp = Number.NEGATIVE_INFINITY;

    for (const frame of request.frames) {
      if (frame.actorId !== request.actorId) {
        dropped++;
        continue;
      }

      if (this.authenticator) {
        const payload = payloadFromFrame(frame);
        if (!this.authenticator.verify(payload, frame.signature)) {
          dropped++;
          this.logger?.warn?.('EdgeInputGateway: signature verification failed', {
            actorId: frame.actorId,
            sequence: frame.sequence,
          });
          continue;
        }
      }

      if (Number.isFinite(lastTimestamp) && frame.timestamp - lastTimestamp < profile.minIntervalMs) {
        dropped++;
        continue;
      }

      normalized.push(frame);
      lastTimestamp = frame.timestamp;

      if (profile.burstLimit && normalized.length >= profile.burstLimit) {
        break;
      }
    }

    const limited =
      normalized.length > this.maxBatchSize
        ? normalized.slice(normalized.length - this.maxBatchSize)
        : normalized;

    if (limited.length === 0) {
      this.logger?.debug?.('EdgeInputGateway: no intents survived normalization', {
        actorId: request.actorId,
        profile: profile.name,
      });
    }

    const batch: NormalizedIntentBatch = {
      actorId: request.actorId,
      deviceId: request.deviceId,
      frames: limited,
      droppedFrames: dropped + (normalized.length - limited.length),
      appliedProfile: profile.name,
      ipAddress: request.ipAddress,
    };

    await this.forwarder.forward(batch);
    return batch;
  }

  private resolveProfileConfig(profile: DeviceProfile): ResolvedProfile {
    if (!Number.isFinite(profile.maxHz) || profile.maxHz <= 0) {
      throw new Error(`Invalid device profile rate for ${profile.name}`);
    }
    return {
      ...profile,
      minIntervalMs: Math.floor(1000 / profile.maxHz),
    };
  }
}

