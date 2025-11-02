/**
 * DOM utilities for player app
 */

export interface PlayerDomHandles {
  canvas: HTMLCanvasElement;
  statusEl: HTMLElement | null;
  loadingEl: HTMLElement | null;
  errorEl: HTMLElement | null;
  exitButton: HTMLButtonElement | null;
}

export function requirePlayerDom(): PlayerDomHandles {
  const canvasEl = document.querySelector<HTMLCanvasElement>('canvas');
  const statusElement = document.querySelector<HTMLElement>('#status');
  const loadingEl = document.querySelector<HTMLElement>('#loading');
  const errorEl = document.querySelector<HTMLElement>('#error');
  const exitButton = document.querySelector<HTMLButtonElement>('#exit-button');

  if (!canvasEl) {
    throw new Error('Canvas element not found');
  }

  return {
    canvas: canvasEl,
    statusEl: statusElement,
    loadingEl,
    errorEl,
    exitButton,
  };
}

