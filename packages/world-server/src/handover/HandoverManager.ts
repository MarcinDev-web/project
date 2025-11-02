export interface HandoverTicket {
  clientId: string;
  fromZoneId: string;
  toZoneId: string;
  expiresAt: number;
  data?: Uint8Array;
}

export class HandoverManager {
  createSeamlessTicket(clientId: string, fromZoneId: string, toZoneId: string): HandoverTicket {
    return {
      clientId,
      fromZoneId,
      toZoneId,
      expiresAt: Date.now() + 15_000,
    };
  }

  serializeClientState(_clientId: string): Uint8Array {
    // Future: pack needed ECS state for transfer
    return new Uint8Array(0);
  }
}


