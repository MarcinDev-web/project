import { describe, it, expect, beforeEach, beforeAll} from 'vitest';
import { ProjectStorage, type ProjectData, type ProjectMetadata } from './ProjectStorage';
import type { SceneData } from '@engine/world';
import 'fake-indexeddb/auto';

describe('ProjectStorage', () => {
  let storage: ProjectStorage;

  beforeAll(() => {
    // fake-indexeddb/auto automatically polyfills global indexedDB
  });

  beforeEach(() => {
    storage = new ProjectStorage();
  });

  it('initializes without error', async () => {
    await expect(storage.initialize()).resolves.not.toThrow();
  });

  it('saves and loads a project', async () => {
    await storage.initialize();

    const sceneData: SceneData = {
      name: 'Test Scene',
      entities: [],
    };

    const metadata: ProjectMetadata = {
      id: 'test-project',
      name: 'Test Project',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const project: ProjectData = { metadata, scene: sceneData };

    await storage.saveProject(project);
    const loaded = await storage.loadProject('test-project');

    expect(loaded).not.toBeNull();
    expect(loaded?.metadata.id).toBe('test-project');
    expect(loaded?.metadata.name).toBe('Test Project');
    expect(loaded?.scene.name).toBe('Test Scene');
  });

  it('returns null for non-existent project', async () => {
    await storage.initialize();
    const loaded = await storage.loadProject('non-existent');
    expect(loaded).toBeNull();
  });

  it('lists projects sorted by update time', async () => {
    await storage.initialize();

    const project1: ProjectData = {
      metadata: {
        id: 'proj1',
        name: 'Project 1',
        createdAt: Date.now() - 2000,
        updatedAt: Date.now() - 2000,
      },
      scene: { name: 'Scene 1', entities: [] },
    };

    const project2: ProjectData = {
      metadata: {
        id: 'proj2',
        name: 'Project 2',
        createdAt: Date.now() - 1000,
        updatedAt: Date.now() - 1000,
      },
      scene: { name: 'Scene 2', entities: [] },
    };

    await storage.saveProject(project1);
    await storage.saveProject(project2);

    const list = await storage.listProjects();
    expect(list.length).toBeGreaterThanOrEqual(2);

    // Find our test projects in the list
    const proj1 = list.find((p) => p.id === 'proj1');
    const proj2 = list.find((p) => p.id === 'proj2');

    expect(proj1).toBeDefined();
    expect(proj2).toBeDefined();

    // proj2 should come before proj1 (newer first)
    const idx1 = list.findIndex((p) => p.id === 'proj1');
    const idx2 = list.findIndex((p) => p.id === 'proj2');
    expect(idx2).toBeLessThan(idx1);
  });

  it('deletes a project', async () => {
    await storage.initialize();

    const project: ProjectData = {
      metadata: {
        id: 'to-delete',
        name: 'Delete Me',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      scene: { name: 'Scene', entities: [] },
    };

    await storage.saveProject(project);
    expect(await storage.hasProject('to-delete')).toBe(true);

    await storage.deleteProject('to-delete');
    expect(await storage.hasProject('to-delete')).toBe(false);
  });

  it('checks if project exists', async () => {
    await storage.initialize();

    const project: ProjectData = {
      metadata: {
        id: 'exists',
        name: 'Exists',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      scene: { name: 'Scene', entities: [] },
    };

    expect(await storage.hasProject('exists')).toBe(false);
    await storage.saveProject(project);
    expect(await storage.hasProject('exists')).toBe(true);
  });

  it('updates existing project', async () => {
    await storage.initialize();

    const project1: ProjectData = {
      metadata: {
        id: 'update-test',
        name: 'Original Name',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      scene: { name: 'Scene 1', entities: [] },
    };

    await storage.saveProject(project1);

    const project2: ProjectData = {
      metadata: {
        id: 'update-test',
        name: 'Updated Name',
        createdAt: project1.metadata.createdAt,
        updatedAt: Date.now() + 1000,
      },
      scene: { name: 'Scene 2', entities: [] },
    };

    await storage.saveProject(project2);

    const loaded = await storage.loadProject('update-test');
    expect(loaded?.metadata.name).toBe('Updated Name');
    expect(loaded?.scene.name).toBe('Scene 2');
  });
});
