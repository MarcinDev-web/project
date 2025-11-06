/**
 * Intro module exports
 */

export { IntroScene, type IntroSceneOptions } from './IntroScene';
export { IntroOverlay, type IntroOverlayOptions } from './IntroOverlay';
export * from './transitions';

import { IntroScene } from './IntroScene';
import { IntroOverlay } from './IntroOverlay';
import { fadeIn, flashTransition } from './transitions';

/**
 * Main intro coordinator
 * Runs both 3D scene and HTML overlay in sync
 */
export async function runIntro(
  canvas: HTMLCanvasElement,
  duration = 5
): Promise<void> {
  return new Promise<void>((resolve) => {
    let completed = false;
    let scene: IntroScene | null = null;
    let overlay: IntroOverlay | null = null;

    const complete = async () => {
      if (completed) return;
      completed = true;
      
      // Cleanup
      overlay?.setPhase('finale');
      scene?.stop();
      overlay?.hide();
      
      // Epic transition: flash white then fade in main canvas
      try {
        await flashTransition(400);
        
        // Ensure canvas is ready for main app
        canvas.style.opacity = '0';
        await fadeIn(canvas, 600);
      } catch (error) {
        console.warn('Transition effect failed:', error);
      }
      
      // Wait a bit for smooth transition
      setTimeout(resolve, 100);
    };

    // Create ultra cinematic overlay first
    overlay = new IntroOverlay({ duration });
    overlay.show();

    // Create intro scene
    scene = new IntroScene({
      canvas,
      onComplete: complete,
      duration,
      onPhaseChange: (phase) => {
        overlay?.setPhase(phase);
      },
    });

    // Start scene rendering
    scene.start().catch((error) => {
      console.error('Intro scene failed:', error);
      complete();
    });
  });
}

