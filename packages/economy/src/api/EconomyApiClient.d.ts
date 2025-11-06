import type { CartItem, CheckoutResponse, DepositWithdrawRequest, GetWalletResponse, ListLedgerResponse, TransferRequest } from './types';
export interface EconomyApiClientOptions {
    baseUrl?: string;
    getAuthToken?: () => string | null;
}
export declare class EconomyApiClient {
    private readonly baseUrl;
    private readonly getAuthToken;
    constructor(options?: EconomyApiClientOptions);
    private headers;
    getWallet(): Promise<GetWalletResponse>;
    checkout(items: CartItem[]): Promise<CheckoutResponse>;
    deposit(req: DepositWithdrawRequest): Promise<{
        success: true;
    }>;
    withdraw(req: DepositWithdrawRequest): Promise<{
        success: true;
    }>;
    transfer(req: TransferRequest): Promise<{
        success: true;
    }>;
    listLedger(limit?: number): Promise<ListLedgerResponse>;
}
//# sourceMappingURL=EconomyApiClient.d.ts.map