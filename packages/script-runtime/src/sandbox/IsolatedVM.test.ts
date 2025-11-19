import { describe, expect, it } from 'vitest';
import { IsolatedVM } from './IsolatedVM.js';

describe('IsolatedVM', () => {
  it('executes code with provided API', () => {
    const vm = new IsolatedVM({
      allowedApi: {
        Platform: {
          MovePlayer: (id: string, delta: number) => `${id}:${delta}`,
        },
      },
    });
    const result = vm.evaluate('Platform.MovePlayer("user", 4)');
    expect(result).toBe('user:4');
    vm.dispose();
  });

  it('rejects access to node globals', () => {
    const vm = new IsolatedVM();
    expect(() => vm.evaluate('process.exit(1)')).toThrow();
    vm.dispose();
  });

  it('enforces code size limit', () => {
    const vm = new IsolatedVM({ codeSizeLimitKb: 1 });
    const large = '0'.repeat(2048);
    expect(() => vm.evaluate(large)).toThrow();
    vm.dispose();
  });
});

