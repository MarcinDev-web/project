import { Entity } from '@engine/world';
import type { AvatarSlot } from '../slots';
import type { AvatarJointName } from '../skeleton';
import { AvatarMeshGenerator } from '../mesh/avatar-mesh-generator';
import { AvatarMaterialManager } from '../material/avatar-material-manager';
import { AvatarColorManager } from '../color/avatar-color-manager';
import type { AvatarPartDefinition } from '../slots';
import type { RgbaColor } from '@engine/world';
interface AvatarPartSelectionState {
    id: string;
    definition: AvatarPartDefinition;
    colors?: Record<string, RgbaColor>;
    materialId?: string;
    appliedColors?: Record<string, RgbaColor>;
}
/**
 * Manages mounting and unmounting of avatar parts to joints.
 */
export declare class AvatarPartMountManager {
    private readonly jointEntities;
    private readonly slotEntities;
    private readonly meshGenerator;
    private readonly materialManager;
    private readonly colorManager;
    constructor(jointEntities: Map<AvatarJointName, Entity>, slotEntities: Map<AvatarSlot, Entity>, meshGenerator: AvatarMeshGenerator, materialManager: AvatarMaterialManager, colorManager: AvatarColorManager);
    /**
     * Mount a part to its joint based on selection state.
     */
    mountPart(selection: AvatarPartSelectionState): void;
    /**
     * Unmount a part from a slot.
     */
    unmountSlot(slot: AvatarSlot): void;
}
export {};
//# sourceMappingURL=avatar-part-mount-manager.d.ts.map