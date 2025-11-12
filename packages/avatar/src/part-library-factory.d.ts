import type { AvatarPartDefinition, AvatarPartLibrary } from './slots';
/**
 * Creates an avatar part library from a collection of part definitions.
 * Validates for duplicate IDs and returns a normalized library.
 */
export declare function createAvatarPartLibrary(definitions: Iterable<AvatarPartDefinition>): AvatarPartLibrary;
/**
 * Default avatar part library with all standard parts.
 * This is a convenience export for backward compatibility.
 */
export declare const DEFAULT_AVATAR_PART_LIBRARY: AvatarPartLibrary;
//# sourceMappingURL=part-library-factory.d.ts.map