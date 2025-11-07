/**
 * Capability Types for Script Services
 * 
 * Defines capability names and permission structures for script APIs.
 */

/**
 * Capability names for script services
 */
export const SCRIPT_CAPABILITIES = {
  PHYSICS: 'physics',
  ANIMATION: 'animation',
  RENDERING: 'rendering',
} as const;

export type ScriptCapabilityName = typeof SCRIPT_CAPABILITIES[keyof typeof SCRIPT_CAPABILITIES];

/**
 * Permissions structure for script capabilities
 * Matches PlayManifest.permissions.script structure
 */
export interface ScriptCapabilityPermissions {
  physics?: boolean;
  animation?: boolean;
  rendering?: boolean;
}

/**
 * Helper to check if a capability is granted in permissions
 */
export function hasScriptCapability(
  permissions: ScriptCapabilityPermissions | undefined,
  capability: ScriptCapabilityName
): boolean {
  if (!permissions) {
    return false; // No permissions = no access
  }
  return permissions[capability] === true;
}

/**
 * Helper to get list of granted capabilities from permissions
 */
export function getGrantedCapabilities(
  permissions: ScriptCapabilityPermissions | undefined
): ScriptCapabilityName[] {
  if (!permissions) {
    return [];
  }
  const granted: ScriptCapabilityName[] = [];
  if (permissions.physics === true) granted.push(SCRIPT_CAPABILITIES.PHYSICS);
  if (permissions.animation === true) granted.push(SCRIPT_CAPABILITIES.ANIMATION);
  if (permissions.rendering === true) granted.push(SCRIPT_CAPABILITIES.RENDERING);
  return granted;
}

