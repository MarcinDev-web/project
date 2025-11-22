// Particle Structures

struct Particle {
    position: vec3<f32>,
    life: f32,            // Remaining life (0.0 = dead)
    velocity: vec3<f32>,
    size: f32,
    color: vec4<f32>,
    rotation: f32,
    angularVelocity: f32,
    _pad0: f32,
    _pad1: f32,
};

struct ParticleSystemParams {
    deltaTime: f32,
    time: f32,
    maxParticles: u32,
    emitterPosition: vec3<f32>,
    emitterRange: vec3<f32>,
    gravity: vec3<f32>,
    drag: f32,
    emissionRate: f32,
    seed: f32,
};

