import type { Vec3 } from '@engine/core/math';
import { normalizeVec3, lerpVec3 } from '@engine/core/math';
import type { CharacterInputHandler } from '@engine/input';
import type { CameraMode } from '@engine/camera';
import type { PhysicsWorld } from '@engine/world';
import { PreviewAvatar } from './PreviewAvatar';

interface UpdateParams {
  deltaTime: number;
  cameraYaw: number;
  cameraPitch: number;
  cameraForward: Vec3;
  cameraRight: Vec3;
  mode: CameraMode;
}

interface UpdateResult {
  yaw?: number | undefined;
}

const GRAVITY = 20.0;
const GROUND_CHECK_OFFSET = 0.5; // Start raycast slightly above feet
const GROUND_CHECK_DISTANCE = 0.6; // Check slightly below feet
const INERTIA_FACTOR = 10.0; // Higher = more responsive, Lower = more slippery
const ROTATION_SMOOTHING = 15.0;

/**
 * Handles movement simulation with physics integration (raycast collision) 
 * and inertia for the editor preview avatar.
 */
export class PreviewAvatarController {
  private readonly avatar: PreviewAvatar;
  private readonly input: CharacterInputHandler | null;
  private readonly physicsWorld: PhysicsWorld | undefined;

  private currentVelocity: Vec3 = [0, 0, 0];
  private verticalVelocity = 0;
  private targetYaw: number | null = null;
  private currentYaw = 0;

  constructor(
    avatar: PreviewAvatar, 
    input: CharacterInputHandler | null,
    physicsWorld?: PhysicsWorld
  ) {
    this.avatar = avatar;
    this.input = input ?? null;
    this.physicsWorld = physicsWorld;
    
    const pose = avatar.getPose();
    this.currentYaw = pose.yaw;
  }

  update(params: UpdateParams): UpdateResult {
    if (!this.input) {
      return {};
    }

    if (params.mode !== 'third-person' && params.mode !== 'fps') {
      return {};
    }
    
    const config = this.avatar.getConfig();
    const dt = params.deltaTime;

    this.input.setCameraDirections(params.cameraForward, params.cameraRight);
    const inputState = this.input.getInput();
    const move = inputState.moveDirection;
    const hasInput = Math.abs(move[0]) > 1e-3 || Math.abs(move[2]) > 1e-3;

    // 1. Calculate Target Velocity
    const speed = (inputState.sprint ? config.walkSpeed * config.sprintMultiplier : config.walkSpeed);
    let targetVelocity: Vec3 = [0, 0, 0];

    if (hasInput) {
      const forward = this.horizontalForward(params.cameraYaw);
      const right = this.horizontalRight(params.cameraYaw);
      
      const worldX = forward[0] * move[2] + right[0] * move[0];
      const worldZ = forward[2] * move[2] + right[2] * move[0];
      const length = Math.hypot(worldX, worldZ);

      if (length > 1e-4) {
        targetVelocity = [
          (worldX / length) * speed,
          0,
          (worldZ / length) * speed
        ];
      }
    }

    // 2. Apply Inertia (Phase 3)
    // Lerp current velocity towards target velocity
    const lerpFactor = Math.min(dt * INERTIA_FACTOR, 1.0);
    this.currentVelocity = lerpVec3(this.currentVelocity, targetVelocity, lerpFactor);

    // 3. Update Animation State
    // Use current velocity magnitude to determine animation
    const speedSq = this.currentVelocity[0] ** 2 + this.currentVelocity[2] ** 2;
    if (speedSq > 0.1) {
      if (inputState.sprint) {
        this.avatar.playRunAnimation();
      } else {
        this.avatar.playWalkAnimation();
      }
    } else {
      this.avatar.playIdleAnimation();
    }

    // 4. Physics & Gravity (Phase 2)
    const pose = this.avatar.getPose();
    let nextPosition: Vec3 = [...pose.position] as Vec3;

    // Apply Gravity
    if (this.physicsWorld) {
      this.verticalVelocity -= GRAVITY * dt;
      nextPosition[1] += this.verticalVelocity * dt;

      // Ground Check (Raycast)
      const rayOrigin: Vec3 = [nextPosition[0], nextPosition[1] + GROUND_CHECK_OFFSET, nextPosition[2]];
      const hit = this.physicsWorld.raycast(rayOrigin, [0, -1, 0], { maxDistance: GROUND_CHECK_DISTANCE });

      if (hit) {
        // Grounded
        nextPosition[1] = hit.point[1];
        this.verticalVelocity = Math.max(0, this.verticalVelocity); // Stop falling
      } else if (nextPosition[1] < 0) {
        // Fallback floor at Y=0 if no physics or missed raycast
        nextPosition[1] = 0;
        this.verticalVelocity = 0;
      }
    } else {
      // No physics world - just stick to Y=0 or keep current Y
      // For simple preview without physics, we might want to keep it simple
      nextPosition[1] = Math.max(0, nextPosition[1]); 
    }

    // 5. Wall Collision (Phase 2)
    // Calculate horizontal displacement
    const displacement: Vec3 = [
      this.currentVelocity[0] * dt,
      0,
      this.currentVelocity[2] * dt
    ];

    if (this.physicsWorld && (Math.abs(displacement[0]) > 1e-5 || Math.abs(displacement[2]) > 1e-5)) {
      const dist = Math.hypot(displacement[0], displacement[2]);
      const dir = normalizeVec3(displacement);
      
      // Cast ray forward from center (slightly up)
      const rayOrigin: Vec3 = [nextPosition[0], nextPosition[1] + config.cameraPivotHeight * 0.5, nextPosition[2]];
      const hit = this.physicsWorld.raycast(rayOrigin, dir, { maxDistance: dist + 0.3 }); // + margin

      if (hit && hit.distance < dist + 0.1) {
        // Hit wall - simple stop for now (slide could be implemented with dot product)
        displacement[0] = 0;
        displacement[2] = 0;
        this.currentVelocity[0] = 0;
        this.currentVelocity[2] = 0;
      }
    }

    nextPosition[0] += displacement[0];
    nextPosition[2] += displacement[2];

    this.avatar.setPosition(nextPosition);

    // 6. Rotation Smoothing (Phase 3)
    let returnYaw = undefined;

    // Determine target yaw
    if (hasInput) {
      const forward = this.horizontalForward(params.cameraYaw);
      const right = this.horizontalRight(params.cameraYaw);
      const worldX = forward[0] * move[2] + right[0] * move[0];
      const worldZ = forward[2] * move[2] + right[2] * move[0];
      if (Math.hypot(worldX, worldZ) > 1e-4) {
        this.targetYaw = Math.atan2(worldX, -worldZ);
      }
    } else if (params.mode === 'fps') {
        this.targetYaw = params.cameraYaw;
        returnYaw = params.cameraYaw;
    }

    if (this.targetYaw !== null) {
      // Smooth rotation
      const diff = this.targetYaw - this.currentYaw;
      // Normalize angle to -PI..PI
      const normalizedDiff = Math.atan2(Math.sin(diff), Math.cos(diff));
      
      const rotLerp = Math.min(dt * ROTATION_SMOOTHING, 1.0);
      this.currentYaw += normalizedDiff * rotLerp;
      
      this.avatar.setYaw(this.currentYaw);
    }

    return { yaw: returnYaw };
  }

  private horizontalForward(yaw: number): Vec3 {
    return [Math.sin(yaw), 0, -Math.cos(yaw)] as Vec3;
  }

  private horizontalRight(yaw: number): Vec3 {
    return [Math.cos(yaw), 0, Math.sin(yaw)] as Vec3;
  }
}

