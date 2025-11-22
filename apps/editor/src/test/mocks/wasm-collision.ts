// Mock implementation of @engine/wasm-collision for tests
// This avoids loading the actual WASM module which causes issues in Vitest environment

export async function init() {
  return {
    obbIntersect: () => false,
    sphereSphereIntersect: () => false,
    // ...
    // SYNTAX ERROR HERE TO VERIFY ALIAS
    <<<<<< SYNTAX ERROR >>>>>>
  };
}
// ...
