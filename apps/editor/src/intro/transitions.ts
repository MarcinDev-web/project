/**
 * Transition effects for intro sequence
 * Handles fade in/out animations for seamless experience
 */

/**
 * Fade out an element
 */
export function fadeOut(element: HTMLElement, duration = 500): Promise<void> {
  return new Promise((resolve) => {
    element.style.transition = `opacity ${duration}ms ease-out`;
    element.style.opacity = '0';
    
    setTimeout(() => {
      element.style.display = 'none';
      resolve();
    }, duration);
  });
}

/**
 * Fade in an element
 */
export function fadeIn(element: HTMLElement, duration = 500): Promise<void> {
  return new Promise((resolve) => {
    element.style.opacity = '0';
    element.style.display = '';
    element.style.transition = `opacity ${duration}ms ease-in`;
    
    // Force reflow
    void element.offsetHeight;
    
    element.style.opacity = '1';
    
    setTimeout(resolve, duration);
  });
}

/**
 * Crossfade between two canvases
 */
export function crossfadeCanvas(
  fromCanvas: HTMLCanvasElement,
  toCanvas: HTMLCanvasElement,
  duration = 1000
): Promise<void> {
  return new Promise((resolve) => {
    // Setup initial states
    fromCanvas.style.position = 'absolute';
    fromCanvas.style.inset = '0';
    fromCanvas.style.transition = `opacity ${duration}ms ease-out`;
    fromCanvas.style.opacity = '1';
    fromCanvas.style.zIndex = '2';
    
    toCanvas.style.position = 'absolute';
    toCanvas.style.inset = '0';
    toCanvas.style.opacity = '0';
    toCanvas.style.zIndex = '1';
    
    // Force reflow
    void fromCanvas.offsetHeight;
    
    // Start crossfade
    fromCanvas.style.opacity = '0';
    toCanvas.style.transition = `opacity ${duration}ms ease-in`;
    toCanvas.style.opacity = '1';
    
    setTimeout(() => {
      // Cleanup - remove absolute positioning from toCanvas
      toCanvas.style.position = '';
      toCanvas.style.inset = '';
      toCanvas.style.zIndex = '';
      toCanvas.style.transition = '';
      
      // Hide fromCanvas completely
      fromCanvas.style.display = 'none';
      
      resolve();
    }, duration);
  });
}

/**
 * Apply curtain reveal effect
 */
export function curtainReveal(element: HTMLElement, duration = 800): Promise<void> {
  return new Promise((resolve) => {
    element.style.clipPath = 'inset(0 0 100% 0)';
    element.style.transition = `clip-path ${duration}ms cubic-bezier(0.65, 0, 0.35, 1)`;
    
    // Force reflow
    void element.offsetHeight;
    
    element.style.clipPath = 'inset(0 0 0 0)';
    
    setTimeout(() => {
      element.style.clipPath = '';
      element.style.transition = '';
      resolve();
    }, duration);
  });
}

/**
 * Flash white transition (classic game loading effect)
 */
export function flashTransition(duration = 300): Promise<void> {
  return new Promise((resolve) => {
    const flash = document.createElement('div');
    flash.style.position = 'fixed';
    flash.style.inset = '0';
    flash.style.background = '#fff';
    flash.style.opacity = '0';
    flash.style.zIndex = '99999';
    flash.style.pointerEvents = 'none';
    flash.style.transition = `opacity ${duration / 2}ms ease-out`;
    
    document.body.appendChild(flash);
    
    // Force reflow
    void flash.offsetHeight;
    
    // Flash in
    flash.style.opacity = '0.8';
    
    setTimeout(() => {
      // Flash out
      flash.style.opacity = '0';
      
      setTimeout(() => {
        flash.remove();
        resolve();
      }, duration / 2);
    }, duration / 2);
  });
}

