import { bootstrap } from './bootstrap.js';
import { Logger } from './utils/logger';

bootstrap().catch((error) => {
  Logger.error('Player bootstrap failed:', error as unknown as Error);
  
  // Show error in UI
  const errorEl = document.getElementById('error');
  if (errorEl) {
    errorEl.textContent = `Failed to start game: ${error instanceof Error ? error.message : String(error)}`;
    errorEl.style.display = 'block';
  }
});

