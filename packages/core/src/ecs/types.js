/**
 * ECS Foundation Types
 * Base types for Entity-Component-System architecture
 */
/**
 * Generates a unique entity ID.
 */
let nextEntityId = 0;
export function generateEntityId() {
    return `entity_${nextEntityId++}`;
}
//# sourceMappingURL=types.js.map