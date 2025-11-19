function createPowerUpPickups(scene: Scene): void {
  const powerUps: Array<{ type: PowerUpType; value: number; duration: number; position: Vec3; color: number }> = [
    { type: 'Speed', value: 1.5, duration: 10, position: [0, 1, 0], color: 6 }, // Yellow
    { type: 'Shield', value: 50, duration: 0, position: [-5, 1, 5], color: 9 }, // Blue
    { type: 'Health', value: 50, duration: 0, position: [5, 1, -5], color: 2 }, // Green
  ];

  powerUps.forEach((config, index) => {
    const pickup = new Entity(`PowerUp ${config.type} ${index}`);
    pickup.transform.position = [...config.position] as Vec3;
    pickup.transform.scale = [0.5, 0.5, 0.5];

    const mesh = new MeshComponent();
    mesh.meshType = 'sphere';
    pickup.addComponent(mesh);

    const material = new MaterialComponent();
    material.materialId = config.color;
    pickup.addComponent(material);

    const pickupComponent = new PowerUpPickupComponent();
    pickupComponent.type = config.type;
    pickupComponent.value = config.value;
    pickupComponent.duration = config.duration;
    pickupComponent.respawnTime = 15;
    pickup.addComponent(pickupComponent);

    // Add floating animation (handled by a system or simple script if we had one, 
    // for now just static)
    
    scene.addEntity(pickup);
  });
}
