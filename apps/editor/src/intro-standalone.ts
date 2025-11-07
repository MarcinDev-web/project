/**
 * Standalone intro runner - runs ONLY the intro without the full editor app
 */

import { runIntro } from './intro';

async function main(): Promise<void> {
  const canvas = document.querySelector('canvas');
  if (!canvas) {
    console.error('Canvas not found');
    return;
  }

  // Set canvas size
  const resizeCanvas = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Run intro (5 seconds)
  try {
    await runIntro(canvas, 5);
    console.log('Intro completed!');
    
    // After intro, show message or restart
    document.body.style.display = 'flex';
    document.body.style.alignItems = 'center';
    document.body.style.justifyContent = 'center';
    document.body.style.color = '#fff';
    document.body.style.fontFamily = 'system-ui, sans-serif';
    document.body.style.fontSize = '24px';
    
    const message = document.createElement('div');
    message.textContent = 'Intro completed! Refresh to see it again.';
    message.style.textAlign = 'center';
    document.body.appendChild(message);
  } catch (error) {
    console.error('Intro failed:', error);
    document.body.style.display = 'flex';
    document.body.style.alignItems = 'center';
    document.body.style.justifyContent = 'center';
    document.body.style.color = '#f00';
    document.body.style.fontFamily = 'system-ui, sans-serif';
    
    const errorMsg = document.createElement('div');
    errorMsg.textContent = `Intro failed: ${error instanceof Error ? error.message : String(error)}`;
    errorMsg.style.textAlign = 'center';
    document.body.appendChild(errorMsg);
  }
}

main().catch(console.error);

