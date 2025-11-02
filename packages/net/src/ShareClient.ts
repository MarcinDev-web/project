import type { ProjectData, ShareLink, SharedProjectMetadata } from './types';

/**
 * Error thrown by ShareClient when a request fails.
 */
export class ShareClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'ShareClientError';
  }
}

/**
 * HTTP client for project sharing endpoints.
 * Communicates with the net-server to share, load, and revoke project shares.
 */
export class ShareClient {
  constructor(private readonly baseUrl: string) {
    // Ensure baseUrl doesn't end with a slash
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Share a project and get a shareable link.
   * @param projectId - Local project ID
   * @param projectData - Complete project data to share
   * @returns Share link with token and URL
   * @throws ShareClientError if request fails
   */
  async shareProject(projectId: string, projectData: ProjectData): Promise<ShareLink> {
    try {
      const response = await fetch(`${this.baseUrl}/api/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          projectData,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new ShareClientError(
          `Failed to share project: ${errorText}`,
          response.status
        );
      }

      const result = (await response.json()) as ShareLink;
      return result;
    } catch (error) {
      if (error instanceof ShareClientError) {
        throw error;
      }
      throw new ShareClientError(
        `Network error while sharing project: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        error
      );
    }
  }

  /**
   * Load a shared project by token.
   * @param token - Share token from the share link
   * @returns Project data
   * @throws ShareClientError if token is invalid or project not found
   */
  async loadSharedProject(token: string): Promise<ProjectData> {
    try {
      const response = await fetch(`${this.baseUrl}/api/share/${encodeURIComponent(token)}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new ShareClientError('Shared project not found', 404);
        }
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new ShareClientError(
          `Failed to load shared project: ${errorText}`,
          response.status
        );
      }

      const result = (await response.json()) as ProjectData;
      return result;
    } catch (error) {
      if (error instanceof ShareClientError) {
        throw error;
      }
      throw new ShareClientError(
        `Network error while loading shared project: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        error
      );
    }
  }

  /**
   * Get metadata for a shared project (without loading full project data).
   * @param token - Share token
   * @returns Project metadata
   * @throws ShareClientError if token is invalid
   */
  async getSharedProjectMetadata(token: string): Promise<SharedProjectMetadata> {
    try {
      const response = await fetch(`${this.baseUrl}/api/share/${encodeURIComponent(token)}/metadata`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new ShareClientError('Shared project not found', 404);
        }
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new ShareClientError(
          `Failed to load shared project metadata: ${errorText}`,
          response.status
        );
      }

      const result = (await response.json()) as SharedProjectMetadata;
      return result;
    } catch (error) {
      if (error instanceof ShareClientError) {
        throw error;
      }
      throw new ShareClientError(
        `Network error while loading shared project metadata: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        error
      );
    }
  }

  /**
   * Revoke (delete) a share link.
   * @param token - Share token to revoke
   * @throws ShareClientError if request fails
   */
  async revokeShare(token: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/share/${encodeURIComponent(token)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Already deleted or never existed - consider it successful
          return;
        }
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new ShareClientError(
          `Failed to revoke share: ${errorText}`,
          response.status
        );
      }
    } catch (error) {
      if (error instanceof ShareClientError) {
        throw error;
      }
      throw new ShareClientError(
        `Network error while revoking share: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        error
      );
    }
  }
}

