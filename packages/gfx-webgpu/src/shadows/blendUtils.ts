export function selectCascade(linearDepth: number, splits: [number, number, number, number]): number {
  if (linearDepth <= splits[0]) return 0;
  if (linearDepth <= splits[1]) return 1;
  if (linearDepth <= splits[2]) return 2;
  return 3;
}

/**
 * Computes cascade blending between neighboring cascades.
 * Returns [baseIndex, neighborIndex (-1 if none), weight (0..1)].
 */
export function computeCascadeBlend(
  linearDepth: number,
  splits: [number, number, number, number],
  overlapFrac: number
): [number, number, number] {
  const base = selectCascade(linearDepth, splits);
  let neighbor = -1;
  let weight = 0;

  // Lower boundary (with previous cascade)
  if (base > 0) {
    const lowerSplit = base === 1 ? splits[0] : base === 2 ? splits[1] : splits[2];
    const prevSplit = base === 1 ? 0 : base === 2 ? splits[0] : splits[1];
    const range = Math.max(1e-6, lowerSplit - prevSplit);
    const overlap = overlapFrac * range;
    if (linearDepth < lowerSplit + overlap) {
      const t = Math.min(Math.max((linearDepth - lowerSplit) / Math.max(overlap, 1e-6), 0), 1);
      neighbor = base - 1;
      weight = 1 - t;
    }
  }
  // Upper boundary (with next cascade)
  if (neighbor === -1 && base < 3) {
    const upperSplit = base === 0 ? splits[0] : base === 1 ? splits[1] : splits[2];
    const nextSplit = base === 0 ? splits[1] : base === 1 ? splits[2] : splits[3];
    const range = Math.max(1e-6, nextSplit - upperSplit);
    const overlap = overlapFrac * range;
    if (linearDepth > upperSplit - overlap) {
      const t = Math.min(
        Math.max((linearDepth - (upperSplit - overlap)) / Math.max(overlap, 1e-6), 0),
        1
      );
      neighbor = base + 1;
      weight = t;
    }
  }
  return [base, neighbor, weight];
}


