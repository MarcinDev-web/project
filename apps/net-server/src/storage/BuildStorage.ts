/**
 * Build Storage - stores actual project/scene data for marketplace builds
 */

// @ts-expect-error - Prisma client is generated at build time
import type { PrismaClient } from '../../node_modules/.prisma/net-client';
import type { ProjectData } from '../types';

export class BuildStorage {
  constructor(private readonly prisma: PrismaClient) {}

  async initialize(): Promise<void> {
    // Schema is managed by ensureSchema() in db.ts
    // No additional initialization needed
  }

  /**
   * Save build data for a marketplace item
   */
  async saveBuild(
    marketplaceId: string,
    projectData: ProjectData
  ): Promise<void> {
    // Serialize ProjectData to JSON
    const jsonData = JSON.stringify(projectData);
    const buffer = Buffer.from(jsonData, 'utf-8');

    await this.prisma.marketplaceBuild.upsert({
      where: { marketplaceId },
      create: {
        marketplaceId,
        projectData: buffer,
        version: 1,
      },
      update: {
        projectData: buffer,
        version: { increment: 1 },
      },
    });
  }

  /**
   * Get build data for a marketplace item
   */
  async getBuild(marketplaceId: string): Promise<ProjectData | null> {
    const build = await this.prisma.marketplaceBuild.findUnique({
      where: { marketplaceId },
    });

    if (!build) {
      return null;
    }

    try {
      // Deserialize JSON from BYTEA
      const jsonData = build.projectData.toString('utf-8');
      const projectData = JSON.parse(jsonData) as ProjectData;
      return projectData;
    } catch (error) {
      console.error(`Failed to deserialize build data for ${marketplaceId}:`, error);
      throw new Error(`Invalid build data format for ${marketplaceId}`);
    }
  }

  /**
   * Delete build data for a marketplace item
   */
  async deleteBuild(marketplaceId: string): Promise<void> {
    await this.prisma.marketplaceBuild.delete({
      where: { marketplaceId },
    }).catch(() => {
      // Ignore errors if build doesn't exist
    });
  }

  /**
   * Get build version for a marketplace item
   */
  async getBuildVersion(marketplaceId: string): Promise<number | null> {
    const build = await this.prisma.marketplaceBuild.findUnique({
      where: { marketplaceId },
      select: { version: true },
    });

    return build?.version ?? null;
  }

  /**
   * Check if build exists
   */
  async buildExists(marketplaceId: string): Promise<boolean> {
    const count = await this.prisma.marketplaceBuild.count({
      where: { marketplaceId },
    });

    return count > 0;
  }
}
