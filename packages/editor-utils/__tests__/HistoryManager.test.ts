import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryManager, snapshotsEqual } from '../src/HistoryManager';
import type { SceneSnapshot } from '../src/HistoryManager';

function createSnapshot(description: string, selectedPath: number[] | null = null): SceneSnapshot {
  return {
    sceneJSON: JSON.stringify({ description }),
    selectedPath,
    description,
    timestamp: Date.now(),
  };
}

describe('HistoryManager', () => {
  let history: HistoryManager;

  beforeEach(() => {
    history = new HistoryManager();
  });

  describe('initialization', () => {
    it('should initialize with empty history', () => {
      expect(history.size()).toBe(0);
      expect(history.current).toBeNull();
    });

    it('should initialize with custom max size', () => {
      const customHistory = new HistoryManager(50);
      expect(customHistory.limit).toBe(50);
    });
  });

  describe('push', () => {
    it('should add snapshot to history', () => {
      const snapshot = createSnapshot('First snapshot');
      history.push(snapshot);

      expect(history.size()).toBe(1);
      expect(history.current).not.toBeNull();
      expect(history.current?.description).toBe('First snapshot');
    });

    it('should add multiple snapshots', () => {
      history.push(createSnapshot('Snapshot 1'));
      history.push(createSnapshot('Snapshot 2'));
      history.push(createSnapshot('Snapshot 3'));

      expect(history.size()).toBe(3);
      expect(history.current?.description).toBe('Snapshot 3');
    });

    it('should clear redo stack when pushing new snapshot', () => {
      history.push(createSnapshot('Snapshot 1'));
      history.push(createSnapshot('Snapshot 2'));
      history.push(createSnapshot('Snapshot 3'));

      // Undo twice
      history.undo();
      history.undo();

      expect(history.canRedo()).toBe(true);

      // Push new snapshot should clear redo stack
      history.push(createSnapshot('New snapshot'));

      expect(history.canRedo()).toBe(false);
      expect(history.size()).toBe(2); // Snapshot 1 + New snapshot
    });

    it('should respect max size limit', () => {
      const smallHistory = new HistoryManager(3);

      smallHistory.push(createSnapshot('Snapshot 1'));
      smallHistory.push(createSnapshot('Snapshot 2'));
      smallHistory.push(createSnapshot('Snapshot 3'));
      smallHistory.push(createSnapshot('Snapshot 4'));

      expect(smallHistory.size()).toBe(3);
      expect(smallHistory.current?.description).toBe('Snapshot 4');
    });

    it('should clone snapshot data', () => {
      const snapshot = createSnapshot('Original', [1, 2, 3]);
      history.push(snapshot);

      // Mutate original
      snapshot.description = 'Modified';
      snapshot.selectedPath![0] = 999;

      // History should have cloned data
      expect(history.current?.description).toBe('Original');
      expect(history.current?.selectedPath).toEqual([1, 2, 3]);
    });

    it('should not push when frozen', () => {
      history.freeze();
      history.push(createSnapshot('Frozen snapshot'));

      expect(history.size()).toBe(0);
    });
  });

  describe('undo/redo', () => {
    beforeEach(() => {
      history.push(createSnapshot('Snapshot 1'));
      history.push(createSnapshot('Snapshot 2'));
      history.push(createSnapshot('Snapshot 3'));
    });

    it('should undo to previous snapshot', () => {
      expect(history.current?.description).toBe('Snapshot 3');

      const undone = history.undo();
      expect(undone?.description).toBe('Snapshot 2');
      expect(history.current?.description).toBe('Snapshot 2');
    });

    it('should redo to next snapshot', () => {
      history.undo();
      expect(history.current?.description).toBe('Snapshot 2');

      const redone = history.redo();
      expect(redone?.description).toBe('Snapshot 3');
      expect(history.current?.description).toBe('Snapshot 3');
    });

    it('should handle multiple undos', () => {
      history.undo();
      history.undo();

      expect(history.current?.description).toBe('Snapshot 1');
    });

    it('should handle multiple redos', () => {
      history.undo();
      history.undo();
      history.redo();
      history.redo();

      expect(history.current?.description).toBe('Snapshot 3');
    });

    it('should return null when cannot undo', () => {
      history.undo();
      history.undo();
      const result = history.undo();

      expect(result).toBeNull();
      expect(history.current?.description).toBe('Snapshot 1');
    });

    it('should return null when cannot redo', () => {
      const result = history.redo();

      expect(result).toBeNull();
    });

    it('should report canUndo correctly', () => {
      expect(history.canUndo()).toBe(true);

      history.undo();
      expect(history.canUndo()).toBe(true);

      history.undo();
      expect(history.canUndo()).toBe(false); // At first snapshot
    });

    it('should report canRedo correctly', () => {
      expect(history.canRedo()).toBe(false);

      history.undo();
      expect(history.canRedo()).toBe(true);

      history.redo();
      expect(history.canRedo()).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all history', () => {
      history.push(createSnapshot('Snapshot 1'));
      history.push(createSnapshot('Snapshot 2'));

      history.clear();

      expect(history.size()).toBe(0);
      expect(history.current).toBeNull();
      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(false);
    });
  });

  describe('freeze/unfreeze', () => {
    it('should prevent pushes when frozen', () => {
      history.freeze();
      history.push(createSnapshot('Frozen 1'));
      history.push(createSnapshot('Frozen 2'));

      expect(history.size()).toBe(0);
    });

    it('should allow pushes after unfreeze', () => {
      history.freeze();
      history.push(createSnapshot('Frozen'));

      history.unfreeze();
      history.push(createSnapshot('Unfrozen'));

      expect(history.size()).toBe(1);
      expect(history.current?.description).toBe('Unfrozen');
    });
  });

  describe('export/replace', () => {
    it('should export all snapshots', () => {
      history.push(createSnapshot('Snapshot 1'));
      history.push(createSnapshot('Snapshot 2'));
      history.push(createSnapshot('Snapshot 3'));

      const exported = history.export();

      expect(exported).toHaveLength(3);
      expect(exported[0].description).toBe('Snapshot 1');
      expect(exported[1].description).toBe('Snapshot 2');
      expect(exported[2].description).toBe('Snapshot 3');
    });

    it('should export cloned snapshots', () => {
      history.push(createSnapshot('Original', [1, 2, 3]));

      const exported = history.export();
      exported[0].description = 'Modified';
      exported[0].selectedPath![0] = 999;

      expect(history.current?.description).toBe('Original');
      expect(history.current?.selectedPath).toEqual([1, 2, 3]);
    });

    it('should replace history with new snapshots', () => {
      history.push(createSnapshot('Old 1'));
      history.push(createSnapshot('Old 2'));

      const newSnapshots = [
        createSnapshot('New 1'),
        createSnapshot('New 2'),
        createSnapshot('New 3'),
      ];

      history.replace(newSnapshots);

      expect(history.size()).toBe(3);
      expect(history.current?.description).toBe('New 3');
    });

    it('should respect max size when replacing', () => {
      const smallHistory = new HistoryManager(2);

      const snapshots = [
        createSnapshot('Snapshot 1'),
        createSnapshot('Snapshot 2'),
        createSnapshot('Snapshot 3'),
        createSnapshot('Snapshot 4'),
      ];

      smallHistory.replace(snapshots);

      expect(smallHistory.size()).toBe(2);
      expect(smallHistory.current?.description).toBe('Snapshot 4');
    });

    it('should clone snapshots when replacing', () => {
      const snapshots = [createSnapshot('Original', [1, 2, 3])];
      history.replace(snapshots);

      // Mutate original
      snapshots[0].description = 'Modified';
      snapshots[0].selectedPath![0] = 999;

      expect(history.current?.description).toBe('Original');
      expect(history.current?.selectedPath).toEqual([1, 2, 3]);
    });
  });

  describe('setLimit', () => {
    it('should update history limit', () => {
      history.setLimit(50);
      expect(history.limit).toBe(50);
    });

    it('should trim history when reducing limit', () => {
      history.push(createSnapshot('Snapshot 1'));
      history.push(createSnapshot('Snapshot 2'));
      history.push(createSnapshot('Snapshot 3'));
      history.push(createSnapshot('Snapshot 4'));
      history.push(createSnapshot('Snapshot 5'));

      history.setLimit(3);

      expect(history.size()).toBe(3);
      expect(history.current?.description).toBe('Snapshot 5');
    });

    it('should throw on invalid limit', () => {
      expect(() => history.setLimit(0)).toThrow('History limit must be positive');
      expect(() => history.setLimit(-1)).toThrow('History limit must be positive');
      expect(() => history.setLimit(NaN)).toThrow('History limit must be positive');
      expect(() => history.setLimit(Infinity)).toThrow('History limit must be positive');
    });

    it('should floor fractional limits', () => {
      history.setLimit(10.7);
      expect(history.limit).toBe(10);
    });

    it('should not change history if limit is same', () => {
      history.push(createSnapshot('Snapshot 1'));
      const currentHistory = history.export();

      history.setLimit(100); // Same as default

      expect(history.export()).toEqual(currentHistory);
    });
  });

  describe('edge cases', () => {
    it('should handle empty history operations', () => {
      expect(history.undo()).toBeNull();
      expect(history.redo()).toBeNull();
      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(false);
      expect(history.current).toBeNull();
    });

    it('should handle snapshot without description', () => {
      const snapshot: SceneSnapshot = {
        sceneJSON: JSON.stringify({ data: 'test' }),
        selectedPath: null,
        timestamp: Date.now(),
      };

      history.push(snapshot);

      expect(history.current?.description).toBeUndefined();
    });

    it('should handle snapshot without selectedPath', () => {
      const snapshot = createSnapshot('No selection', null);
      history.push(snapshot);

      expect(history.current?.selectedPath).toBeNull();
    });

    it('should handle very large history', () => {
      const largeHistory = new HistoryManager(1000);

      for (let i = 0; i < 1000; i++) {
        largeHistory.push(createSnapshot(`Snapshot ${i}`));
      }

      expect(largeHistory.size()).toBe(1000);
      expect(largeHistory.current?.description).toBe('Snapshot 999');
    });

    it('should handle rapid undo/redo cycles', () => {
      history.push(createSnapshot('Snapshot 1'));
      history.push(createSnapshot('Snapshot 2'));
      history.push(createSnapshot('Snapshot 3'));

      for (let i = 0; i < 10; i++) {
        history.undo();
        history.redo();
      }

      expect(history.current?.description).toBe('Snapshot 3');
    });
  });
});

describe('snapshotsEqual', () => {
  it('should return true for two null snapshots', () => {
    expect(snapshotsEqual(null, null)).toBe(true);
  });

  it('should return false if only one is null', () => {
    const snapshot = createSnapshot('Test');
    expect(snapshotsEqual(snapshot, null)).toBe(false);
    expect(snapshotsEqual(null, snapshot)).toBe(false);
  });

  it('should return true for identical snapshots', () => {
    const snapshot1 = createSnapshot('Test', [1, 2, 3]);
    const snapshot2 = createSnapshot('Test', [1, 2, 3]);

    expect(snapshotsEqual(snapshot1, snapshot2)).toBe(true);
  });

  it('should return false for different sceneJSON', () => {
    const snapshot1 = createSnapshot('Test 1', [1, 2, 3]);
    const snapshot2 = createSnapshot('Test 2', [1, 2, 3]);

    expect(snapshotsEqual(snapshot1, snapshot2)).toBe(false);
  });

  it('should return false for different selectedPath', () => {
    const snapshot1 = createSnapshot('Test', [1, 2, 3]);
    const snapshot2 = createSnapshot('Test', [1, 2, 4]);

    expect(snapshotsEqual(snapshot1, snapshot2)).toBe(false);
  });

  it('should return false for different selectedPath lengths', () => {
    const snapshot1 = createSnapshot('Test', [1, 2, 3]);
    const snapshot2 = createSnapshot('Test', [1, 2]);

    expect(snapshotsEqual(snapshot1, snapshot2)).toBe(false);
  });

  it('should handle null selectedPath', () => {
    const snapshot1 = createSnapshot('Test', null);
    const snapshot2 = createSnapshot('Test', null);

    expect(snapshotsEqual(snapshot1, snapshot2)).toBe(true);
  });

  it('should return false when one has null selectedPath and other does not', () => {
    const snapshot1 = createSnapshot('Test', [1, 2, 3]);
    const snapshot2 = createSnapshot('Test', null);

    expect(snapshotsEqual(snapshot1, snapshot2)).toBe(false);
  });

  it('should ignore timestamp and description', () => {
    const snapshot1: SceneSnapshot = {
      sceneJSON: JSON.stringify({ data: 'test' }),
      selectedPath: [1, 2, 3],
      description: 'Description 1',
      timestamp: 1000,
    };

    const snapshot2: SceneSnapshot = {
      sceneJSON: JSON.stringify({ data: 'test' }),
      selectedPath: [1, 2, 3],
      description: 'Description 2',
      timestamp: 2000,
    };

    expect(snapshotsEqual(snapshot1, snapshot2)).toBe(true);
  });

  it('should handle empty selectedPath', () => {
    const snapshot1 = createSnapshot('Test', []);
    const snapshot2 = createSnapshot('Test', []);

    expect(snapshotsEqual(snapshot1, snapshot2)).toBe(true);
  });
});

