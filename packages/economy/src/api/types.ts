/**
 * Public API types for server economy endpoints.
 */

export interface ApiErrorResponse {
  error: string;
  message?: string;
}

export interface WalletBalance {
  currency: string;
  balance: number;
}

export interface GetWalletResponse {
  balances: WalletBalance[];
}

export type PurchaseItemType = 'shop-item' | 'asset' | 'marketplace-item';

export interface CartItem {
  itemId: string;
  type: PurchaseItemType;
  quantity: number;
}

export interface CheckoutRequest {
  items: CartItem[];
}

export interface CheckoutResponse {
  success: boolean;
  purchaseId?: string;
  error?: string;
}

export interface LedgerEntryDto {
  id: string;
  ts: number;
  walletId: string;
  currency: string;
  delta: number;
  reason: 'PURCHASE' | 'FEE' | 'PAYOUT' | 'REFUND' | 'DEPOSIT' | 'WITHDRAW' | 'TRANSFER';
  receiptHash: string;
}

export interface ListLedgerResponse {
  entries: LedgerEntryDto[];
}

export interface DepositWithdrawRequest {
  currency: string;
  amount: number;
  description?: string;
}

export interface TransferRequest {
  toUserId: string;
  currency: string;
  amount: number;
  description?: string;
}
