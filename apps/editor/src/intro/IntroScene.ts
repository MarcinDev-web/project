/**
 * Epic intro scene for Forge World
 * Features cinematic camera, particles, and animated branding
 */

import { Scene, Entity, MeshComponent, MaterialComponent } from '@engine/world';
import { initRenderer, type Renderer } from '@engine/gfx-webgpu';
import { 
  mat4Perspective, 
  mat4LookAt, 
  type Mat4, 
  type Vec3, 
  quatFromEulerOut,
  quatMultiplyOut,
  quatNormalizeOut
} from '@engine/core/math';
import { FOV_RADIANS, Z_FAR, Z_NEAR } from '@engine/gfx-webgpu/config';

export interface IntroSceneOptions {
  canvas: HTMLCanvasElement;
  onComplete: () => void;
  duration?: number; // Duration in seconds
  onPhaseChange?: (phase: string) => void;
}

interface Particle {
  position: Vec3;
  velocity: Vec3;
  life: number;
  maxLife: number;
  size: number;
  color: [number, number, number, number]; // RGBA
  type: 'spark' | 'ember' | 'glow'; // Different particle types
  rotationSpeed: number;
}

interface CameraPhase {
  name: string;
  startTime: number;
  endTime: number;
  radiusStart: number;
  radiusEnd: number;
  heightStart: number;
  heightEnd: number;
  speed: number;
  shake?: number; // Shake intensity
  targetYOffsetStart?: number;
  targetYOffsetEnd?: number;
  yawOffset?: number;
}

/**
 * Epic cinematic intro for Forge World
 */
export class IntroScene {
  private scene: Scene;
  private renderer: Renderer | null = null;
  private startTime = 0;
  private duration: number;
  private animationFrameId: number | null = null;
  private particles: Particle[] = [];
  private readonly particleCount = 300; // Increased!
  
  // Camera animation phases
  private cameraPhases: CameraPhase[] = [];
  private currentPhase: CameraPhase | null = null;
  private lastPhaseName: string | null = null;
  
  // Animated entities for tracking
  private orbitingCubes: Entity[] = [];
  private energyRings: Entity[] = [];
  
  // Time tracking for various effects
  private pulseTime = 0;
  
  // Matrices
  private readonly viewMatrix = new Float32Array(16);
  private readonly projectionMatrix = new Float32Array(16);
  
  constructor(private readonly options: IntroSceneOptions) {
    this.scene = new Scene('Forge World Intro');
    this.duration = options.duration ?? 5; // Default 5 seconds
    this.initializeParticles();
    this.initializeCameraPhases();
  }

  /**
   * Initialize camera animation phases
   */
  private initializeCameraPhases(): void {
    const d = this.duration;
 
     this.cameraPhases = [
      {
        name: 'logo',
        startTime: 0,
        endTime: d * 0.22,
        radiusStart: 6,
        radiusEnd: 11,
        heightStart: 3,
        heightEnd: 7,
        speed: 0.85,
        shake: 0.015,
        targetYOffsetStart: 1.6,
        targetYOffsetEnd: 1.2,
        yawOffset: Math.PI * 0.45,
      },
      {
        name: 'reveal',
        startTime: d * 0.22,
        endTime: d * 0.5,
        radiusStart: 11,
        radiusEnd: 18,
        heightStart: 7,
        heightEnd: 12,
        speed: 0.45,
        shake: 0.02,
        targetYOffsetStart: 1.2,
        targetYOffsetEnd: 0.6,
        yawOffset: Math.PI * 0.2,
      },
      {
        name: 'hero',
        startTime: d * 0.5,
        endTime: d * 0.78,
        radiusStart: 18,
        radiusEnd: 10,
        heightStart: 12,
        heightEnd: 6,
        speed: 0.35,
        shake: 0.035,
        targetYOffsetStart: 0.6,
        targetYOffsetEnd: 0.3,
        yawOffset: -Math.PI * 0.1,
      },
      {
        name: 'finale',
        startTime: d * 0.78,
        endTime: d,
        radiusStart: 10,
        radiusEnd: 16,
        heightStart: 6,
        heightEnd: 14,
        speed: 0.65,
        shake: 0.06,
        targetYOffsetStart: 0.3,
        targetYOffsetEnd: 1.5,
        yawOffset: Math.PI * 0.35,
      },
    ];
  }

  /**
   * Initialize particle system with multiple types and colors
   */
  private initializeParticles(): void {
    for (let i = 0; i < this.particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 20 + 5;
      const height = Math.random() * 10 - 5;
      
      // Determine particle type
      const rand = Math.random();
      let type: 'spark' | 'ember' | 'glow';
      let color: [number, number, number, number];
      let size: number;
      
      if (rand < 0.5) {
        // Blue sparks (50%)
        type = 'spark';
        color = [0.4, 0.6, 1.0, 1.0]; // Blue
        size = Math.random() * 0.2 + 0.05;
      } else if (rand < 0.8) {
        // Purple embers (30%)
        type = 'ember';
        color = [0.7, 0.4, 1.0, 1.0]; // Purple
        size = Math.random() * 0.3 + 0.1;
      } else {
        // Orange glow (20%)
        type = 'glow';
        color = [1.0, 0.5, 0.2, 1.0]; // Orange
        size = Math.random() * 0.4 + 0.15;
      }
      
      this.particles.push({
        position: [
          Math.cos(angle) * radius,
          height,
          Math.sin(angle) * radius,
        ],
        velocity: [
          (Math.random() - 0.5) * 0.5,
          Math.random() * 0.3 + 0.1,
          (Math.random() - 0.5) * 0.5,
        ],
        life: Math.random(),
        maxLife: Math.random() * 2 + 1,
        size,
        color,
        type,
        rotationSpeed: (Math.random() - 0.5) * 2,
      });
    }
  }

  /**
   * Create the intro scene geometry
   */
  private createIntroGeometry(): void {
    // Create central platform/pedestal with glow
    const platform = new Entity('Platform');
    platform.transform.position = [0, -2, 0];
    platform.transform.scale = [12, 0.3, 12];
    
    const platformMesh = new MeshComponent();
    platformMesh.meshType = 'cube';
    platform.addComponent(platformMesh);
    
    const platformMat = new MaterialComponent();
    platformMat.color = [0.3, 0.4, 0.7, 1.0]; // Brighter blue
    platformMat.emissiveColor = [0.1, 0.15, 0.3, 1.0]; // Subtle glow
    platformMat.emissiveIntensity = 1.0;
    platform.addComponent(platformMat);
    
    this.scene.addEntity(platform);

    // Create orbiting cubes for visual interest
    const cubeCount = 12; // Increased from 8
    for (let i = 0; i < cubeCount; i++) {
      const angle = (i / cubeCount) * Math.PI * 2;
      const layer = i % 3; // 3 layers
      const radius = 6 + layer * 2;
      const cube = new Entity(`Cube_${i}`);
      
      cube.transform.position = [
        Math.cos(angle) * radius,
        Math.sin(angle * 2) * 2 + layer,
        Math.sin(angle) * radius,
      ];
      
      const scale = 0.4 + Math.sin(i) * 0.15;
      cube.transform.scale = [scale, scale, scale];
      
      const cubeMesh = new MeshComponent();
      cubeMesh.meshType = 'cube';
      cube.addComponent(cubeMesh);
      
      // Color based on layer with EMISSIVE glow!
      const cubeMat = new MaterialComponent();
      if (layer === 0) {
        cubeMat.color = [0.5, 0.7, 1.0, 1.0]; // Bright blue
        cubeMat.emissiveColor = [0.3, 0.5, 0.8, 1.0]; // Blue glow
        cubeMat.emissiveIntensity = 2.0; // Bright!
      } else if (layer === 1) {
        cubeMat.color = [0.8, 0.5, 1.0, 1.0]; // Bright purple
        cubeMat.emissiveColor = [0.5, 0.3, 0.8, 1.0]; // Purple glow
        cubeMat.emissiveIntensity = 2.0;
      } else {
        cubeMat.color = [1.0, 0.6, 0.4, 1.0]; // Bright orange
        cubeMat.emissiveColor = [0.8, 0.4, 0.2, 1.0]; // Orange glow
        cubeMat.emissiveIntensity = 2.0;
      }
      cube.addComponent(cubeMat);
      
      this.scene.addEntity(cube);
      this.orbitingCubes.push(cube);
    }

    // Create energy rings
    const ringCount = 3;
    for (let i = 0; i < ringCount; i++) {
      const ring = new Entity(`Ring_${i}`);
      ring.transform.position = [0, -1 + i * 2, 0];
      ring.transform.scale = [8 - i * 2, 0.1, 8 - i * 2];
      
      const ringMesh = new MeshComponent();
      ringMesh.meshType = 'cube';
      ring.addComponent(ringMesh);
      
      const ringMat = new MaterialComponent();
      ringMat.color = [0.6 + i * 0.2, 0.8, 1.0, 0.4]; // Brighter translucent blue
      ringMat.emissiveColor = [0.4 + i * 0.3, 0.6, 1.0, 1.0]; // Strong blue glow
      ringMat.emissiveIntensity = 3.0; // Very bright!
      ring.addComponent(ringMat);
      
      this.scene.addEntity(ring);
      this.energyRings.push(ring);
    }

    // Create particle entities (increased count, with colors)
    for (let i = 0; i < Math.min(80, this.particleCount); i++) {
      const particle = this.particles[i];
      if (!particle) continue;
      
      const entity = new Entity(`Particle_${i}`);
      entity.transform.position = [...particle.position];
      entity.transform.scale = [particle.size, particle.size, particle.size];
      
      const particleMesh = new MeshComponent();
      particleMesh.meshType = 'cube';
      entity.addComponent(particleMesh);
      
      // Apply particle color with EMISSIVE!
      const particleMat = new MaterialComponent();
      particleMat.color = particle.color;
      // Make particles glow intensely for bloom effect
      particleMat.emissiveColor = [
        particle.color[0] * 0.9,
        particle.color[1] * 0.9,
        particle.color[2] * 0.9,
        1.0,
      ];
      particleMat.emissiveIntensity = 4.0; // Super bright!
      entity.addComponent(particleMat);
      
      this.scene.addEntity(entity);
    }
  }

  /**
   * Update camera for cinematic movement with phases
   */
  private updateCamera(time: number): void {
    let phase: CameraPhase | null = null;
    for (const candidate of this.cameraPhases) {
      if (time >= candidate.startTime && time <= candidate.endTime) {
        phase = candidate;
        break;
      }
    }

    if (!phase) {
      phase = this.cameraPhases[this.cameraPhases.length - 1] ?? null;
    }

    if (!phase) return;
    this.currentPhase = phase;

    if (phase.name !== this.lastPhaseName) {
      this.lastPhaseName = phase.name;
      this.options.onPhaseChange?.(phase.name);
    }

    const phaseDuration = Math.max(phase.endTime - phase.startTime, 0.0001);
    const rawProgress = (time - phase.startTime) / phaseDuration;
    const clampedProgress = Math.min(Math.max(rawProgress, 0), 1);
    const eased = this.easeInOutCubic(clampedProgress);

    const radius = this.lerp(phase.radiusStart, phase.radiusEnd, eased);
    const height = this.lerp(phase.heightStart, phase.heightEnd, eased);
    const yawOffset = phase.yawOffset ?? 0;
    const angle = time * Math.PI * 2 * phase.speed + yawOffset;

    const shake = phase.shake ?? 0;
    const shakeX = shake * Math.sin(time * 12) * Math.cos(time * 7.3);
    const shakeY = shake * Math.cos(time * 14.5) * Math.sin(time * 8.1);
    const shakeZ = shake * Math.sin(time * 11.8) * Math.cos(time * 9.7);

    const eyeX = Math.cos(angle) * radius + shakeX;
    const eyeY = height + shakeY;
    const eyeZ = Math.sin(angle) * radius + shakeZ;

    const targetYOffsetStart = phase.targetYOffsetStart ?? 0;
    const targetYOffsetEnd = phase.targetYOffsetEnd ?? 0;
    const targetYOffset = this.lerp(targetYOffsetStart, targetYOffsetEnd, eased);
    const targetX = Math.sin(angle * 0.25) * 1.2;
    const targetY = targetYOffset + Math.sin(time * 1.2) * 0.2;
    const targetZ = Math.cos(angle * 0.25) * 1.2;

    const aspect = this.options.canvas.width / this.options.canvas.height;
    mat4Perspective(this.projectionMatrix as Mat4, FOV_RADIANS, aspect, Z_NEAR, Z_FAR);
    mat4LookAt(
      this.viewMatrix as Mat4,
      [eyeX, eyeY, eyeZ],
      [targetX, targetY, targetZ],
      [0, 1, 0]
    );
  }

  /**
   * Update particle system with different behaviors per type
   */
  private updateParticles(deltaTime: number): void {
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      if (!particle) continue;
      
      // Type-specific velocity modifiers
      let velocityMult = 1.0;
      if (particle.type === 'spark') {
        velocityMult = 1.5; // Faster sparks
      } else if (particle.type === 'glow') {
        velocityMult = 0.7; // Slower glow
      }
      
      // Update position
      particle.position[0] += particle.velocity[0] * deltaTime * velocityMult;
      particle.position[1] += particle.velocity[1] * deltaTime * velocityMult;
      particle.position[2] += particle.velocity[2] * deltaTime * velocityMult;
      
      // Add gravity for embers
      if (particle.type === 'ember') {
        particle.velocity[1] -= 0.1 * deltaTime; // Gravity
      }
      
      // Update life
      particle.life += deltaTime;
      
      // Reset particle if it's too old or too high
      if (particle.life > particle.maxLife || particle.position[1] > 15) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 20 + 5;
        particle.position[0] = Math.cos(angle) * radius;
        particle.position[1] = -5 + Math.random() * 2;
        particle.position[2] = Math.sin(angle) * radius;
        particle.life = 0;
        
        // Reset velocity
        particle.velocity[1] = Math.random() * 0.3 + 0.1;
      }
      
      // Update entity if it exists
      const entityName = `Particle_${i}`;
      const entities = this.scene.getActiveEntities();
      for (const entity of entities) {
        if (entity.name === entityName) {
          entity.transform.position = [...particle.position];
          
          // Fade out based on life
          const material = entity.getComponent(MaterialComponent);
          if (material) {
            const lifeFade = 1.0 - (particle.life / particle.maxLife);
            material.color[3] = lifeFade; // Alpha
          }
          break;
        }
      }
    }
  }

  /**
   * Get glow intensity multiplier based on current camera phase
   */
  private getPhaseGlowMultiplier(): number {
    if (!this.currentPhase) return 1.0;
 
     switch (this.currentPhase.name) {
      case 'logo':
        return 0.7;
      case 'reveal':
        return 1.0;
      case 'hero':
        return 1.4;
      case 'finale':
        return 1.9;
      default:
        return 1.0;
    }
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private easeInOutCubic(t: number): number {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * Animate scene entities with proper quaternion rotations and dynamic emissive
   */
  private animateEntities(deltaTime: number): void {
    const glowMult = this.getPhaseGlowMultiplier();
    
    // Animate orbiting cubes with rotation
    this.orbitingCubes.forEach((cube, i) => {
      // Orbit rotation
      const orbitSpeed = 0.2 + (i % 3) * 0.1;
      const orbitAngle = this.pulseTime * orbitSpeed;
      const layer = i % 3;
      const radius = 6 + layer * 2;
      const originalAngle = (i / this.orbitingCubes.length) * Math.PI * 2;
      
      cube.transform.position = [
        Math.cos(originalAngle + orbitAngle) * radius,
        Math.sin(originalAngle * 2) * 2 + layer + Math.sin(this.pulseTime * 2) * 0.5,
        Math.sin(originalAngle + orbitAngle) * radius,
      ];
      
      // Self rotation using quaternions (smooth quaternion multiplication)
      const rotSpeed: [number, number, number] = [
        0.5 + i * 0.1,
        0.7 + i * 0.15,
        0.3 + i * 0.05,
      ];
      
      const deltaEuler: [number, number, number] = [
        rotSpeed[0] * deltaTime,
        rotSpeed[1] * deltaTime,
        rotSpeed[2] * deltaTime,
      ];
      
      const deltaRot: [number, number, number, number] = [0, 0, 0, 1];
      quatFromEulerOut(deltaRot, deltaEuler);
      
      // Multiply current rotation by delta rotation (incremental rotation)
      const newRot: [number, number, number, number] = [0, 0, 0, 1];
      quatMultiplyOut(newRot, cube.transform.rotation, deltaRot);
      // Normalize in-place to avoid allocations
      quatNormalizeOut(cube.transform.rotation, newRot);
      
      // Pulsing scale
      const pulseScale = 1.0 + Math.sin(this.pulseTime * 3 + i) * 0.1;
      const baseScale = 0.4 + Math.sin(i) * 0.15;
      cube.transform.scale = [
        baseScale * pulseScale,
        baseScale * pulseScale,
        baseScale * pulseScale,
      ];
      
      // Animate emissive for glowing effect
      const material = cube.getComponent(MaterialComponent);
      if (material) {
        const emissivePulse = Math.sin(this.pulseTime * 4 + i * 0.5) * 0.5 + 0.5;
        // Animate emissive intensity
        material.emissiveIntensity = 2.0 * glowMult * (0.8 + emissivePulse * 0.4);
      }
    });
    
    // Animate energy rings (pulsing and rotation)
    this.energyRings.forEach((ring, i) => {
      // Rotation using quaternion multiplication
      const rotSpeed = 0.3 + i * 0.2;
      const deltaEuler: [number, number, number] = [0, rotSpeed * deltaTime, 0];
      const deltaRot: [number, number, number, number] = [0, 0, 0, 1];
      quatFromEulerOut(deltaRot, deltaEuler);
      
      // Multiply current rotation by delta rotation (incremental rotation)
      const newRot: [number, number, number, number] = [0, 0, 0, 1];
      quatMultiplyOut(newRot, ring.transform.rotation, deltaRot);
      // Normalize in-place to avoid allocations
      quatNormalizeOut(ring.transform.rotation, newRot);
      
      // Pulsing scale
      const pulse = Math.sin(this.pulseTime * 2 + i * 0.5) * 0.2 + 1.0;
      const baseScale = 8 - i * 2;
      ring.transform.scale = [baseScale * pulse, 0.1, baseScale * pulse];
      
      // Pulsing alpha and emissive
      const material = ring.getComponent(MaterialComponent);
      if (material) {
        const alpha = 0.2 + Math.sin(this.pulseTime * 3 + i) * 0.15;
        material.color[3] = alpha;
        
        // Animate emissive for energy effect
        const emissivePulse = Math.sin(this.pulseTime * 5 + i * Math.PI) * 0.7 + 0.3;
        // Animate emissive intensity dramatically
        material.emissiveIntensity = 3.0 * glowMult * emissivePulse * 2.5;
      }
    });
  }

  /**
   * Start the intro sequence
   */
  public async start(): Promise<void> {
    this.lastPhaseName = null;

    try {
      // Initialize renderer with EPIC post-processing!
      this.renderer = await initRenderer({
        canvas: this.options.canvas,
        statusEl: document.createElement('div'), // Dummy status element
        getOrbitState: () => ({ yaw: 0, pitch: 0, distance: 15, panX: 0, panY: 0, panZ: 0 }),
        scene: this.scene,
        shouldSimulate: () => false,
        onFrameUpdate: () => {
          // Frame update handled in animation loop
        },
        // 🔥 EPIC POST-PROCESSING ENABLED!
        enableHDR: true,           // HDR for bright colors
        enableBloom: true,          // Bloom for glowing effects
        enableSSAO: false,          // SSAO disabled (not needed for intro)
        // FXAA is not configurable via initRenderer options
        enableShadows: false,       // Shadows disabled (not needed)
        msaaSampleCount: 4,         // 4x MSAA for smooth edges
      });

      // Create intro geometry
      this.createIntroGeometry();
      
      // Update scene buffers
      this.renderer.updateScene();
      
      // Start animation loop
      this.startTime = performance.now();
      this.animate();
      
    } catch (error) {
      console.error('Failed to start intro scene:', error);
      this.options.onComplete();
    }
  }

  /**
   * Animation loop
   */
  private lastFrameTime = 0;
  
  private animate = (): void => {
    const now = performance.now();
    const elapsed = (now - this.startTime) / 1000; // Convert to seconds
    
    // Calculate actual deltaTime
    const deltaTime = this.lastFrameTime > 0 ? (now - this.lastFrameTime) / 1000 : 1 / 60;
    this.lastFrameTime = now;
    
    // Update pulse time for animations
    this.pulseTime = elapsed;
    
    // Check if intro is complete
    if (elapsed >= this.duration) {
      this.stop();
      this.options.onComplete();
      return;
    }
    
    // Update camera with phases
    this.updateCamera(elapsed);
    
    // Update particles with type-specific behaviors
    this.updateParticles(deltaTime);
    
    // Animate entities with quaternion rotations and pulsing
    this.animateEntities(deltaTime);
    
    // Update renderer (this will trigger actual rendering)
    if (this.renderer) {
      try {
        this.renderer.updateScene();
      } catch (error) {
        console.warn('Renderer update failed in intro:', error);
      }
    }
    
    // Continue animation
    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  /**
   * Stop the intro and cleanup
   */
  public stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    if (this.renderer) {
      try {
        this.renderer.cleanup();
      } catch (error) {
        console.warn('Renderer cleanup failed:', error);
      }
      this.renderer = null;
    }
    
    this.scene.clear();
  }

  /**
   * Skip intro immediately
   */
  public skip(): void {
    this.stop();
    this.options.onComplete();
  }
}

