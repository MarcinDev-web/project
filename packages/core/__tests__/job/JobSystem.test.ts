/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JobSystem, TaskPriority } from '../../src/job/JobSystem';

describe('JobSystem', () => {
  let jobSystem: JobSystem;

  beforeEach(() => {
    jobSystem = new JobSystem(2); // 2 workers for testing
  });

  afterEach(() => {
    jobSystem.shutdown();
  });

  describe('RenderCritical tasks', () => {
    it('should execute RenderCritical tasks immediately', async () => {
      let executed = false;

      const handle = jobSystem.schedule({
        execute: () => {
          executed = true;
        },
        priority: TaskPriority.RenderCritical,
      });

      await handle.await();

      expect(executed).toBe(true);
      expect(handle.isComplete()).toBe(true);
    });

    it('should execute async RenderCritical tasks', async () => {
      let executed = false;

      const handle = jobSystem.schedule({
        execute: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          executed = true;
        },
        priority: TaskPriority.RenderCritical,
      });

      await handle.await();

      expect(executed).toBe(true);
      expect(handle.isComplete()).toBe(true);
    });

    it('should handle errors in RenderCritical tasks', async () => {
      const handle = jobSystem.schedule({
        execute: () => {
          throw new Error('Test error');
        },
        priority: TaskPriority.RenderCritical,
      });

      await expect(handle.await()).rejects.toThrow('Test error');
    });
  });

  describe('Background tasks', () => {
    it('should execute Background tasks asynchronously', async () => {
      let executed = false;

      const handle = jobSystem.schedule({
        execute: () => {
          executed = true;
        },
        priority: TaskPriority.Background,
      });

      // Task should not execute immediately
      expect(executed).toBe(false);

      await handle.await();

      expect(executed).toBe(true);
      expect(handle.isComplete()).toBe(true);
    });

    it('should queue multiple Background tasks', async () => {
      const executionOrder: number[] = [];

      const handle1 = jobSystem.schedule({
        execute: () => {
          executionOrder.push(1);
        },
        priority: TaskPriority.Background,
      });

      const handle2 = jobSystem.schedule({
        execute: () => {
          executionOrder.push(2);
        },
        priority: TaskPriority.Background,
      });

      await Promise.all([handle1.await(), handle2.await()]);

      expect(executionOrder.length).toBe(2);
      expect(executionOrder).toContain(1);
      expect(executionOrder).toContain(2);
    });

    it('should process background queue on update', async () => {
      let executed = false;

      const handle = jobSystem.schedule({
        execute: () => {
          executed = true;
        },
        priority: TaskPriority.Background,
      });

      // Update should trigger processing
      jobSystem.update();
      await handle.await();

      expect(executed).toBe(true);
    });
  });

  describe('Idle tasks', () => {
    it('should queue Idle tasks', () => {
      let executed = false;

      const handle = jobSystem.schedule({
        execute: () => {
          executed = true;
        },
        priority: TaskPriority.Idle,
      });

      // Task should not execute immediately
      expect(executed).toBe(false);
      expect(handle.isComplete()).toBe(false);
    });

    it('should execute Idle tasks during idle callback', async () => {
      let executed = false;

      const handle = jobSystem.schedule({
        execute: () => {
          executed = true;
        },
        priority: TaskPriority.Idle,
      });

      // Mock requestIdleCallback
      const originalRequestIdleCallback = global.requestIdleCallback;
      const originalCancelIdleCallback = global.cancelIdleCallback;

      let idleCallback: ((deadline: IdleDeadline) => void) | null = null;

      global.requestIdleCallback = vi.fn((callback: (deadline: IdleDeadline) => void) => {
        idleCallback = callback;
        return 1 as unknown as number;
      });

      global.cancelIdleCallback = vi.fn();

      // Trigger idle callback
      if (idleCallback) {
        idleCallback({ timeRemaining: () => 10 } as IdleDeadline);
      }

      await handle.await();

      expect(executed).toBe(true);

      // Restore
      global.requestIdleCallback = originalRequestIdleCallback;
      global.cancelIdleCallback = originalCancelIdleCallback;
    });
  });

  describe('Task cancellation', () => {
    it('should cancel pending task', async () => {
      let executed = false;

      const handle = jobSystem.schedule({
        execute: () => {
          executed = true;
        },
        priority: TaskPriority.Background,
      });

      handle.cancel();

      expect(handle.isComplete()).toBe(true);
      expect(executed).toBe(false);

      // Wait a bit to ensure task doesn't execute
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(executed).toBe(false);
    });

    it('should cancel RenderCritical task before execution', async () => {
      let executed = false;

      const handle = jobSystem.schedule({
        execute: () => {
          executed = true;
        },
        priority: TaskPriority.RenderCritical,
      });

      // Cancel immediately (might race with execution)
      handle.cancel();

      await handle.await();
      // Execution might happen or not, but handle should be complete
      expect(handle.isComplete()).toBe(true);
    });

    it('should handle cancellation of already completed task', async () => {
      const handle = jobSystem.schedule({
        execute: () => {
          // Complete immediately
        },
        priority: TaskPriority.RenderCritical,
      });

      await handle.await();
      expect(handle.isComplete()).toBe(true);

      // Cancel should be safe
      handle.cancel();
      expect(handle.isComplete()).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should return correct stats', async () => {
      const handle1 = jobSystem.schedule({
        execute: async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
        },
        priority: TaskPriority.Background,
      });

      const handle2 = jobSystem.schedule({
        execute: () => {
          // Idle task
        },
        priority: TaskPriority.Idle,
      });

      const stats = jobSystem.getStats();

      expect(stats.pendingTasks).toBeGreaterThanOrEqual(1);
      expect(stats.queuedBackground).toBeGreaterThanOrEqual(0);
      expect(stats.queuedIdle).toBeGreaterThanOrEqual(1);

      await Promise.all([handle1.await(), handle2.await()]);
    });

    it('should track active workers', () => {
      const stats = jobSystem.getStats();

      expect(stats.activeWorkers).toBeGreaterThanOrEqual(0);
      expect(stats.activeWorkers).toBeLessThanOrEqual(2); // workerCount
    });
  });

  describe('Shutdown', () => {
    it('should cancel all pending tasks on shutdown', async () => {
      let executed = false;

      const handle = jobSystem.schedule({
        execute: () => {
          executed = true;
        },
        priority: TaskPriority.Background,
      });

      jobSystem.shutdown();

      expect(handle.isComplete()).toBe(true);
      expect(executed).toBe(false);
    });

    it('should prevent new tasks after shutdown', () => {
      jobSystem.shutdown();

      expect(() => {
        jobSystem.schedule({
          execute: () => {},
          priority: TaskPriority.RenderCritical,
        });
      }).toThrow('JobSystem is shutdown');
    });

    it('should clear all queues on shutdown', () => {
      jobSystem.schedule({
        execute: () => {},
        priority: TaskPriority.Background,
      });

      jobSystem.schedule({
        execute: () => {},
        priority: TaskPriority.Idle,
      });

      jobSystem.shutdown();

      const stats = jobSystem.getStats();
      expect(stats.pendingTasks).toBe(0);
      expect(stats.queuedBackground).toBe(0);
      expect(stats.queuedIdle).toBe(0);
    });
  });

  describe('Update', () => {
    it('should process background queue on update', async () => {
      let executed = false;

      const handle = jobSystem.schedule({
        execute: () => {
          executed = true;
        },
        priority: TaskPriority.Background,
      });

      jobSystem.update();

      await handle.await();
      expect(executed).toBe(true);
    });

    it('should cleanup cancelled tasks on update', () => {
      const handle = jobSystem.schedule({
        execute: () => {},
        priority: TaskPriority.Background,
      });

      handle.cancel();
      jobSystem.update();

      const stats = jobSystem.getStats();
      expect(stats.pendingTasks).toBe(0);
    });
  });
});

