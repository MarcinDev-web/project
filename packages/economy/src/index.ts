// @engine/economy - Currency and economy system

// Types
export type {
  Currency,
  CurrencyAmount,
  CurrencyBalance,
  WalletId,
} from './types';

// Examples (for documentation and reference)
export * from './examples/CurrencySystemExample';

export {
  TransactionType,
  TransactionStatus,
} from './types';

// Transaction
export { Transaction } from './Transaction';
export type { TransactionMetadata } from './Transaction';

// Wallet
export { CurrencyWallet } from './CurrencyWallet';

// History
export { CurrencyTransactionHistory } from './CurrencyTransactionHistory';
export type { TransactionFilter, TransactionMetrics } from './CurrencyTransactionHistory';

// Manager
export { CurrencyManager } from './CurrencyManager';
export type { CurrencyStatistics } from './CurrencyManager';

// Events
export {
  CurrencyEventNames,
} from './events';

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
} from './events';

// API Client
export { EconomyApiClient } from './api/EconomyApiClient';
export type {
  GetWalletResponse,
  CartItem,
  CheckoutRequest,
  CheckoutResponse,
  DepositWithdrawRequest,
  TransferRequest,
  ListLedgerResponse,
} from './api/types';

// Bridge (prototype)
export { OnChainBridge } from './bridge/OnChainBridge';

// Creator Economy
export * from './creator';

