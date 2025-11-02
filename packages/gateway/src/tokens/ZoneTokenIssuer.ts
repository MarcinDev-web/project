import { signZoneToken, type ZoneTokenPayload, ZoneRole, EditScope } from '@engine/net-protocol';

export class ZoneTokenIssuer {
  constructor(private readonly secret: Uint8Array) {}

  async issue(userId: string, zoneId: string, ttlSeconds: number): Promise<string> {
    const payload: ZoneTokenPayload = {
      userId,
      zoneId,
      exp: Math.floor(Date.now() / 1000) + ttlSeconds,
      nonce: crypto.randomUUID(),
      role: ZoneRole.GUEST, // Default role - can be enhanced later with role-based token issuance
      scopes: [EditScope.VOXEL_EDIT], // Default scopes - can be customized per user
    };
    return signZoneToken(payload, this.secret);
  }

  rotateSecret(newSecret: Uint8Array): void {
    // Rolling change; old tokens will fail verification once rotated
    (this as any).secret = newSecret;
  }
}


