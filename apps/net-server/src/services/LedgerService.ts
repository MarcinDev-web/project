import crypto from 'crypto';
import type { Transaction } from '@engine/economy';

export type LedgerReason =
  | 'PURCHASE'
  | 'FEE'
  | 'PAYOUT'
  | 'REFUND'
  | 'DEPOSIT'
  | 'WITHDRAW'
  | 'TRANSFER';

export interface LedgerEntryDto {
  id: string;
  ts: number;
  walletId: string;
  currency: string;
  delta: number;
  reason: LedgerReason;
  receiptHash: string;
}

export class LedgerService {
  private readonly entries: LedgerEntryDto[] = [];

  addFromTransaction(tx: Transaction, reason: LedgerReason, deltaSign: 1 | -1): LedgerEntryDto {
    const delta = deltaSign * tx.amount.amount;
    const walletId = tx.toWalletId ?? tx.fromWalletId ?? 'unknown';
    const id = `le_${tx.id}`;
    const ts = tx.timestamp;
    const currency = tx.amount.currency;
    const hash = crypto
      .createHash('sha256')
      .update(`${tx.id}|${ts}|${walletId}|${currency}|${delta}|${reason}`)
      .digest('hex');

    const entry: LedgerEntryDto = {
      id,
      ts,
      walletId,
      currency,
      delta,
      reason,
      receiptHash: hash,
    };
    this.entries.push(entry);
    // keep last 10k entries in memory
    if (this.entries.length > 10000) this.entries.splice(0, this.entries.length - 10000);
    return entry;
  }

  list(limit = 100): LedgerEntryDto[] {
    const start = Math.max(0, this.entries.length - limit);
    return this.entries.slice(start).reverse();
  }
}

