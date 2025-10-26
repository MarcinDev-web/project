import { bootstrap } from './bootstrap';
import { Logger } from './utils/logger';

bootstrap().catch((error) => {
  Logger.error('bootstrap failed:', error as unknown as Error);
});

