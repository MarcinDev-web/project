// @engine/economy - Currency and economy system

// Errors and Result utilities
export { EconomyError, type EconomyErrorCode } from './errors.js';
export {
  depositResult,
  withdrawResult,
  transferResult,
  exchangeResult,
  batchWithdrawResult,
  batchTransferResult,
  checkBalance,
  type EconomyResult,
  type TransactionResult,
} from './result.js';

// Types
export type {
  Currency,
  CurrencyAmount,
  CurrencyBalance,
  WalletId,
  FiatCurrency,
  ExchangeRate,
  GameId,
  CreatorId,
} from './types.js';
export { PLATFORM_CURRENCY, TransactionType, TransactionStatus, ItemCategory, GameMode } from './types.js';

// Examples (for documentation and reference)
export * from './examples/CurrencySystemExample.js';

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
export { CurrencyEventNames } from './events.js';

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

// Exchange Rate
export { CurrencyExchangeRate } from './CurrencyExchangeRate.js';
export type { ExchangeRateConfig } from './CurrencyExchangeRate.js';

// Anti-P2W Compliance
export { AntiP2WCompliance } from './AntiP2WCompliance.js';
export type {
  AntiP2WConfig,
  GameRegistration,
  ItemDefinition,
  ComplianceResult,
} from './AntiP2WCompliance.js';

// Revenue Split
export { RevenueSplit } from './RevenueSplit.js';
export type {
  RevenueSplitConfig,
  MarketplaceSplitConfig,
  RevenueSplitResult,
  MarketplaceSplitResult,
} from './RevenueSplit.js';

// Currency Sinks
export { CurrencySinks, FeeType } from './CurrencySinks.js';
export type { CurrencySinksConfig, SinkResult } from './CurrencySinks.js';

// Marketplace
export { Marketplace } from './Marketplace.js';
export type {
  MarketplaceListing,
  MarketplacePurchaseResult,
  MarketplaceConfig,
} from './Marketplace.js';

// Creator Monetization
export { CreatorMonetization } from './CreatorMonetization.js';
export type {
  ShopItem,
  SeasonPass,
  SeasonPassTier,
  GamePass,
  PurchaseResult,
  CreatorMonetizationConfig,
} from './CreatorMonetization.js';

// Withdrawal System
export { WithdrawalSystem, KYCStatus } from './WithdrawalSystem.js';
export type {
  CreatorKYC,
  WithdrawalRequest,
  WithdrawalSystemConfig,
} from './WithdrawalSystem.js';

// Engagement Fund
export { EngagementFund } from './EngagementFund.js';
export type {
  EngagementMetrics,
  EngagementFundConfig,
  DistributionResult,
} from './EngagementFund.js';
