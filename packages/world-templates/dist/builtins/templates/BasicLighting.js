import { Entity, Scene } from '@engine/world';
import { EnvironmentComponent, LightComponent } from '@engine/world';
export function createBasicLightingTemplate() {
    return {
        meta: {
            id: 'template:basic-lighting',
            kind: 'template',
            name: 'Basic Lighting',
            description: 'Environment + directional sun + ambient light',
            tags: ['lighting'],
            version: '1.0.0',
        },
        build: () => {
            const scene = new Scene('Basic Lighting');
            const env = new Entity('Environment');
            const envComp = new EnvironmentComponent();
            envComp.skyboxType = 'procedural-sky';
            envComp.ambientIntensity = 0.5;
            env.addComponent(envComp);
            scene.addEntity(env);
            const sun = new Entity('Sun');
            const sunLight = new LightComponent();
            sunLight.lightType = 'directional';
            sunLight.color = [1, 0.98, 0.92];
            sunLight.intensity = 1.0;
            sunLight.direction = [-0.2, -1.0, -0.2];
            sun.addComponent(sunLight);
            scene.addEntity(sun);
            const ambient = new Entity('AmbientLight');
            const ambLight = new LightComponent();
            ambLight.lightType = 'ambient';
            ambLight.color = [1, 1, 1];
            ambLight.intensity = 0.25;
            ambient.addComponent(ambLight);
            scene.addEntity(ambient);
            return scene;
        },
    };
}
//# sourceMappingURL=BasicLighting.js.map