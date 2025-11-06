import type {
  CartItem,
  CheckoutRequest,
  CheckoutResponse,
  DepositWithdrawRequest,
  GetWalletResponse,
  ListLedgerResponse,
  TransferRequest,
} from './types';

export interface EconomyApiClientOptions {
  baseUrl?: string; // e.g. '/api'
  getAuthToken?: () => string | null;
}

export class EconomyApiClient {
  private readonly baseUrl: string;
  private readonly getAuthToken: (() => string | null) | undefined;

  constructor(options: EconomyApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? '/api';
    this.getAuthToken = options.getAuthToken;
  }

  private headers(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    const token = this.getAuthToken?.();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  async getWallet(): Promise<GetWalletResponse> {
    const res = await fetch(`${this.baseUrl}/shop/wallet`, {
      method: 'GET',
      headers: this.headers(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Wallet request failed: ${res.status}`);
    return (await res.json()) as GetWalletResponse;
  }

  async checkout(items: CartItem[]): Promise<CheckoutResponse> {
    const body: CheckoutRequest = { items };
    const res = await fetch(`${this.baseUrl}/shop/checkout`, {
      method: 'POST',
      headers: this.headers(),
      credentials: 'include',
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Checkout failed: ${res.status}`);
    return (await res.json()) as CheckoutResponse;
  }

  // The following endpoints are part of the economy ledger API implemented server-side.
  // If the server doesn't expose them yet, these methods will fail with 404 until implemented.

  async deposit(req: DepositWithdrawRequest): Promise<{ success: true }> {
    const res = await fetch(`${this.baseUrl}/economy/deposit`, {
      method: 'POST',
      headers: this.headers(),
      credentials: 'include',
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`Deposit failed: ${res.status}`);
    return (await res.json()) as { success: true };
  }

  async withdraw(req: DepositWithdrawRequest): Promise<{ success: true }> {
    const res = await fetch(`${this.baseUrl}/economy/withdraw`, {
      method: 'POST',
      headers: this.headers(),
      credentials: 'include',
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`Withdraw failed: ${res.status}`);
    return (await res.json()) as { success: true };
  }

  async transfer(req: TransferRequest): Promise<{ success: true }> {
    const res = await fetch(`${this.baseUrl}/economy/transfer`, {
      method: 'POST',
      headers: this.headers(),
      credentials: 'include',
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`Transfer failed: ${res.status}`);
    return (await res.json()) as { success: true };
  }

  async listLedger(limit = 100): Promise<ListLedgerResponse> {
    const url = new URL(`${this.baseUrl}/economy/ledger`, window.location.origin);
    url.searchParams.set('limit', String(limit));
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: this.headers(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Ledger list failed: ${res.status}`);
    return (await res.json()) as ListLedgerResponse;
  }
}
