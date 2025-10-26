import { describe, it, expect, beforeEach } from 'vitest';
import { BehaviorRegistry } from '@engine/script';
import { BehaviorInstance, type BehaviorConstructor } from '@engine/script';

class A extends BehaviorInstance {}
class B extends BehaviorInstance {}

describe('BehaviorRegistry versioning', () => {
  beforeEach(() => {
    // Reset private state via public API where possible
    // There is no explicit clear, so simulate by re-registering unique names per test
  });

  it('does not bump version when registering the same constructor twice', () => {
    const baseVersion = BehaviorRegistry.getVersion();
    BehaviorRegistry.register('Dup', A as unknown as BehaviorConstructor);
    const afterFirst = BehaviorRegistry.getVersion();
    expect(afterFirst).toBe(baseVersion + 1);

    BehaviorRegistry.register('Dup', A as unknown as BehaviorConstructor);
    const afterSecond = BehaviorRegistry.getVersion();
    expect(afterSecond).toBe(afterFirst); // no bump
  });

  it('bumps version when registering a different constructor under the same name', () => {
    const v0 = BehaviorRegistry.getVersion();
    BehaviorRegistry.register('Swap', A as unknown as BehaviorConstructor);
    const v1 = BehaviorRegistry.getVersion();
    expect(v1).toBe(v0 + 1);

    BehaviorRegistry.register('Swap', B as unknown as BehaviorConstructor);
    const v2 = BehaviorRegistry.getVersion();
    expect(v2).toBe(v1 + 1);
  });
});


