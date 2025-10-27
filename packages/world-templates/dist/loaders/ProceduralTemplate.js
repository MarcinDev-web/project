import { Scene as WorldScene } from '@engine/world';
export function createProceduralTemplate(meta, builder) {
    return {
        meta,
        build: async () => {
            const temp = new WorldScene(meta.name);
            const result = await builder(temp);
            return result ?? temp;
        },
    };
}
//# sourceMappingURL=ProceduralTemplate.js.map