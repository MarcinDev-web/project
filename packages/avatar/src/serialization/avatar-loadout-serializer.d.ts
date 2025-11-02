import type { AvatarSlot, AvatarPartLibrary } from '../slots';
import type { AvatarLoadout } from '../avatar-instance';
import type { RgbaColor } from '@engine/world';
interface AvatarPartSelectionState {
    id: string;
    definition: any;
    colors?: Record<string, RgbaColor>;
    materialId?: string;
    appliedColors?: Record<string, RgbaColor>;
}
export interface ValidationResult {
    readonly valid: boolean;
    readonly errors: readonly string[];
}
/**
 * Manages serialization and validation of avatar loadouts.
 */
export declare class AvatarLoadoutSerializer {
    /**
     * Serialize selections map to AvatarLoadout.
     */
    serialize(selections: Map<AvatarSlot, AvatarPartSelectionState>): AvatarLoadout;
    /**
     * Validate a loadout against a part library.
     */
    validate(loadout: AvatarLoadout, partLibrary: AvatarPartLibrary): ValidationResult;
}
export {};
//# sourceMappingURL=avatar-loadout-serializer.d.ts.map