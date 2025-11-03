import type { Scene } from '../core/Scene.js';
import type { CurrencyAmount, CurrencyManager } from '@engine/economy';
import { CurrencyComponent } from '../components/CurrencyComponent.js';

export interface RewardEvent {
  walletId?: string;
  entityId?: string;
  amount: CurrencyAmount;
  reason?: string;
}

/**
 * EconomySystem wires scene events to the currency manager for gameplay rewards.
 */
export class EconomySystem {
  private readonly scene: Scene;
  private readonly currency: CurrencyManager;

  constructor(scene: Scene, currencyManager: CurrencyManager) {
    this.scene = scene;
    this.currency = currencyManager;

    // Hook reward events
    this.scene.events.on('economy:reward', (data: unknown) => {
      const e = data as RewardEvent;
      if (!e?.amount) return;
      if (e.walletId) {
        const wallet = this.currency.getWallet(e.walletId) ?? this.currency.createWallet(e.walletId);
        wallet.deposit(e.amount, e.reason ?? 'Reward');
        return;
      }
      if (e.entityId) {
        const entity = this.scene.findEntityById(e.entityId);
        const comp = entity?.getComponent(CurrencyComponent);
        if (comp) comp.deposit(e.amount, e.reason ?? 'Reward');
      }
    });
  }
}


