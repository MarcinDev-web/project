import { describe, it, expect } from 'vitest';
import { HistoryManager, type SceneSnapshot, snapshotsEqual } from './HistoryManager';

function createSnapshot(seed: Partial<SceneSnapshot> = {}): SceneSnapshot {
  return {
    sceneJSON: seed.sceneJSON ?? JSON.stringify({ entities: [] }),
    selectedPath: seed.selectedPath ? [...seed.selectedPath] : null,
    ...(seed.description !== undefined ? { description: seed.description } : {}),
    timestamp: seed.timestamp ?? Date.now(),
  };
}

describe('HistoryManager', () => {
  it('pushes snapshots and limits size', () => {
    const history = new HistoryManager(3);
    for (let i = 0; i < 5; i += 1) {
      history.push(createSnapshot({ sceneJSON: JSON.stringify({ index: i }) }));
    }

    expect(history.size()).toBe(3);
    expect(history.current?.sceneJSON).toContain('4');
  });

  it('supports undo and redo navigation', () => {
    const history = new HistoryManager(10);
    const snapshots = Array.from({ length: 4 }, (_, i) =>
      createSnapshot({ sceneJSON: JSON.stringify({ i }) })
    );
    snapshots.forEach((snapshot) => history.push(snapshot));

    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);

    const undone = history.undo();
    expect(undone?.sceneJSON).toContain('2');
    expect(history.canRedo()).toBe(true);

    const redone = history.redo();
    expect(redone?.sceneJSON).toContain('3');
  });

  it('clears redo stack when pushing after undo', () => {
    const history = new HistoryManager(10);
    history.push(createSnapshot({ sceneJSON: 'A' }));
    history.push(createSnapshot({ sceneJSON: 'B' }));

    expect(history.undo()?.sceneJSON).toBe('A');
    expect(history.canRedo()).toBe(true);

    history.push(createSnapshot({ sceneJSON: 'C' }));
    expect(history.canRedo()).toBe(false);
    expect(history.current?.sceneJSON).toBe('C');
  });

  it('returns null when undo/redo are not possible', () => {
    const history = new HistoryManager();
    expect(history.undo()).toBeNull();
    expect(history.redo()).toBeNull();

    history.push(createSnapshot({ sceneJSON: 'A' }));
    expect(history.undo()).toBeNull();
    expect(history.redo()).toBeNull();
  });
});

describe('snapshotsEqual', () => {
  it('compares sceneJSON and selected paths', () => {
    const a = createSnapshot({ sceneJSON: 'A', selectedPath: [0, 1] });
    const b = createSnapshot({ sceneJSON: 'A', selectedPath: [0, 1] });
    const c = createSnapshot({ sceneJSON: 'A', selectedPath: [1, 0] });
    const d = createSnapshot({ sceneJSON: 'B', selectedPath: [0, 1] });

    expect(snapshotsEqual(a, b)).toBe(true);
    expect(snapshotsEqual(a, c)).toBe(false);
    expect(snapshotsEqual(a, d)).toBe(false);
    expect(snapshotsEqual(null, null)).toBe(true);
    expect(snapshotsEqual(a, null)).toBe(false);
  });
});
