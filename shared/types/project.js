/**
  * Build a default configuration for a fresh project.
  */
export function createDefaultGameProjectConfig(name = 'My Project', description) {
    return {
        version: 1,
        info: {
            name,
            visibility: 'private',
            genre: 'sandbox',
            ...(description ? { description } : {}),
        },
        camera: {
            fov: 60,
            near: 0.1,
            far: 800,
            thirdPersonOffset: [0, 1.6, -3],
        },
        gameplay: {
            maxPlayers: 1,
            allowJoinInProgress: false,
            respawnEnabled: true,
        },
        world: {
            gravity: 9.81,
            environmentPreset: 'stylized-balanced',
            spawn: {
                position: [0, 1.1, 0],
                rotation: [0, 0, 0, 1],
            },
        },
    };
}
//# sourceMappingURL=project.js.map