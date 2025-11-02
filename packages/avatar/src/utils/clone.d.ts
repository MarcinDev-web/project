import type { Vec3, Quat } from '@engine/core/math';
import type { RgbaColor } from '@engine/world';
import type { AvatarPartDefinition } from '../slots';
type MutableRgbaColor = [number, number, number, number];
export declare function cloneColor(color: RgbaColor): MutableRgbaColor;
export declare function cloneColorRecord(colors: Record<string, RgbaColor>): Record<string, RgbaColor>;
export declare function cloneColorRecord(colors: undefined): undefined;
export declare function cloneVec3(vec: Vec3): Vec3;
export declare function cloneQuat(quat: Quat): Quat;
export declare function clonePartDefinition(definition: AvatarPartDefinition): AvatarPartDefinition;
export {};
//# sourceMappingURL=clone.d.ts.map