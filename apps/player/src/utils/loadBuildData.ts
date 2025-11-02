/**
 * Loads build data from marketplace API
 */

import type { Vec3 } from '@engine/core/math';

// Simplified PlayManifest interface (matches structure from build data)
interface PlayManifest {
  version?: number;
  playerStart?: {
    position: Vec3;
    rotation: number;
  };
  simulation?: {
    fixedDeltaTime?: number;
    maxSubsteps?: number;
  };
  pawn?: {
    cameraTarget?: {
      offset: Vec3;
      collisionRadius?: number;
    };
    physics?: {
      rigidbody?: {
        type?: 'kinematic' | 'dynamic';
        mass?: number;
        useGravity?: boolean;
      };
      collider?: {
        radius?: number;
        height?: number;
        center?: Vec3;
      };
      material?: {
        friction?: number;
        restitution?: number;
      };
    };
    kcc?: {
      moveSpeed?: number;
      sprintMultiplier?: number;
      jumpForce?: number;
      gravityMultiplier?: number;
      maxSlopeAngle?: number;
      stepHeight?: number;
      groundCheckDistance?: number;
      airControlMultiplier?: number;
      rotationSpeed?: number;
      autoRotate?: boolean;
    };
  };
  controller?: {
    preferences?: {
      fov?: number;
      invertY?: boolean;
      sensitivity?: number;
    };
    input?: {
      movement?: {
        forward?: string[];
        backward?: string[];
        left?: string[];
        right?: string[];
      };
      actions?: {
        jump?: string[];
        sprint?: string[];
        interact?: string[];
      };
    };
  };
}

export interface BuildData {
  sceneJSON: string;
  playerStart?: { position: Vec3; rotation: number };
  manifest?: PlayManifest | null;
}

/**
 * Loads build data from marketplace API endpoint
 * 
 * @param buildId - Marketplace item ID (type: 'build')
 * @returns Build data with scene JSON and optional player start position
 * @throws Error if build not found or invalid data
 */
export async function loadBuildData(buildId: string): Promise<BuildData> {
  const response = await fetch(`/api/marketplace/${buildId}/build`);
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Build not found: ${buildId}`);
    }
    throw new Error(`Failed to load build: ${response.statusText} (${response.status})`);
  }
  
  const data = await response.json();
  
  // Validate structure - buildData powinien zawierać sceneJSON
  if (!data.sceneJSON) {
    throw new Error('Invalid build data: missing sceneJSON');
  }
  
  // Validate sceneJSON is a string
  if (typeof data.sceneJSON !== 'string') {
    throw new Error('Invalid build data: sceneJSON must be a string');
  }
  
  return {
    sceneJSON: data.sceneJSON,
    playerStart: data.playerStart ?? { position: [0, 2, 0], rotation: 0 },
    manifest: data.manifest ?? null,
  };
}

