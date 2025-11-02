import { Component } from './Component';
import { registerComponent } from './registry';

export class DurabilityComponent extends Component {
  static readonly type = 'Durability';

  max: number;
  current: number;

  constructor(max = 100) {
    super();
    this.max = Math.max(1, Math.floor(max));
    this.current = this.max;
  }

  degrade(amount: number): void {
    const v = Math.max(0, Math.floor(amount));
    this.current = Math.max(0, this.current - v);
  }

  repair(amount: number): void {
    const v = Math.max(0, Math.floor(amount));
    this.current = Math.min(this.max, this.current + v);
  }

  isBroken(): boolean {
    return this.current <= 0;
  }

  getType(): string {
    return DurabilityComponent.type;
  }

  override clone(): DurabilityComponent {
    const clone = new DurabilityComponent(this.max);
    clone.current = this.current;
    return clone;
  }
}

registerComponent(DurabilityComponent.type, DurabilityComponent);


