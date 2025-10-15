export interface ResourceState {
  inventory: Map<string, number>;
  spent: number;
}

export interface ResourceConfig {
  totalBudget: number;
  costs: Record<string, number>;
  limits: Record<string, number>;
}

export class ResourceManager {
  private state: ResourceState;

  constructor(private readonly config: ResourceConfig) {
    this.state = {
      inventory: new Map<string, number>(),
      spent: 0,
    };
  }

  reset(): void {
    this.state.inventory.clear();
    this.state.spent = 0;
  }

  canPlace(assetName: string): boolean {
    const limit = this.config.limits[assetName] ?? Infinity;
    const placed = this.state.inventory.get(assetName) ?? 0;
    if (placed >= limit) {
      return false;
    }
    const cost = this.config.costs[assetName] ?? 0;
    if (this.state.spent + cost > this.config.totalBudget) {
      return false;
    }
    return true;
  }

  registerPlacement(assetName: string, options?: { force?: boolean }): boolean {
    const force = options?.force ?? false;
    const limit = this.config.limits[assetName] ?? Infinity;
    const cost = this.config.costs[assetName] ?? 0;
    const placed = this.state.inventory.get(assetName) ?? 0;

    const fitsLimit = placed + 1 <= limit;
    const fitsBudget = this.state.spent + cost <= this.config.totalBudget;

    if (!force) {
      if (!fitsLimit || !fitsBudget) {
        return false;
      }
    }

    this.state.inventory.set(assetName, placed + 1);
    this.state.spent += cost;
    return true;
  }

  registerRemoval(assetName: string): boolean {
    const current = this.state.inventory.get(assetName) ?? 0;
    if (current <= 0) {
      return false;
    }
    const next = current - 1;
    if (next === 0) {
      this.state.inventory.delete(assetName);
    } else {
      this.state.inventory.set(assetName, next);
    }
    const cost = this.config.costs[assetName] ?? 0;
    this.state.spent = Math.max(0, this.state.spent - cost);
    return true;
  }

  getRemainingBudget(): number {
    return Math.max(0, this.config.totalBudget - this.state.spent);
  }

  getRemainingFor(assetName: string): number {
    const limit = this.config.limits[assetName] ?? Infinity;
    const placed = this.state.inventory.get(assetName) ?? 0;
    return Math.max(0, limit - placed);
  }

  getTotalBudget(): number {
    return this.config.totalBudget;
  }

  getSpent(): number {
    return this.state.spent;
  }

  getEffectiveSpent(): number {
    return Math.min(this.state.spent, this.config.totalBudget);
  }

  getOverspend(): number {
    return Math.max(0, this.state.spent - this.config.totalBudget);
  }

  getCost(assetName: string): number {
    return this.config.costs[assetName] ?? 0;
  }

  getLimit(assetName: string): number | undefined {
    const v = this.config.limits[assetName];
    return Number.isFinite(v) ? v : undefined;
  }

  getPlacedCount(assetName: string): number {
    return this.state.inventory.get(assetName) ?? 0;
  }

  getInventorySnapshot(): Record<string, number> {
    const snapshot: Record<string, number> = {};
    for (const [name, count] of this.state.inventory.entries()) {
      snapshot[name] = count;
    }
    return snapshot;
  }

  seedInventory(counts: Record<string, number>, options?: { force?: boolean }): void {
    const force = options?.force ?? false;
    this.reset();
    for (const [name, count] of Object.entries(counts)) {
      if (count <= 0) continue;
      const cost = this.config.costs[name] ?? 0;
      const limit = this.config.limits[name] ?? Infinity;
      const allowedCount = force ? count : Math.min(count, Math.max(0, limit));

      // Check budget when not forcing
      if (!force) {
        const maxAffordable = cost > 0 ? Math.floor((this.config.totalBudget - this.state.spent) / cost) : allowedCount;
        const toAdd = Math.max(0, Math.min(allowedCount, maxAffordable));
        if (toAdd <= 0) continue;
        this.state.inventory.set(name, toAdd);
        this.state.spent += cost * toAdd;
      } else {
        this.state.inventory.set(name, allowedCount);
        this.state.spent += cost * allowedCount;
      }
    }
  }
}
