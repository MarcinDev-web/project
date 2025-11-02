import { Scene, Entity, type EntityData, type SceneData } from '@engine/world';

const TRANSIENT_ENTITY_IDS = new Set<string>(['__editor_preview_player']);

/** Finds path to an entity within the scene's root hierarchy. */
export function computeEntityPath(scene: Scene, entity: Entity | null): number[] | null {
  if (!entity) return null;
  const path: number[] = [];
  let current: Entity | null = entity;
  while (current) {
    const parent: Entity | null = current.parent;
    const siblings: ReadonlyArray<Entity> = parent ? parent.children : scene.rootEntities;
    const index = siblings.findIndex((child) => child === current);
    if (index === -1) {
      return null;
    }
    path.unshift(index);
    current = parent;
  }
  return path;
}

/** Resolves entity by path within a scene hierarchy. */
export function resolveEntityByPath(scene: Scene, path: number[] | null): Entity | null {
  if (!path || path.length === 0) return null;
  let nodes = scene.rootEntities;
  let entity: Entity | undefined;
  for (const index of path) {
    entity = nodes[index];
    if (!entity) return null;
    nodes = entity.children as Entity[];
  }
  return entity ?? null;
}

export function serializeScene(scene: Scene): string {
  const sceneData = scene.toJSON() as SceneData;
  return JSON.stringify({
    ...sceneData,
    entities: pruneTransientEntities(sceneData.entities),
  });
}

export function hydrateScene(scene: Scene, json: string): void {
  const data = JSON.parse(json);
  const restored = Scene.fromJSON(data);

  scene.clear();
  restored.rootEntities.forEach((entity: Entity) => {
    scene.addEntity(entity);
  });
}

function pruneTransientEntities(entities: EntityData[]): EntityData[] {
  const pruned: EntityData[] = [];
  for (const entity of entities) {
    if (isTransientEntity(entity)) {
      continue;
    }
    const children = entity.children?.length ? pruneTransientEntities(entity.children) : [];
    pruned.push({
      ...entity,
      children,
    });
  }
  return pruned;
}

function isTransientEntity(entity: EntityData): boolean {
  if (TRANSIENT_ENTITY_IDS.has(entity.id)) {
    return true;
  }
  const userData = entity.userData as Record<string, unknown> | undefined;
  return userData?.isEditorPreviewPlayer === true;
}

