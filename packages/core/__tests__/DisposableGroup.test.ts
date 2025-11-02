/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { DisposableGroup, isDisposable, toDisposable } from '../src/utils/DisposableGroup';

describe('DisposableGroup', () => {
  describe('basic operations', () => {
    it('should add and dispose resources', () => {
      const group = new DisposableGroup();
      const cleanup = vi.fn();

      group.add(cleanup);
      expect(cleanup).not.toHaveBeenCalled();

      group.dispose();
      expect(cleanup).toHaveBeenCalledOnce();
    });

    it('should dispose resources in LIFO order', () => {
      const group = new DisposableGroup();
      const order: number[] = [];

      group.add(() => order.push(1));
      group.add(() => order.push(2));
      group.add(() => order.push(3));

      group.dispose();

      expect(order).toEqual([3, 2, 1]); // LIFO - last in, first out
    });

    it('should be idempotent (safe to call dispose multiple times)', () => {
      const group = new DisposableGroup();
      const cleanup = vi.fn();

      group.add(cleanup);

      group.dispose();
      group.dispose();
      group.dispose();

      expect(cleanup).toHaveBeenCalledOnce();
    });

    it('should not add disposables after disposal', () => {
      const group = new DisposableGroup();
      const cleanup = vi.fn();

      group.dispose();
      group.add(cleanup);

      expect(cleanup).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should continue disposing even if one throws', () => {
      const group = new DisposableGroup();
      const cleanup1 = vi.fn();
      const cleanup2 = vi.fn(() => {
        throw new Error('Cleanup error');
      });
      const cleanup3 = vi.fn();

      group.add(cleanup1);
      group.add(cleanup2);
      group.add(cleanup3);

      // Suppress console.error for this test
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      group.dispose();

      expect(cleanup1).toHaveBeenCalled();
      expect(cleanup2).toHaveBeenCalled();
      expect(cleanup3).toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });
  });

  describe('addMany', () => {
    it('should add multiple disposables at once', () => {
      const group = new DisposableGroup();
      const cleanup1 = vi.fn();
      const cleanup2 = vi.fn();
      const cleanup3 = vi.fn();

      group.addMany(cleanup1, cleanup2, cleanup3);

      group.dispose();

      expect(cleanup1).toHaveBeenCalled();
      expect(cleanup2).toHaveBeenCalled();
      expect(cleanup3).toHaveBeenCalled();
    });
  });

  describe('addGroup', () => {
    it('should dispose child groups', () => {
      const parent = new DisposableGroup();
      const child = new DisposableGroup();
      const cleanup = vi.fn();

      child.add(cleanup);
      parent.addGroup(child);

      parent.dispose();

      expect(cleanup).toHaveBeenCalled();
      expect(child.isDisposed()).toBe(true);
    });
  });

  describe('state management', () => {
    it('should track disposed state', () => {
      const group = new DisposableGroup();

      expect(group.isDisposed()).toBe(false);

      group.dispose();

      expect(group.isDisposed()).toBe(true);
    });

    it('should track size', () => {
      const group = new DisposableGroup();

      expect(group.size()).toBe(0);

      group.add(() => {});
      expect(group.size()).toBe(1);

      group.add(() => {});
      expect(group.size()).toBe(2);

      group.dispose();
      expect(group.size()).toBe(0);
    });

    it('should clear without disposing', () => {
      const group = new DisposableGroup();
      const cleanup = vi.fn();

      group.add(cleanup);
      group.clear();

      expect(group.size()).toBe(0);
      expect(cleanup).not.toHaveBeenCalled();
    });
  });

  describe('isDisposable type guard', () => {
    it('should identify disposable objects', () => {
      const disposable = {
        dispose: () => {},
      };

      expect(isDisposable(disposable)).toBe(true);
    });

    it('should reject non-disposable objects', () => {
      expect(isDisposable(null)).toBe(false);
      expect(isDisposable(undefined)).toBe(false);
      expect(isDisposable({})).toBe(false);
      expect(isDisposable({ dispose: 'not a function' })).toBe(false);
      expect(isDisposable(42)).toBe(false);
      expect(isDisposable('string')).toBe(false);
    });
  });

  describe('toDisposable helper', () => {
    it('should wrap disposable object', () => {
      const disposeSpy = vi.fn();
      const obj = {
        dispose: disposeSpy,
      };

      const wrapper = toDisposable(obj);
      wrapper();

      expect(disposeSpy).toHaveBeenCalledOnce();
    });

    it('should work with DisposableGroup', () => {
      const group = new DisposableGroup();
      const obj = {
        dispose: vi.fn(),
      };

      group.add(toDisposable(obj));
      group.dispose();

      expect(obj.dispose).toHaveBeenCalled();
    });
  });

  describe('real-world scenarios', () => {
    it('should handle event listeners cleanup', () => {
      const group = new DisposableGroup();
      const element = document.createElement('div');
      const handler = vi.fn();

      element.addEventListener('click', handler);
      group.add(() => element.removeEventListener('click', handler));

      element.click();
      expect(handler).toHaveBeenCalledOnce();

      group.dispose();
      element.click();
      expect(handler).toHaveBeenCalledOnce(); // Still once, not twice
    });

    it('should handle AbortController pattern', () => {
      const group = new DisposableGroup();
      const controller = new AbortController();

      group.add(() => controller.abort());

      expect(controller.signal.aborted).toBe(false);

      group.dispose();

      expect(controller.signal.aborted).toBe(true);
    });

    it('should handle interval cleanup', () => {
      const group = new DisposableGroup();
      const callback = vi.fn();

      const intervalId = setInterval(callback, 10);
      group.add(() => clearInterval(intervalId));

      // Wait a bit to ensure interval runs
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(callback).toHaveBeenCalled();
          const callCount = callback.mock.calls.length;

          group.dispose();

          // Wait more and check that callback wasn't called again
          setTimeout(() => {
            expect(callback).toHaveBeenCalledTimes(callCount);
            resolve();
          }, 50);
        }, 50);
      });
    });
  });
});

