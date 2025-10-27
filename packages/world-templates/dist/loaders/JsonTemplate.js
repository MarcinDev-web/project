import { Scene } from '@engine/world';
export function createJsonTemplate(meta, data) {
    return {
        meta,
        build: async () => {
            const sceneData = typeof data === 'function' ? await data() : data;
            return Scene.fromJSON(sceneData);
        },
    };
}
//# sourceMappingURL=JsonTemplate.js.map