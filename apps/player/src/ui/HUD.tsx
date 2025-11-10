import React, { useState, useEffect } from 'react';
import { HealthBar } from './components/HealthBar.js';
import { Minimap } from './components/Minimap.js';
import { Inventory } from './components/Inventory.js';
import { ChatOverlay } from './components/ChatOverlay.js';
import { SettingsMenu } from './components/SettingsMenu.js';
import type { Vec3 } from '@engine/core/math';

export interface HUDProps {
  /** Current player health (0-100) */
  health?: number;
  /** Maximum health */
  maxHealth?: number;
  /** Current player position */
  playerPosition?: Vec3;
  /** Show pause menu */
  showPauseMenu?: boolean;
  /** Show disconnect UI */
  showDisconnectUI?: boolean;
  /** On resume from pause */
  onResume?: () => void;
  /** On exit game */
  onExit?: () => void;
  /** On reconnect */
  onReconnect?: () => void;
}

/**
 * Main HUD component
 */
export function HUD(props: HUDProps): React.JSX.Element {
  const {
    health = 100,
    maxHealth = 100,
    playerPosition,
    showPauseMenu = false,
    showDisconnectUI = false,
    onResume,
    onExit,
    onReconnect,
  } = props;

  const [showInventory, setShowInventory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Tab') {
        event.preventDefault();
        setShowInventory((prev) => !prev);
      } else if (event.key === 'Escape') {
        if (showInventory) {
          setShowInventory(false);
        } else if (showSettings) {
          setShowSettings(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showInventory, showSettings]);

  return (
    <div style={styles.container}>
      {/* Health Bar */}
      <HealthBar health={health} maxHealth={maxHealth} />

      {/* Minimap */}
      {playerPosition && <Minimap playerPosition={playerPosition} />}

      {/* Chat Overlay */}
      <ChatOverlay />

      {/* Inventory (toggle with Tab) */}
      {showInventory && (
        <Inventory
          onClose={() => {
            setShowInventory(false);
          }}
        />
      )}

      {/* Settings Menu */}
      {showSettings && (
        <SettingsMenu
          onClose={() => {
            setShowSettings(false);
          }}
        />
      )}

      {/* Pause Menu */}
      {showPauseMenu && (
        <div style={styles.pauseMenu}>
          <div style={styles.pauseMenuContent}>
            <h2 style={styles.pauseMenuTitle}>Paused</h2>
            <button
              style={styles.pauseMenuButton}
              onClick={() => {
                onResume?.();
              }}
            >
              Resume
            </button>
            <button
              style={styles.pauseMenuButton}
              onClick={() => {
                setShowSettings(true);
              }}
            >
              Settings
            </button>
            <button
              style={styles.pauseMenuButton}
              onClick={() => {
                onExit?.();
              }}
            >
              Exit Game
            </button>
          </div>
        </div>
      )}

      {/* Disconnect UI */}
      {showDisconnectUI && (
        <div style={styles.disconnectUI}>
          <div style={styles.disconnectContent}>
            <h2 style={styles.disconnectTitle}>Disconnected</h2>
            <p style={styles.disconnectMessage}>Lost connection to server</p>
            <button
              style={styles.disconnectButton}
              onClick={() => {
                onReconnect?.();
              }}
            >
              Reconnect
            </button>
            <button
              style={styles.disconnectButton}
              onClick={() => {
                onExit?.();
              }}
            >
              Exit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 1000,
  },
  pauseMenu: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'all',
  },
  pauseMenuContent: {
    backgroundColor: 'rgba(15, 19, 24, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '2rem 3rem',
    minWidth: '300px',
    textAlign: 'center',
  },
  pauseMenuTitle: {
    color: '#fff',
    fontSize: '1.5rem',
    marginBottom: '1.5rem',
    margin: 0,
  },
  pauseMenuButton: {
    display: 'block',
    width: '100%',
    padding: '0.75rem 1.5rem',
    marginBottom: '0.75rem',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '1rem',
    cursor: 'pointer',
    transition: 'all 200ms ease',
  },
  disconnectUI: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'all',
  },
  disconnectContent: {
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '2rem 3rem',
    minWidth: '300px',
    textAlign: 'center',
  },
  disconnectTitle: {
    color: '#fff',
    fontSize: '1.5rem',
    marginBottom: '1rem',
    margin: 0,
  },
  disconnectMessage: {
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: '1.5rem',
  },
  disconnectButton: {
    display: 'inline-block',
    padding: '0.75rem 1.5rem',
    margin: '0 0.5rem',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '1rem',
    cursor: 'pointer',
    transition: 'all 200ms ease',
  },
};

