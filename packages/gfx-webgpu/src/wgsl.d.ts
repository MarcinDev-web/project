/**
 * Type declarations for WGSL shader imports
 * 
 * Allows importing .wgsl files as raw strings using Vite's ?raw suffix.
 * This is used for shader source code that gets compiled at runtime.
 */

declare module '*.wgsl?raw' {
  const content: string;
  export default content;
}

declare module '*.wgsl' {
  const content: string;
  export default content;
}

