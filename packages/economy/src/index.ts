// @engine/economy - Currency and economy system

// Types
export type {
  Currency,
  CurrencyAmount,
  CurrencyBalance,
  WalletId,
} from './types.js';

// Examples (for documentation and reference)
export * from './examples/CurrencySystemExample.js';

export {
  TransactionType,
  TransactionStatus,
} from './types.js';

// Transaction
export { Transaction } from './Transaction.js';
export type { TransactionMetadata } from './Transaction.js';

// Wallet
export { CurrencyWallet } from './CurrencyWallet.js';

// History
export { CurrencyTransactionHistory } from './CurrencyTransactionHistory.js';
export type { TransactionFilter, TransactionMetrics } from './CurrencyTransactionHistory.js';

// Manager
export { CurrencyManager } from './CurrencyManager.js';
export type { CurrencyStatistics } from './CurrencyManager.js';

// Events
export {
  CurrencyEventNames,
} from './events.js';

export type {
  CurrencyDepositedEvent,
  CurrencyWithdrawnEvent,
  CurrencyTransferredEvent,
  CurrencyExchangedEvent,
  TransactionCompletedEvent,
  TransactionFailedEvent,
  BalanceChangedEvent,
  WalletCreatedEvent,
  WalletDisposedEvent,
  CurrencyEvent,
} from './events.js';

// API Client
export { EconomyApiClient } from './api/EconomyApiClient.js';
export type {
  GetWalletResponse,
  CartItem,
  CheckoutRequest,
  CheckoutResponse,
  DepositWithdrawRequest,
  TransferRequest,
  ListLedgerResponse,
} from './api/types.js';

// Bridge (prototype)
export { OnChainBridge } from './bridge/OnChainBridge.js';

// Creator Economy
export * from './creator/index.js';

