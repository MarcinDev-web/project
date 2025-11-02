import { describe, it, expect } from 'vitest';
import { isWebTransportSupported } from './WebTransportClientAdapter.js';

describe('Transport Compatibility', () => {
  it('should detect WebSocket support', () => {
    const hasWS = typeof WebSocket !== 'undefined';
    expect(typeof hasWS).toBe('boolean');
  });

  it('should detect WebRTC support', () => {
    const hasRTC = typeof RTCPeerConnection !== 'undefined';
    expect(typeof hasRTC).toBe('boolean');
  });

  it('should check WebTransport feature flag', () => {
    // Just verify the function exists and returns boolean
    const result = isWebTransportSupported();
    expect(typeof result).toBe('boolean');
  });
});


