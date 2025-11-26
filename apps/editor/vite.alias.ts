import path from 'path';
import { fileURLToPath } from 'url';
import { engineAliases } from '../../shared/config/aliases';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// @shared is always bundled (not externalized like @engine packages)
const sharedAlias = {
  '@shared': path.resolve(__dirname, '../../shared'),
};

export const createEditorAlias = (isBuild: boolean): Record<string, string> => {
  if (isBuild) {
    return sharedAlias;
  }

  return {
    ...sharedAlias,
    ...engineAliases(__dirname),
  };
};


