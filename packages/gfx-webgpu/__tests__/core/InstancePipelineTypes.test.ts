import { describe, it, expect } from 'vitest';
import { buildIndirectDrawArgs, IndirectCommandOffset } from '../../src/core/InstancePipelineTypes';

const WORDS_PER_COMMAND = 5;

describe('buildIndirectDrawArgs', () => {
  it('encodes opaque/transparent/overlay commands', () => {
    const args = buildIndirectDrawArgs(24, 10, 4);
    const opaque = Array.from(args.slice(0, WORDS_PER_COMMAND));
    const transparent = Array.from(
      args.slice(IndirectCommandOffset.TRANSPARENT / 4, IndirectCommandOffset.TRANSPARENT / 4 + WORDS_PER_COMMAND)
    );
    const overlay = Array.from(
      args.slice(IndirectCommandOffset.OVERLAY / 4, IndirectCommandOffset.OVERLAY / 4 + WORDS_PER_COMMAND)
    );

    expect(opaque).toEqual([24, 10, 0, 0, 0]);
    expect(transparent).toEqual([24, 4, 0, 0, 10]);
    expect(overlay).toEqual([24, 14, 0, 0, 0]);
  });

  it('clamps negative values to zero', () => {
    const args = buildIndirectDrawArgs(-1, -5, -2);
    const opaque = Array.from(args.slice(0, WORDS_PER_COMMAND));
    const transparent = Array.from(
      args.slice(IndirectCommandOffset.TRANSPARENT / 4, IndirectCommandOffset.TRANSPARENT / 4 + WORDS_PER_COMMAND)
    );
    const overlay = Array.from(
      args.slice(IndirectCommandOffset.OVERLAY / 4, IndirectCommandOffset.OVERLAY / 4 + WORDS_PER_COMMAND)
    );
    expect(opaque).toEqual([0, 0, 0, 0, 0]);
    expect(transparent).toEqual([0, 0, 0, 0, 0]);
    expect(overlay).toEqual([0, 0, 0, 0, 0]);
  });
});

