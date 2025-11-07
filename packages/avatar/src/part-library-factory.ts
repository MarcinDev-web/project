import type { AvatarPartDefinition, AvatarPartLibrary } from './slots';
import { clonePartDefinition } from './utils/clone';
import { DEFAULT_AVATAR_PART_DEFINITIONS } from './default-parts';

/**
 * Creates an avatar part library from a collection of part definitions.
 * Validates for duplicate IDs and returns a normalized library.
 */
export function createAvatarPartLibrary(
  definitions: Iterable<AvatarPartDefinition>,
): AvatarPartLibrary {
  const library: AvatarPartLibrary = {};
  for (const definition of definitions) {
    const normalized = clonePartDefinition(definition);
    if (library[normalized.id]) {
      throw new Error(`Duplicate avatar part definition "${normalized.id}" detected.`);
    }
    library[normalized.id] = normalized;
  }
  return library;
}

/**
 * Default avatar part library with all standard parts.
 * This is a convenience export for backward compatibility.
 */
export const DEFAULT_AVATAR_PART_LIBRARY: AvatarPartLibrary = createAvatarPartLibrary(
  DEFAULT_AVATAR_PART_DEFINITIONS,
);

