import path from 'path';
import { fileURLToPath } from 'url';
import { engineAliases } from '../../shared/config/aliases';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const createEditorAlias = (isBuild: boolean): Record<string, string> => {
  if (isBuild) {
    return {};
  }

  return {
    ...engineAliases(__dirname),
  };
};


