/**
 * Snapshot tests for scene serialization
 * Ensures serialization format remains stable across versions
 */

import { describe, it } from 'vitest';
import {
  expectSceneToMatchSnapshot,
  expectSerializationToBeStable,
  sceneFixtures,
} from '@engine/test-utils';

describe('Scene Serialization Snapshots', () => {
  it('serializes empty scene', () => {
    const scene = sceneFixtures.empty();
    expectSceneToMatchSnapshot(scene);
  });

  it('serializes scene with entities', () => {
    const scene = sceneFixtures.withEntities(3);
    expectSceneToMatchSnapshot(scene);
  });

  it('serializes scene hierarchy', () => {
    const scene = sceneFixtures.hierarchy();
    expectSceneToMatchSnapshot(scene, {
      exclude: ['_internal', 'cache'],
      sortArrays: true,
    });
  });

  it('maintains stable serialization format', () => {
    const scene = sceneFixtures.withEntities(2);
    
    const serialize = (s: any) => JSON.stringify(s);
    const deserialize = (json: string) => JSON.parse(json);

    expectSerializationToBeStable(scene, serialize, deserialize);
  });
});

