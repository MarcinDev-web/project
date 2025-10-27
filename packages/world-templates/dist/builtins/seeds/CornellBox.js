import { Scene, Entity } from '@engine/world';
import { LightComponent, MeshComponent, MaterialComponent } from '@engine/world';
// Minimal, stylized "Cornell Box" seed without external assets
export function createCornellBoxSeed() {
    return {
        meta: {
            id: 'seed:cornell-box',
            kind: 'seed',
            name: 'Cornell Box',
            description: 'Simple Cornell Box-like setup for shading tests',
            tags: ['seed', 'lighting', 'reference'],
            version: '0.1.0',
        },
        build: () => {
            const scene = new Scene('Cornell Box');
            // White area light above
            const light = new Entity('AreaLight');
            const lc = new LightComponent();
            lc.lightType = 'point';
            lc.color = [1, 1, 1];
            lc.intensity = 15;
            light.addComponent(lc);
            light.transform.position = [0, 4, 0];
            scene.addEntity(light);
            // Left wall (red)
            const left = new Entity('LeftWall');
            left.addComponent(new MeshComponent());
            const leftMat = new MaterialComponent();
            leftMat.color = [0.8, 0.1, 0.1, 1];
            left.addComponent(leftMat);
            left.transform.position = [-2.5, 0, 0];
            left.transform.scale = [0.1, 5, 5];
            scene.addEntity(left);
            // Right wall (green)
            const right = new Entity('RightWall');
            right.addComponent(new MeshComponent());
            const rightMat = new MaterialComponent();
            rightMat.color = [0.1, 0.8, 0.1, 1];
            right.addComponent(rightMat);
            right.transform.position = [2.5, 0, 0];
            right.transform.scale = [0.1, 5, 5];
            scene.addEntity(right);
            // Back wall
            const back = new Entity('BackWall');
            back.addComponent(new MeshComponent());
            back.transform.position = [0, 0, -2.5];
            back.transform.scale = [5, 5, 0.1];
            scene.addEntity(back);
            // Floor
            const floor = new Entity('Floor');
            floor.addComponent(new MeshComponent());
            floor.transform.position = [0, -2.5, 0];
            floor.transform.scale = [5, 0.1, 5];
            scene.addEntity(floor);
            // Box in the center
            const box = new Entity('Box');
            box.addComponent(new MeshComponent());
            box.transform.position = [0, -1.5, 0];
            box.transform.scale = [1.5, 1.5, 1.5];
            scene.addEntity(box);
            return scene;
        },
    };
}
//# sourceMappingURL=CornellBox.js.map