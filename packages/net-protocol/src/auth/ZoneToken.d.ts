/**
 * Zone role permissions
 */
export declare enum ZoneRole {
    /** Zone owner - full control */
    OWNER = "owner",
    /** Moderator - can kick/ban, edit in staging */
    MODERATOR = "moderator",
    /** Builder - can edit in staging */
    BUILDER = "builder",
    /** Guest - read-only, no editing */
    GUEST = "guest"
}
/**
 * Editing scopes define what operations a user can perform
 */
export declare enum EditScope {
    /** Can place/remove/paint voxels */
    VOXEL_EDIT = "voxel:edit",
    /** Can modify entities/components */
    ENTITY_EDIT = "entity:edit",
    /** Can publish versions */
    PUBLISH = "publish",
    /** Can manage other users (kick/ban) */
    MODERATE = "moderate",
    /** Full control (owner only) */
    ADMIN = "admin"
}
export interface ZoneTokenPayload {
    zoneId: string;
    userId: string;
    exp: number;
    nonce: string;
    /** User's role in this zone */
    role: ZoneRole;
    /** Permitted editing scopes */
    scopes: EditScope[];
}
export declare function signZoneToken(payload: ZoneTokenPayload, secret: Uint8Array): Promise<string>;
export declare function verifyZoneToken(token: string, secret: Uint8Array): Promise<ZoneTokenPayload | null>;
//# sourceMappingURL=ZoneToken.d.ts.map