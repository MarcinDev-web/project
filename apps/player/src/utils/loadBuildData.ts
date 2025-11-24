/**
 * Loads build data from marketplace API
 */

import type { Vec3 } from '@engine/core/math';
import type { GameProjectConfig } from '@shared/types/project';
import { createDefaultGameProjectConfig } from '@shared/types/project';
import { Scenarios } from '@engine/stdlib';

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
    enableMultiplayer?: boolean;
  };
  gameplay?: {
    respawnEnabled?: boolean;
    maxPlayers?: number;
    allowJoinInProgress?: boolean;
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
        shape?: 'capsule';
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
        crouch?: string[];
        fire?: string[];
      };
    };
  };
}

export interface BuildData {
  sceneJSON: string;
  playerStart?: { position: Vec3; rotation: number };
  manifest?: PlayManifest | null;
}

interface ProjectData {
  metadata: any;
  scene: any;
  config?: GameProjectConfig;
}

/**
 * Loads build data from marketplace API endpoint
 * 
 * @param buildId - Marketplace item ID (type: 'build')
 * @returns Build data with scene JSON and optional player start position
 * @throws Error if build not found or invalid data
 */
export async function loadBuildData(buildId: string): Promise<BuildData> {
  // Special Case: SDF Demo
  if (buildId === 'sdf-demo') {
    const scene = Scenarios.createSDFDemoScene();
    const sceneJSON = JSON.stringify(scene.toJSON());
    
    return {
      sceneJSON,
      playerStart: { position: [0, 2, 5], rotation: 0 },
      manifest: {
        version: 1,
        playerStart: { position: [0, 2, 5], rotation: 0 },
        simulation: { enableMultiplayer: false },
        pawn: {
          cameraTarget: { offset: [0, 0, 0], collisionRadius: 0.1 },
          physics: { rigidbody: { type: 'kinematic', mass: 1, useGravity: false } },
          kcc: { moveSpeed: 10, sprintMultiplier: 2, jumpForce: 0, gravityMultiplier: 0 }
        },
        controller: {
          input: {
             movement: {
              forward: ['KeyW', 'ArrowUp'],
              backward: ['KeyS', 'ArrowDown'],
              left: ['KeyA', 'ArrowLeft'],
              right: ['KeyD', 'ArrowRight']
            },
            actions: {
              sprint: ['ShiftLeft'],
            }
          },
          preferences: { fov: 60, invertY: false, sensitivity: 0.0025 }
        }
      }
    };
  }

  // Special Case: GTA Demo
  if (buildId === 'gta-demo') {
    const scene = Scenarios.createCityDemoScene();
    const sceneJSON = JSON.stringify(scene.toJSON());
    
    return {
      sceneJSON,
      playerStart: { position: [0, 5, 0], rotation: 0 },
      manifest: {
        version: 1,
        playerStart: {
          position: [0, 5, 0],
          rotation: 0
        },
        simulation: {
          enableMultiplayer: false
        },
        pawn: {
          cameraTarget: {
            offset: [0, 1.8, 0],
            collisionRadius: 0.3
          },
          physics: {
            rigidbody: {
              type: 'dynamic',
              mass: 80,
              useGravity: true
            },
            collider: {
              shape: 'capsule',
              radius: 0.4,
              height: 1.8,
              center: [0, 0.9, 0]
            },
            material: {
              friction: 0.1, // Low friction for sliding/drifting
              restitution: 0.0
            }
          },
          kcc: {
            moveSpeed: 20.0, // Very fast run speed
            sprintMultiplier: 2.0, // Super fast sprint (40 m/s)
            jumpForce: 15.0, // High jump
            gravityMultiplier: 2.0, // Heavy gravity for snappy falls
            airControlMultiplier: 0.1, // Low air control
            rotationSpeed: 5.0,
            autoRotate: true,
            stepHeight: 0.6,
            maxSlopeAngle: 50
          }
        },
        controller: {
          input: {
            movement: {
              forward: ['KeyW', 'ArrowUp'],
              backward: ['KeyS', 'ArrowDown'],
              left: ['KeyA', 'ArrowLeft'],
              right: ['KeyD', 'ArrowRight']
            },
            actions: {
              jump: ['Space'],
              sprint: ['ShiftLeft', 'ShiftRight'],
              interact: ['KeyE'],
              crouch: ['KeyC', 'ControlLeft'],
              fire: ['Mouse0'] // Add fire action bound to left mouse button
            }
          },
          preferences: {
            fov: 90,
            invertY: false,
            sensitivity: 0.0025
          }
        }
      }
    };
  }

  const response = await fetch(`/api/marketplace/${buildId}/build`);
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Build not found: ${buildId}`);
    }
    throw new Error(`Failed to load build: ${response.statusText} (${response.status})`);
  }
  
  const data = await response.json();
  
  // Handle ProjectData format (from Studio/Editor)
  // ProjectData has 'scene' (object) and 'config' (object)
  if (data.scene && typeof data.scene === 'object' && !data.sceneJSON) {
    const projectData = data as ProjectData;
    const config = projectData.config || createDefaultGameProjectConfig();
    
    // Convert scene object to JSON string for hydration
    const sceneJSON = JSON.stringify(projectData.scene);
    
    // Extract spawn position and rotation
    const spawnPos = config.world.spawn.position;
    const spawnRotQuat = config.world.spawn.rotation;
    
    // Convert Quaternion [x, y, z, w] to Yaw (rotation around Y axis)
    let spawnYaw = 0;
    if (spawnRotQuat) {
      const [x, y, z, w] = spawnRotQuat;
      // Extract yaw from quaternion: atan2(2(wy + zx), 1 - 2(y^2 + z^2))
      const siny_cosp = 2 * (w * y + z * x);
      const cosy_cosp = 1 - 2 * (y * y + z * z);
      spawnYaw = Math.atan2(siny_cosp, cosy_cosp);
    }

    // Create manifest from config
    const manifest: PlayManifest = {
      version: 1,
      playerStart: {
        position: spawnPos,
        rotation: spawnYaw
      },
      simulation: {
        enableMultiplayer: config.gameplay.maxPlayers > 1
      },
      gameplay: {
        maxPlayers: config.gameplay.maxPlayers,
        allowJoinInProgress: config.gameplay.allowJoinInProgress,
        respawnEnabled: config.gameplay.respawnEnabled
      },
      controller: {
        preferences: {
          fov: config.camera.fov
        }
      }
    };
    
    return {
      sceneJSON,
      playerStart: { position: spawnPos, rotation: spawnYaw },
      manifest
    };
  }
  
  // Legacy format handling
  
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
