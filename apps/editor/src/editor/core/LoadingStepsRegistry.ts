import type { LoadingStep } from './LoadingStep';
import { Logger } from '../../utils/logger';

export interface LoadingStepRegistration {
  id: string;
  create: () => LoadingStep;
  before?: string | string[];
  after?: string | string[];
}

export type DefaultLoadingStepId =
  | 'snapshot'
  | 'buildWorld'
  | 'lightSetup'
  | 'physicsSetup'
  | 'bufferUpdate'
  | 'pipelineWarmup';

export const DefaultLoadingStepIds: Record<DefaultLoadingStepId, DefaultLoadingStepId> = {
  snapshot: 'snapshot',
  buildWorld: 'buildWorld',
  lightSetup: 'lightSetup',
  physicsSetup: 'physicsSetup',
  bufferUpdate: 'bufferUpdate',
  pipelineWarmup: 'pipelineWarmup',
} as const;

export class LoadingStepsRegistry {
  private registrations = new Map<string, LoadingStepRegistration>();

  register(reg: LoadingStepRegistration): void {
    if (!reg || !reg.id || typeof reg.create !== 'function') {
      throw new Error('Invalid LoadingStepRegistration');
    }
    if (this.registrations.has(reg.id)) {
      Logger.warn(`[LoadingStepsRegistry] Step with id "${reg.id}" already registered, replacing`);
    }
    this.registrations.set(reg.id, {
      id: reg.id,
      create: reg.create,
      before: normalizeArray(reg.before),
      after: normalizeArray(reg.after),
    });
  }

  registerMany(regs: LoadingStepRegistration[]): void {
    for (const reg of regs) this.register(reg);
  }

  unregister(id: string): void {
    this.registrations.delete(id);
  }

  clear(): void {
    this.registrations.clear();
  }

  /**
   * Compose ordered steps from defaults plus registered extensions using a stable topological sort.
   * Default order is preserved (Snapshot → Build → Light → Physics → Buffers → Warmup).
   */
  getSteps(defaults: Array<{ id: string; create: () => LoadingStep }>): LoadingStep[] {
    const order = this.resolveOrder(defaults.map((d) => d.id));

    // Build a map of factories (defaults first so extensions cannot override by id)
    const factories = new Map<string, () => LoadingStep>();
    for (const d of defaults) factories.set(d.id, d.create);
    for (const [id, reg] of this.registrations) factories.set(id, reg.create);

    const steps: LoadingStep[] = [];
    for (const id of order) {
      const create = factories.get(id);
      if (!create) continue; // unknown id referenced in constraints
      steps.push(create());
    }
    return steps;
  }

  /**
   * Resolve an execution order honoring before/after constraints and preserving default order.
   */
  private resolveOrder(defaultIds: string[]): string[] {
    const regs = Array.from(this.registrations.values());
    const allIds = new Set<string>([...defaultIds, ...regs.map((r) => r.id)]);

    // Build graph edges
    const edges = new Map<string, Set<string>>(); // from -> set(to)
    const indegree = new Map<string, number>();
    const ensureNode = (id: string) => {
      if (!edges.has(id)) edges.set(id, new Set());
      if (!indegree.has(id)) indegree.set(id, 0);
    };

    for (const id of allIds) ensureNode(id);

    // Preserve default order: default[i] -> default[i+1]
    for (let i = 0; i < defaultIds.length - 1; i++) {
      addEdge(defaultIds[i], defaultIds[i + 1], edges, indegree);
    }

    // Apply extension constraints
    for (const reg of regs) {
      for (const b of normalizeArray(reg.before)) addEdge(reg.id, b, edges, indegree);
      for (const a of normalizeArray(reg.after)) addEdge(a, reg.id, edges, indegree);
    }

    // Stable Kahn's algorithm: initial priority = default order then extensions in registration order
    const priority: string[] = [...defaultIds, ...regs.map((r) => r.id)];
    const zero: string[] = [];
    for (const [id, deg] of indegree) if (deg === 0) zero.push(id);
    zero.sort((a, b) => priority.indexOf(a) - priority.indexOf(b));

    const result: string[] = [];
    while (zero.length > 0) {
      const id = zero.shift() as string;
      result.push(id);
      for (const to of edges.get(id) ?? []) {
        const d = (indegree.get(to) ?? 0) - 1;
        indegree.set(to, d);
        if (d === 0) {
          // insert keeping stability
          let inserted = false;
          for (let i = 0; i < zero.length; i++) {
            if (priority.indexOf(to) < priority.indexOf(zero[i])) {
              zero.splice(i, 0, to);
              inserted = true;
              break;
            }
          }
          if (!inserted) zero.push(to);
        }
      }
    }

    if (result.length !== allIds.size) {
      Logger.warn('[LoadingStepsRegistry] Detected cycle in loading steps; falling back to default order');
      return priority.filter((id, idx) => priority.indexOf(id) === idx); // dedupe
    }

    return result;
  }
}

function normalizeArray<T>(v?: T | T[]): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function addEdge(from: string, to: string, edges: Map<string, Set<string>>, indegree: Map<string, number>): void {
  if (from === to) return;
  if (!edges.has(from)) edges.set(from, new Set());
  if (!edges.has(to)) edges.set(to, new Set());
  const set = edges.get(from)!;
  if (!set.has(to)) {
    set.add(to);
    indegree.set(to, (indegree.get(to) ?? 0) + 1);
    if (!indegree.has(from)) indegree.set(from, 0);
  }
}


