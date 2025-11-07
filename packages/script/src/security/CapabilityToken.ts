/**
 * Capability Token System
 * 
 * Provides capability-based access control for script APIs.
 * Capabilities are opaque tokens granted based on PlayManifest permissions.
 * Each API call validates the capability token before allowing access.
 */

/**
 * Opaque capability token type (branded string for type safety)
 */
export type CapabilityToken = string & { readonly __brand: 'CapabilityToken' };

/**
 * Set of capability names
 */
export type CapabilitySet = Set<string>;

/**
 * Capability permissions structure matching PlayManifest
 */
export interface CapabilityPermissions {
  [capabilityName: string]: boolean | undefined;
}

/**
 * CapabilityManager manages capability tokens and permissions
 */
export class CapabilityManager {
  private readonly tokens = new Map<CapabilityToken, CapabilitySet>();
  private tokenCounter = 0;

  /**
   * Grants a capability and returns an opaque token
   * 
   * @param capabilityName - Name of the capability to grant
   * @returns Opaque capability token
   */
  grantCapability(capabilityName: string): CapabilityToken {
    const token = this.createToken();
    const capabilities = new Set<string>([capabilityName]);
    this.tokens.set(token, capabilities);
    return token;
  }

  /**
   * Grants multiple capabilities and returns a single token
   * 
   * @param capabilityNames - Array of capability names to grant
   * @returns Opaque capability token
   */
  grantCapabilities(capabilityNames: string[]): CapabilityToken {
    const token = this.createToken();
    const capabilities = new Set<string>(capabilityNames);
    this.tokens.set(token, capabilities);
    return token;
  }

  /**
   * Revokes a capability token (invalidates it)
   * 
   * @param token - Token to revoke
   */
  revokeCapability(token: CapabilityToken): void {
    this.tokens.delete(token);
  }

  /**
   * Checks if a token has a specific capability
   * 
   * @param token - Capability token to check
   * @param capabilityName - Name of the capability to check
   * @returns True if token has the capability
   */
  hasCapability(token: CapabilityToken, capabilityName: string): boolean {
    const capabilities = this.tokens.get(token);
    if (!capabilities) {
      return false;
    }
    return capabilities.has(capabilityName);
  }

  /**
   * Validates that a token is still valid (not revoked)
   * 
   * @param token - Token to validate
   * @returns True if token is valid
   */
  validateToken(token: CapabilityToken): boolean {
    return this.tokens.has(token);
  }

  /**
   * Gets all capabilities for a token
   * 
   * @param token - Token to query
   * @returns Set of capability names, or undefined if token invalid
   */
  getCapabilities(token: CapabilityToken): CapabilitySet | undefined {
    return this.tokens.get(token);
  }

  /**
   * Revokes all tokens (for cleanup/testing)
   */
  revokeAll(): void {
    this.tokens.clear();
  }

  /**
   * Creates a new opaque token
   */
  private createToken(): CapabilityToken {
    const tokenId = `cap_${Date.now()}_${this.tokenCounter++}_${Math.random().toString(36).substring(2, 9)}`;
    return tokenId as CapabilityToken;
  }
}

