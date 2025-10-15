import { bootstrap } from './bootstrap';
import { Logger } from './logger';

bootstrap().catch((error) => {
  Logger.error('bootstrap failed:', error as unknown as Error);
});
