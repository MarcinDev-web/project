export interface HandoverTicket {
    clientId: string;
    fromZoneId: string;
    toZoneId: string;
    expiresAt: number;
    data?: Uint8Array;
}
export declare class HandoverManager {
    createSeamlessTicket(clientId: string, fromZoneId: string, toZoneId: string): HandoverTicket;
    serializeClientState(_clientId: string): Uint8Array;
}
//# sourceMappingURL=HandoverManager.d.ts.map