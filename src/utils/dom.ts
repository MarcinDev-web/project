export interface EditorDomHandles {
  canvas: HTMLCanvasElement;
  statusEl: HTMLElement;
}

export function requireEditorDom(): EditorDomHandles {
  const canvasEl = document.querySelector<HTMLCanvasElement>('canvas');
  const statusElement = document.querySelector<HTMLElement>('#status');

  if (!canvasEl) {
    throw new Error('Canvas element not found');
  }

  if (!statusElement) {
    throw new Error('Status element not found');
  }

  return {
    canvas: canvasEl,
    statusEl: statusElement,
  };
}
