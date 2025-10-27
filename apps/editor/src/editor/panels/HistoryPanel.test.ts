/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HistoryPanel, type HistoryAction } from './HistoryPanel';

function createHost(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('HistoryPanel', () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = createHost();
  });

  afterEach(() => {
    host.remove();
    document.body.innerHTML = '';
  });

  describe('initialization', () => {
    it('should create panel and mount to host', () => {
      const panel = new HistoryPanel({});
      panel.mount(host);

      expect(host.querySelector('.history-panel')).toBeTruthy();
    });

    it('should display panel title', () => {
      const panel = new HistoryPanel({});
      panel.mount(host);

      const title = host.querySelector('.panel-title');
      expect(title?.textContent).toBe('History');
    });

    it('should show empty state when no actions exist', () => {
      const panel = new HistoryPanel({});
      panel.mount(host);

      const empty = host.querySelector('.inspector-empty');
      expect(empty).toBeTruthy();
      expect(empty?.textContent).toContain('No history');
    });

    it('should have undo button in header', () => {
      const panel = new HistoryPanel({});
      panel.mount(host);

      const undoBtn = host.querySelector('.history-controls button[title="Undo"]');
      expect(undoBtn).toBeTruthy();
    });

    it('should have redo button in header', () => {
      const panel = new HistoryPanel({});
      panel.mount(host);

      const redoBtn = host.querySelector('.history-controls button[title="Redo"]');
      expect(redoBtn).toBeTruthy();
    });
  });

  describe('adding actions', () => {
    it('should add action to history', () => {
      const panel = new HistoryPanel({});
      panel.mount(host);

      const action: HistoryAction = {
        id: 'action_1',
        type: 'create',
        description: 'Created entity',
        timestamp: Date.now(),
      };

      panel.addAction(action);

      const historyItems = host.querySelectorAll('.history-item');
      expect(historyItems.length).toBe(1);
    });

    it('should add multiple actions in order', () => {
      const panel = new HistoryPanel({});
      panel.mount(host);

      panel.addAction({
        id: 'action_1',
        type: 'create',
        description: 'First action',
        timestamp: Date.now(),
      });

      panel.addAction({
        id: 'action_2',
        type: 'modify',
        description: 'Second action',
        timestamp: Date.now(),
      });

      const historyItems = host.querySelectorAll('.history-item');
      expect(historyItems.length).toBe(2);
    });

    it('should display action description', () => {
      const panel = new HistoryPanel({});
      panel.mount(host);

      panel.addAction({
        id: 'action_1',
        type: 'create',
        description: 'Created cube',
        timestamp: Date.now(),
      });

      const description = host.querySelector('.history-description');
      expect(description?.textContent).toBe('Created cube');
    });

    it('should display action timestamp', () => {
      const panel = new HistoryPanel({});
      panel.mount(host);

      panel.addAction({
        id: 'action_1',
        type: 'create',
        description: 'Action',
        timestamp: Date.now(),
      });

      const time = host.querySelector('.history-time');
      expect(time).toBeTruthy();
      expect(time?.textContent).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    });

    it('should limit history to maximum size', () => {
      const panel = new HistoryPanel({});
      panel.mount(host);

      // Add 60 actions (more than MAX_HISTORY of 50)
      for (let i = 0; i < 60; i++) {
        panel.addAction({
          id: `action_${i}`,
          type: 'modify',
          description: `Action ${i}`,
          timestamp: Date.now() + i,
        });
      }

      const historyItems = host.querySelectorAll('.history-item');
      expect(historyItems.length).toBe(50);
    });

    it('should mark most recent action as current', () => {
      const panel = new HistoryPanel({});
      panel.mount(host);

      panel.addAction({
        id: 'action_1',
        type: 'create',
        description: 'First',
        timestamp: Date.now(),
      });

      panel.addAction({
        id: 'action_2',
        type: 'create',
        description: 'Second',
        timestamp: Date.now(),
      });

      const currentItem = host.querySelector('.history-item.current');
      expect(currentItem).toBeTruthy();
      
      const description = currentItem?.querySelector('.history-description');
      expect(description?.textContent).toBe('Second');
    });
  });

  describe('displaying actions', () => {
    it('should display actions in reverse order (newest first)', () => {
      const panel = new HistoryPanel({});
      panel.mount(host);

      panel.addAction({
        id: 'action_1',
        type: 'create',
        description: 'First',
        timestamp: Date.now(),
      });

      panel.addAction({
        id: 'action_2',
        type: 'create',
        description: 'Second',
        timestamp: Date.now(),
      });

      const descriptions = Array.from(host.querySelectorAll('.history-description')).map(
        el => el.textContent
      );

      expect(descriptions[0]).toBe('Second');
      expect(descriptions[1]).toBe('First');
    });

    it('should show timeline markers for all actions', () => {
      const panel = new HistoryPanel({});
      panel.mount(host);

      panel.addAction({
        id: 'action_1',
        type: 'create',
        description: 'Action 1',
        timestamp: Date.now(),
      });

      panel.addAction({
        id: 'action_2',
        type: 'create',
        description: 'Action 2',
        timestamp: Date.now(),
      });

      const markers = host.querySelectorAll('.history-marker');
      expect(markers.length).toBe(2);
    });

    it('should show special marker for current action', () => {
      const panel = new HistoryPanel({});
      panel.mount(host);

      panel.addAction({
        id: 'action_1',
        type: 'create',
        description: 'Action',
        timestamp: Date.now(),
      });

      const currentItem = host.querySelector('.history-item.current');
      const marker = currentItem?.querySelector('.history-marker svg');
      expect(marker).toBeTruthy();
    });

    it('should mark past actions correctly', () => {
      const panel = new HistoryPanel({});
      panel.mount(host);

      panel.addAction({
        id: 'action_1',
        type: 'create',
        description: 'Past',
        timestamp: Date.now(),
      });

      panel.addAction({
        id: 'action_2',
        type: 'create',
        description: 'Current',
        timestamp: Date.now(),
      });

      const items = host.querySelectorAll('.history-item');
      const pastItems = Array.from(items).filter(item => !item.classList.contains('future'));
      
      // All items should be past or current (not future)
      expect(pastItems.length).toBe(2);
    });

    it('should mark future actions after undo', () => {
      const panel = new HistoryPanel({});
      panel.mount(host);

      panel.addAction({
        id: 'action_1',
        type: 'create',
        description: 'Action 1',
        timestamp: Date.now(),
      });

      panel.addAction({
        id: 'action_2',
        type: 'create',
        description: 'Action 2',
        timestamp: Date.now(),
      });

      // Jump to first action (simulating undo)
      panel.jumpTo(0);

      const futureItems = host.querySelectorAll('.history-item.future');
      expect(futureItems.length).toBe(1);
    });
  });

  describe('undo/redo buttons', () => {
    it('should call onUndo when undo button clicked', () => {
      const onUndo = vi.fn();
      const panel = new HistoryPanel({ onUndo });
      panel.mount(host);

      const undoBtn = host.querySelector('.history-controls button[title="Undo"]') as HTMLButtonElement;
      undoBtn.click();

      expect(onUndo).toHaveBeenCalled();
    });

    it('should call onRedo when redo button clicked', () => {
      const onRedo = vi.fn();
      const panel = new HistoryPanel({ onRedo });
      panel.mount(host);

      const redoBtn = host.querySelector('.history-controls button[title="Redo"]') as HTMLButtonElement;
      redoBtn.click();

      expect(onRedo).toHaveBeenCalled();
    });

    it('should not throw when callbacks not provided', () => {
      const panel = new HistoryPanel({});
      panel.mount(host);

      const undoBtn = host.querySelector('.history-controls button[title="Undo"]') as HTMLButtonElement;
      const redoBtn = host.querySelector('.history-controls button[title="Redo"]') as HTMLButtonElement;

      expect(() => undoBtn.click()).not.toThrow();
      expect(() => redoBtn.click()).not.toThrow();
    });
  });

  describe('jumping to history state', () => {
    it('should jump to specific action when clicked', () => {
      const onJumpTo = vi.fn();
      const panel = new HistoryPanel({ onJumpTo });
      panel.mount(host);

      panel.addAction({
        id: 'action_1',
        type: 'create',
        description: 'Action 1',
        timestamp: Date.now(),
      });

      panel.addAction({
        id: 'action_2',
        type: 'create',
        description: 'Action 2',
        timestamp: Date.now(),
      });

      const items = host.querySelectorAll('.history-item');
      (items[1] as HTMLButtonElement).click(); // Click on first action

      expect(onJumpTo).toHaveBeenCalledWith(0);
    });

    it('should update current marker when jumping', () => {
      const panel = new HistoryPanel({});
      panel.mount(host);

      panel.addAction({
        id: 'action_1',
        type: 'create',
        description: 'Action 1',
        timestamp: Date.now(),
      });

      panel.addAction({
        id: 'action_2',
        type: 'create',
        description: 'Action 2',
        timestamp: Date.now(),
      });

      const items = host.querySelectorAll('.history-item');
      (items[1] as HTMLButtonElement).click(); // Jump to first action

      const currentItem = host.querySelector('.history-item.current');
      const description = currentItem?.querySelector('.history-description');
      expect(description?.textContent).toBe('Action 1');
    });

    it('should not jump to invalid index', () => {
      const onJumpTo = vi.fn();
      const panel = new HistoryPanel({ onJumpTo });
      panel.mount(host);

      panel.addAction({
        id: 'action_1',
        type: 'create',
        description: 'Action',
        timestamp: Date.now(),
      });

      // Try to jump to invalid indices
      panel.jumpTo(-1);
      panel.jumpTo(100);

      expect(onJumpTo).not.toHaveBeenCalled();
    });

    it('should handle boundary indices correctly', () => {
      const onJumpTo = vi.fn();
      const panel = new HistoryPanel({ onJumpTo });
      panel.mount(host);

      panel.addAction({
        id: 'action_1',
        type: 'create',
        description: 'Action 1',
        timestamp: Date.now(),
      });

      panel.addAction({
        id: 'action_2',
        type: 'create',
        description: 'Action 2',
        timestamp: Date.now(),
      });

      // Jump to first action (index 0)
      panel.jumpTo(0);
      expect(onJumpTo).toHaveBeenCalledWith(0);

      // Jump to last action (index 1)
      panel.jumpTo(1);
      expect(onJumpTo).toHaveBeenCalledWith(1);
    });
  });

  describe('branching history', () => {
    it('should remove future actions when new action added after undo', () => {
      const panel = new HistoryPanel({});
      panel.mount(host);

      panel.addAction({
        id: 'action_1',
        type: 'create',
        description: 'Action 1',
        timestamp: Date.now(),
      });

      panel.addAction({
        id: 'action_2',
        type: 'create',
        description: 'Action 2',
        timestamp: Date.now(),
      });

      // Jump back to first action
      panel.jumpTo(0);

      // Add new action (should remove action_2)
      panel.addAction({
        id: 'action_3',
        type: 'create',
        description: 'Action 3',
        timestamp: Date.now(),
      });

      const items = host.querySelectorAll('.history-item');
      expect(items.length).toBe(2); // action_1 and action_3

      const descriptions = Array.from(host.querySelectorAll('.history-description')).map(
        el => el.textContent
      );
      expect(descriptions).toContain('Action 1');
      expect(descriptions).toContain('Action 3');
      expect(descriptions).not.toContain('Action 2');
    });
  });

  describe('clearing history', () => {
    it('should clear all actions', () => {
      const panel = new HistoryPanel({});
      panel.mount(host);

      panel.addAction({
        id: 'action_1',
        type: 'create',
        description: 'Action 1',
        timestamp: Date.now(),
      });

      panel.addAction({
        id: 'action_2',
        type: 'create',
        description: 'Action 2',
        timestamp: Date.now(),
      });

      panel.clear();

      const empty = host.querySelector('.inspector-empty');
      expect(empty).toBeTruthy();

      const items = host.querySelectorAll('.history-item');
      expect(items.length).toBe(0);
    });

    it('should reset current index when cleared', () => {
      const onJumpTo = vi.fn();
      const panel = new HistoryPanel({ onJumpTo });
      panel.mount(host);

      panel.addAction({
        id: 'action_1',
        type: 'create',
        description: 'Action',
        timestamp: Date.now(),
      });

      panel.clear();

      // Trying to jump should not work since there are no actions
      panel.jumpTo(0);
      expect(onJumpTo).not.toHaveBeenCalled();
    });
  });

  describe('timestamp formatting', () => {
    it('should format timestamp as time', () => {
      const panel = new HistoryPanel({});
      panel.mount(host);

      const now = new Date();
      panel.addAction({
        id: 'action_1',
        type: 'create',
        description: 'Action',
        timestamp: now.getTime(),
      });

      const time = host.querySelector('.history-time');
      expect(time?.textContent).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    });

    it('should format different timestamps distinctly', () => {
      const panel = new HistoryPanel({});
      panel.mount(host);

      const time1 = new Date('2025-01-01 10:30:00').getTime();
      const time2 = new Date('2025-01-01 14:45:30').getTime();

      panel.addAction({
        id: 'action_1',
        type: 'create',
        description: 'Morning',
        timestamp: time1,
      });

      panel.addAction({
        id: 'action_2',
        type: 'create',
        description: 'Afternoon',
        timestamp: time2,
      });

      const times = Array.from(host.querySelectorAll('.history-time')).map(
        el => el.textContent
      );

      expect(times[0]).not.toBe(times[1]);
    });
  });

  describe('edge cases', () => {
    it('should handle adding action with same ID', () => {
      const panel = new HistoryPanel({});
      panel.mount(host);

      panel.addAction({
        id: 'action_1',
        type: 'create',
        description: 'First',
        timestamp: Date.now(),
      });

      panel.addAction({
        id: 'action_1',
        type: 'create',
        description: 'Second',
        timestamp: Date.now(),
      });

      const items = host.querySelectorAll('.history-item');
      expect(items.length).toBe(2); // Both should be added
    });

    it('should handle very long action descriptions', () => {
      const panel = new HistoryPanel({});
      panel.mount(host);

      const longDescription = 'A'.repeat(1000);
      
      panel.addAction({
        id: 'action_1',
        type: 'create',
        description: longDescription,
        timestamp: Date.now(),
      });

      const description = host.querySelector('.history-description');
      expect(description?.textContent).toBe(longDescription);
    });

    it('should handle rapid action additions', () => {
      const panel = new HistoryPanel({});
      panel.mount(host);

      // Add 10 actions rapidly
      for (let i = 0; i < 10; i++) {
        panel.addAction({
          id: `action_${i}`,
          type: 'modify',
          description: `Action ${i}`,
          timestamp: Date.now() + i,
        });
      }

      const items = host.querySelectorAll('.history-item');
      expect(items.length).toBe(10);
    });

    it('should handle jumping to same index multiple times', () => {
      const onJumpTo = vi.fn();
      const panel = new HistoryPanel({ onJumpTo });
      panel.mount(host);

      panel.addAction({
        id: 'action_1',
        type: 'create',
        description: 'Action',
        timestamp: Date.now(),
      });

      panel.jumpTo(0);
      panel.jumpTo(0);
      panel.jumpTo(0);

      expect(onJumpTo).toHaveBeenCalledTimes(3);
    });

    it('should handle empty action descriptions', () => {
      const panel = new HistoryPanel({});
      panel.mount(host);

      panel.addAction({
        id: 'action_1',
        type: 'create',
        description: '',
        timestamp: Date.now(),
      });

      const description = host.querySelector('.history-description');
      expect(description).toBeTruthy();
    });
  });
});

