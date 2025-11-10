import React from 'react';
import { createRoot } from 'react-dom/client';
import { HUD } from './HUD.js';
import type { HUDProps } from './HUD.js';

/**
 * Initialize HUD React app
 */
export function initHUD(props: HUDProps): () => void {
  const container = document.getElementById('hud-root');
  if (!container) {
    console.error('HUD root container not found');
    return () => {};
  }

  const root = createRoot(container);
  root.render(React.createElement(HUD, props));

  return () => {
    root.unmount();
  };
}

