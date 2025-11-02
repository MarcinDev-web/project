import { Entity } from '@engine/world';
import { AvatarAnimationPlayer, type AvatarAnimation } from './animation';
import { type AvatarPartDefinition, type AvatarPartLibrary, type AvatarSlot } from './slots';
import { AvatarSkeleton } from './skeleton';
import type { RgbaColor } from '@engine/world';
export interface AvatarMaterialBinding {
    readonly materialId?: number;
    readonly color?: RgbaColor;
    readonly metallic?: number;
    readonly roughness?: number;
}
export interface AvatarLoadoutPart {
    mesh: string;
    mat?: string;
    material?: string;
    colors?: Record<string, RgbaColor>;
}
export interface AvatarLoadout {
    readonly version: number;
    readonly parts: Partial<Record<AvatarSlot, AvatarLoadoutPart>>;
}
export type AvatarMaterialResolver = (id: string) => AvatarMaterialBinding | null | undefined;
export interface AvatarInstanceOptions {
    readonly name?: string;
    readonly partLibrary?: AvatarPartLibrary;
    readonly loadout?: AvatarLoadout;
    readonly materialResolver?: AvatarMaterialResolver;
}
export declare class AvatarInstance {
    private readonly root;
    private readonly skeleton;
    private readonly animator;
    private readonly partLibrary;
    private readonly jointEntities;
    private readonly slotEntities;
    private readonly selections;
    private readonly meshGenerator;
    private readonly materialManager;
    private readonly colorManager;
    private readonly mountManager;
    private readonly serializer;
    constructor(parent: Entity, options?: AvatarInstanceOptions);
    getRootEntity(): Entity;
    getSkeleton(): AvatarSkeleton;
    getAnimator(): AvatarAnimationPlayer;
    update(deltaTime: number): void;
    playAnimation(animation: AvatarAnimation, startTime?: number): void;
    stopAnimation(): void;
    dispose(): void;
    applyLoadout(loadout: AvatarLoadout): void;
    setSlot(slot: AvatarSlot, part: AvatarLoadoutPart | null): void;
    serializeLoadout(): AvatarLoadout;
    ownsEntity(entity: Entity | null | undefined): boolean;
    /**
     * Set slot visibility (for hiding head in FPS mode, etc.)
     */
    setSlotVisible(slot: AvatarSlot, visible: boolean): void;
    /**
     * Get slot entity (for external manipulation)
     */
    getSlotEntity(slot: AvatarSlot): Entity | undefined;
    syncJointEntities(): void;
    private buildSkeletonEntities;
    private resolveDefinition;
}
export declare const DEFAULT_AVATAR_PART_DEFINITIONS: readonly AvatarPartDefinition[];
export declare function createAvatarPartLibrary(definitions: Iterable<AvatarPartDefinition>): AvatarPartLibrary;
export declare const DEFAULT_AVATAR_PART_LIBRARY: AvatarPartLibrary;
export declare const DEFAULT_AVATAR_LOADOUT: AvatarLoadout;
//# sourceMappingURL=avatar-instance.d.ts.map