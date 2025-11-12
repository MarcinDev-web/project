import { WebRTCTransportServer } from '@engine/net-server';
import type { ClientConnection } from '@engine/net-server';
import {
  handleMessage,
  cleanupConnection,
  webrtcClientMap,
  type ConnectionMeta,
  type WsMessage,
} from '../shared/messageRouter.js';

let webrtcServer: WebRTCTransportServer | null = null;

/**
 * Get ICE servers configuration from environment variables.
 * Supports TURN server for production.
 */
function getIceServers(): RTCIceServer[] {
  const iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
  ];

  // Add TURN server if configured
  const turnUrl = process.env.TURN_URL;
  const turnUsername = process.env.TURN_USERNAME;
  const turnCredential = process.env.TURN_CREDENTIAL;

  if (turnUrl && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnUrl,
      username: turnUsername,
      credential: turnCredential,
    });
    console.log('[WebRTC] TURN server configured:', turnUrl);
  } else if (process.env.NODE_ENV === 'production') {
    console.warn('[WebRTC] WARNING: TURN server not configured in production. NAT traversal may fail.');
  }

  return iceServers;
}

/**
 * Create and start WebRTC signaling server.
 */
export async function createWebRTCServer(
  signalingPort: number
): Promise<void> {
  if (webrtcServer) {
    // Already started
    return;
  }

  try {
    webrtcServer = new WebRTCTransportServer({
    signalingPort,
    iceServers: getIceServers(),
    logger: {
      debug: (...args: unknown[]) => console.debug('[WebRTC]', ...args),
      info: (...args: unknown[]) => console.info('[WebRTC]', ...args),
      warn: (...args: unknown[]) => console.warn('[WebRTC]', ...args),
      error: (...args: unknown[]) => console.error('[WebRTC]', ...args),
    },
    onConnectionClosed: (clientId: string) => {
      // Cleanup WebRTC connection when it closes
      unregisterWebRTCConnection(clientId);
    },
    onDataChannelMessage: (clientId: string, channelLabel: string, data: ArrayBuffer) => {
      // Get or create connection for this client
      let meta = webrtcClientMap.get(clientId);
      
      if (!meta) {
        // First message from this client - get connection and register it
        // Try specific channel first, then any channel
        let connection = webrtcServer?.getConnection(clientId, channelLabel);
        if (!connection) {
          connection = webrtcServer?.getConnectionAnyChannel(clientId);
        }
        
        if (!connection) {
          console.warn(`[WebRTC] Connection not available for client ${clientId}`);
          return;
        }

        // Register connection with empty metadata (will be filled by join-session message)
        registerWebRTCConnection(clientId, connection);
        meta = webrtcClientMap.get(clientId);
        
        if (!meta) {
          console.error(`[WebRTC] Failed to register connection for ${clientId}`);
          return;
        }
      }

      try {
        // Parse incoming message
        const text = new TextDecoder().decode(data);
        const msg = JSON.parse(text) as WsMessage;

        // Create send function for this connection
        const send = (data: Record<string, unknown>): void => {
          const conn = meta!.connection as ClientConnection;
          if (conn && 'send' in conn) {
            const payload = JSON.stringify(data);
            const bytes = new TextEncoder().encode(payload);
            conn.send(new Uint8Array(bytes));
          }
        };

        // Handle message using shared router
        handleMessage(msg, meta, send);
      } catch (err) {
        console.error(`[WebRTC] Error processing message from ${clientId}:`, err);
      }
    },
  });

    await webrtcServer.start();
    console.log(`WebRTC signaling server started on port ${signalingPort}`);
  } catch (error) {
    console.warn(`[WebRTC] WebRTC not available, continuing without WebRTC support:`, error instanceof Error ? error.message : error);
    webrtcServer = null;
  }
}

/**
 * Register a WebRTC connection.
 */
export function registerWebRTCConnection(
  clientId: string,
  connection: ClientConnection,
  userId: string | null = null,
  sessionId: string | null = null
): void {
  const meta: ConnectionMeta = {
    userId,
    sessionId,
    connectionType: 'webrtc',
    connection,
  };
  webrtcClientMap.set(clientId, meta);
}

/**
 * Unregister a WebRTC connection.
 */
export function unregisterWebRTCConnection(clientId: string): void {
  const meta = webrtcClientMap.get(clientId);
  if (meta) {
    cleanupConnection(meta);
    webrtcClientMap.delete(clientId);
  }
}

/**
 * Get WebRTC transport server instance.
 */
export function getWebRTCServer(): WebRTCTransportServer | null {
  return webrtcServer;
}

/**
 * Stop WebRTC signaling server.
 */
export async function stopWebRTCServer(): Promise<void> {
  if (webrtcServer) {
    await webrtcServer.stop();
    webrtcServer = null;
  }
}

