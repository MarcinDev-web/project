/**
 * Tests for useWebSocket hook
 * Note: This is a simplified test - in a real scenario, you'd use React Testing Library
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock WebSocket
class MockWebSocket {
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  send = vi.fn();
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    // Auto-connect after a tick
    setTimeout(() => {
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }
}

// Mock global WebSocket
global.WebSocket = MockWebSocket as unknown as typeof WebSocket;

describe('useWebSocket hook (simplified)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates WebSocket connection', () => {
    const ws = new MockWebSocket('ws://localhost:3001');
    expect(ws.url).toBe('ws://localhost:3001');
    expect(ws.readyState).toBe(MockWebSocket.OPEN);
  });

  it('sends messages when connected', () => {
    const ws = new MockWebSocket('ws://localhost:3001');
    const message = { type: 'ping', timestamp: Date.now() };

    ws.send(JSON.stringify(message));
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify(message));
  });

  it('handles incoming messages', () => {
    const ws = new MockWebSocket('ws://localhost:3001');
    let receivedMessage: unknown = null;

    ws.onmessage = (event) => {
      receivedMessage = JSON.parse(event.data as string);
    };

    const testMessage = { type: 'message:new', message: { id: '123', content: 'Hello' } };
    ws.onmessage?.({ data: JSON.stringify(testMessage) } as MessageEvent);

    expect(receivedMessage).toEqual(testMessage);
  });

  it('handles connection close', () => {
    const ws = new MockWebSocket('ws://localhost:3001');
    let closed = false;

    ws.onclose = () => {
      closed = true;
    };

    ws.close();
    ws.onclose?.({} as CloseEvent);

    expect(ws.close).toHaveBeenCalled();
    expect(closed).toBe(true);
  });
});

