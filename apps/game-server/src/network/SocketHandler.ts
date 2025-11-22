import { WebSocket } from 'ws';
import { 
  HandshakeHello, 
  HandshakeAccept, 
  HandshakeReject, 
  InputFrame, 
  protocolVersion,
  ClientCapabilities,
  TransportKind
} from '@engine/net-protocol';
import { RoomManager } from '../server/RoomManager';

export class SocketHandler {
  constructor(private roomManager: RoomManager) {}

  handleConnection(socket: WebSocket, req: any) {
    let clientId: string | null = null;
    let roomId: string | null = null;
    let isAuthenticated = false;

    socket.binaryType = 'arraybuffer';

    socket.on('message', async (data: any, isBinary: boolean) => {
      if (!isAuthenticated) {
        // Expect HandshakeHello JSON
        try {
          const msg = JSON.parse(data.toString()) as HandshakeHello;
          if (msg.kind === 'hello') {
            if (msg.protocolVersion !== protocolVersion) {
              const reject: HandshakeReject = { kind: 'reject', reason: 'Protocol mismatch' };
              socket.send(JSON.stringify(reject));
              socket.close();
              return;
            }

            // Validate token (mock for now)
            // In real impl, we decode msg.zoneToken to get userId and roomId
            // const { userId, targetRoomId } = decodeToken(msg.zoneToken);
            
            // MOCK: Extract from token or use defaults
            clientId = `user-${Math.random().toString(36).substr(2, 9)}`;
            roomId = 'default-room'; 

            isAuthenticated = true;

            // Join Room
            const room = await this.roomManager.joinRoom(roomId, clientId);
            
            // Wire up snapshot sending
            room.onSendSnapshot = (targetClientId, snapshot) => {
              if (targetClientId === clientId && socket.readyState === WebSocket.OPEN) {
                // Send binary snapshot
                // In real impl: use SnapshotCodec.encode(snapshot)
                // socket.send(encodedSnapshot);
              }
            };

            // Send Accept
            const accept: HandshakeAccept = {
              kind: 'accept',
              selectedTransport: 'websocket',
              zoneToken: msg.zoneToken // echo back or refresh
            };
            socket.send(JSON.stringify(accept));
            
            console.log(`[SocketHandler] Client ${clientId} joined room ${roomId}`);
          }
        } catch (e) {
          console.error('Handshake error', e);
          socket.close();
        }
        return;
      }

      // Authenticated - Handle Input Frames
      if (isBinary && clientId && roomId) {
        const room = this.roomManager.getRoom(roomId);
        if (room) {
          // Decode InputFrame
          // const frame = InputCodec.decode(new Uint8Array(data as ArrayBuffer));
          // Mock decoding:
          const frame: InputFrame = { seq: 0, ts: Date.now(), payload: new Uint8Array(data as ArrayBuffer) };
          
          room.handleInput(clientId, frame);
        }
      }
    });

    socket.on('close', () => {
      if (clientId && roomId) {
        this.roomManager.leaveRoom(roomId, clientId);
        console.log(`[SocketHandler] Client ${clientId} disconnected`);
      }
    });
  }
}

