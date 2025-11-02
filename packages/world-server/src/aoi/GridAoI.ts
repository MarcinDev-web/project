export interface Vec3 { x: number; y: number; z: number }

export interface AoIEntity {
  id: bigint;
  position: Vec3;
}

export interface AoISelectionResult {
  id: bigint;
  priority: number;
  targetHz: number;
}

export class SpatialHashGrid {
  private readonly cells = new Map<string, Set<bigint>>();
  constructor(private readonly cellSize: number) {}

  private key(x: number, z: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    return `${cx}:${cz}`;
  }

  insert(entity: AoIEntity): void {
    const k = this.key(entity.position.x, entity.position.z);
    let set = this.cells.get(k);
    if (!set) { set = new Set(); this.cells.set(k, set); }
    set.add(entity.id);
  }

  move(entity: AoIEntity, prev: Vec3): void {
    const k0 = this.key(prev.x, prev.z);
    const k1 = this.key(entity.position.x, entity.position.z);
    if (k0 === k1) return;
    const s0 = this.cells.get(k0); if (s0) s0.delete(entity.id);
    this.insert(entity);
  }

  remove(entity: AoIEntity): void {
    const k = this.key(entity.position.x, entity.position.z);
    const s = this.cells.get(k); if (s) s.delete(entity.id);
  }

  queryNear(pos: Vec3, radius: number): bigint[] {
    const out: bigint[] = [];
    const minCx = Math.floor((pos.x - radius) / this.cellSize);
    const maxCx = Math.floor((pos.x + radius) / this.cellSize);
    const minCz = Math.floor((pos.z - radius) / this.cellSize);
    const maxCz = Math.floor((pos.z + radius) / this.cellSize);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const k = `${cx}:${cz}`;
        const s = this.cells.get(k);
        if (!s) continue;
        for (const id of s) out.push(id);
      }
    }
    return out;
  }
}

export function computePriority(distance: number): number {
  // Higher priority when closer
  return 1 / (1 + distance);
}

export function adaptiveHz(distance: number): number {
  if (distance < 20) return 20;
  if (distance < 60) return 10;
  if (distance < 120) return 5;
  return 1;
}

export function selectAoI(grid: SpatialHashGrid, viewerPos: Vec3, viewRadius: number): AoISelectionResult[] {
  const ids = grid.queryNear(viewerPos, viewRadius);
  // Without entity positions map, approximate distance by cell distance
  const results: AoISelectionResult[] = ids.map((id) => {
    // Placeholder distance; refine with exact lookup later
    const dx = 0, dz = 0; // unknown
    const dist = Math.hypot(dx, dz);
    return { id, priority: computePriority(dist), targetHz: adaptiveHz(dist) };
  });
  results.sort((a, b) => b.priority - a.priority);
  return results;
}


