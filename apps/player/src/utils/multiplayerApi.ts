import { Logger } from './logger';
import type { BuildData } from './loadBuildData.js';

/**
 * Multiplayer API utilities
 */
export class MultiplayerAPI {
  /**
   * Get WebSocket URL for game
   */
  static async getWebSocketUrl(buildId: string): Promise<string> {
    try {
      const response = await fetch(`/api/marketplace/${buildId}/ws-url`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = (await response.json()) as { url?: string };
        if (data.url) {
          return data.url;
        }
      }
    } catch (error) {
      Logger.warn('[MultiplayerAPI] Failed to get WebSocket URL:', error as unknown as Error);
    }

    // Fallback to default WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws/game/${buildId}`;
  }

  /**
   * Get multiplayer server info
   */
  static async getServerInfo(buildId: string): Promise<{ url: string; maxPlayers: number; currentPlayers: number } | null> {
    try {
      const response = await fetch(`/api/marketplace/${buildId}/server-info`, {
        credentials: 'include',
      });

      if (response.ok) {
        return (await response.json()) as { url: string; maxPlayers: number; currentPlayers: number };
      }
    } catch (error) {
      Logger.warn('[MultiplayerAPI] Failed to get server info:', error as unknown as Error);
    }

    return null;
  }

  /**
   * Check if build supports multiplayer
   */
  static async checkMultiplayerSupport(buildId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/marketplace/${buildId}/build`, {
        credentials: 'include',
      });

      if (response.ok) {
        const buildData = (await response.json()) as BuildData;
        return buildData.manifest?.simulation?.enableMultiplayer ?? false;
      }
    } catch (error) {
      Logger.warn('[MultiplayerAPI] Failed to check multiplayer support:', error as unknown as Error);
    }

    return false;
  }
}

