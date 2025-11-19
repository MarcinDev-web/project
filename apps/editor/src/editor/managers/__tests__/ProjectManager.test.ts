import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import type { TemplateMetadata } from '@engine/world-templates';
import { applyTo } from '@engine/world-templates';

vi.mock(
  '@engine/world',
  () => {
  class MockEntity {
    public components: unknown[] = [];
    public userData: Record<string, unknown> = {};
    public transform = {
      position: [0, 0, 0] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
      rotation: [0, 0, 0, 1] as [number, number, number, number],
    };

    constructor(public name: string) {}

    addComponent<T>(component: T): T {
      this.components.push(component);
      return component;
    }
  }

  class MockScene {
    public rootEntities: MockEntity[] = [];
    public entityCount = 0;

    constructor(public name = 'Scene') {}

    addEntity(entity: MockEntity): void {
      this.rootEntities.push(entity);
      this.entityCount = this.rootEntities.length;
    }

    removeEntity(entity: MockEntity): void {
      this.rootEntities = this.rootEntities.filter((candidate) => candidate !== entity);
      this.entityCount = this.rootEntities.length;
    }

    clear(): void {
      this.rootEntities = [];
      this.entityCount = 0;
    }

    toJSON(): unknown {
      return { name: this.name };
    }
  }

  class EnvironmentComponent {}

  return {
    Entity: MockEntity,
    Scene: MockScene,
    EnvironmentComponent,
  };
});

vi.mock('@engine/world-templates', () => ({
  applyTo: vi.fn(),
}));

vi.mock(
  '@engine/world/components/EnvironmentComponent',
  () => ({
    EnvironmentComponent: class {},
  })
);

const applyToMock = vi.mocked(applyTo);

let ProjectManager: typeof import('../ProjectManager').ProjectManager;
let Scene: any;

beforeAll(async () => {
  ({ ProjectManager } = await import('../ProjectManager'));
  ({ Scene } = await import('@engine/world'));
});

describe('ProjectManager - Templates', () => {
  let scene: InstanceType<typeof Scene>;
  let showStatusMessage: ReturnType<typeof vi.fn>;
  let updateSceneBuffers: ReturnType<typeof vi.fn>;
  let onSaveStatusChange: ReturnType<typeof vi.fn>;
  let manager: InstanceType<typeof ProjectManager>;

  type SceneEntity = InstanceType<typeof Scene>['rootEntities'][number];

  const templateMeta: TemplateMetadata = {
    id: 'template:test',
    kind: 'template',
    name: 'Test Template',
    description: 'Sample metadata',
    tags: ['sample'],
    version: '1.0.0',
  };

  beforeEach(() => {
    scene = new Scene('Initial');

    showStatusMessage = vi.fn();
    updateSceneBuffers = vi.fn();
    onSaveStatusChange = vi.fn();

    manager = new ProjectManager({
      scene,
      state: {} as any,
      updateSceneBuffers,
      showStatusMessage,
      onSaveStatusChange,
    });

    // Mock window methods if window is available (jsdom environment)
    if (typeof window !== 'undefined') {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      vi.spyOn(window, 'alert').mockImplementation(() => {});
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    applyToMock.mockReset();
  });

  it('creates a new project from template metadata', async () => {
    applyToMock.mockResolvedValue(undefined);

    await manager.newProjectFromTemplate(templateMeta);

    expect(applyToMock).toHaveBeenCalledWith(scene, templateMeta.id, { clear: true });
    expect(scene.name).toBe(templateMeta.name);
    expect(onSaveStatusChange).toHaveBeenLastCalledWith('');
    expect(showStatusMessage).toHaveBeenLastCalledWith(
      expect.stringContaining(templateMeta.name),
      1500
    );
    expect(updateSceneBuffers).toHaveBeenCalled();
  });

  it('falls back to empty project when template application fails', async () => {
    // First call fails, second call (fallback) succeeds
    applyToMock
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);

    await manager.newProjectFromTemplate(templateMeta);

    // Should have been called twice: once for requested template, once for empty fallback
    expect(applyToMock).toHaveBeenCalledTimes(2);
    expect(applyToMock).toHaveBeenNthCalledWith(1, scene, templateMeta.id, { clear: true });
    expect(applyToMock).toHaveBeenNthCalledWith(2, scene, 'template:empty', { clear: true });

    expect(showStatusMessage).toHaveBeenLastCalledWith(
      'Template failed, created empty project',
      1500
    );
    if (typeof window !== 'undefined') {
      expect(window.alert).toHaveBeenCalled();
    }
  });
});
