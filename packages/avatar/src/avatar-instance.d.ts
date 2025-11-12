import { Entity } from '@engine/world';
import { AnimationComponent } from '@engine/stdlib/Animation';
import { AvatarAnimationPlayer, type AvatarAnimation } from './animation';
import { type AvatarPartLibrary, type AvatarSlot } from './slots';
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
    readonly strictMode?: boolean;
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
    private readonly strictMode;
    constructor(parent: Entity, options?: AvatarInstanceOptions);
    getRootEntity(): Entity;
    getSkeleton(): AvatarSkeleton;
    /**
     * @deprecated Use getAnimationComponent() instead. This method is kept for backward compatibility.
     */
    getAnimator(): AvatarAnimationPlayer;
    /**
     * Get AnimationComponent from the root entity or parent entity.
     * Returns null if not found.
     */
    getAnimationComponent(): AnimationComponent | null;
    /**
     * Get or create AnimationComponent for this avatar instance.
     * If component doesn't exist, creates it on the root entity and configures it with skeleton.
     */
    getOrCreateAnimationComponent(): AnimationComponent;
    update(deltaTime: number): void;
    /**
     * Synchronize pose from AnimationComponent to AvatarSkeleton.
     * This bridges the gap between AnimationComponent's generic Skeleton and AvatarSkeleton.
     */
    private syncPoseFromAnimationComponent;
    playAnimation(animation: AvatarAnimation, startTime?: number): void;
    stopAnimation(): void;
    dispose(): void;
    applyLoadout(loadout: AvatarLoadout): void;
    setSlot(slot: AvatarSlot, part: AvatarLoadoutPart | null): void;
    serializeLoadout(): AvatarLoadout;
    /**
     * Check if an entity is part of this avatar instance hierarchy
     *
     * @param entity - Entity to check
     * @returns True if entity is the root or a descendant of this avatar instance
     */
    isEntityPartOfAvatar(entity: Entity | null | undefined): boolean;
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
//# sourceMappingURL=avatar-instance.d.ts.map