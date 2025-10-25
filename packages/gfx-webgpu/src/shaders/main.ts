// Import shader variant
import { createPbrShaderCode } from './pbr';


// New shader with multi-light support
export function createMainShaderCode(): string {
  // Temporary: prefer PBR; fallback to lighting if needed later
  return createPbrShaderCode();
}
