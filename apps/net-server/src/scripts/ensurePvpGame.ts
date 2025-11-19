/**
 * Script to ensure a PVP game is published and visible on the homepage
 * This creates or updates a PVP game project to ensure it appears in the games list
 */

import { StudioProjectsStorageDB } from '../storage/StudioProjectsStorage.js';
import { MarketplaceStorageDB } from '../storage/MarketplaceStorageDB.js';
import { BuildStorage } from '../storage/BuildStorage.js';
import { generateAndSaveThumbnail } from '../utils/thumbnailGenerator.js';
import { createDbPool } from '../lib/db.js';
import type { ProjectData } from '../types.js';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const THUMBNAIL_DIR = path.join(DATA_DIR, 'thumbnails');

// PVP Game configuration
const PVP_GAME_CONFIG = {
  userId: 'system_pvp_game', // System user ID for the PVP game
  name: 'Competitive PvP Arena',
  description: 'High-intensity PvP combat arena with weapons, spawn points, and respawn system. Battle other players in this competitive multiplayer experience.',
  tags: ['pvp', 'arena', 'battle', 'combat', 'shooter', 'multiplayer'],
};

/**
 * Creates a minimal ProjectData structure for the PVP game
 */
function createPvpProjectData(projectId: string, marketplaceItemId: string): ProjectData {
  const now = Date.now();
  return {
    metadata: {
      id: projectId,
      name: PVP_GAME_CONFIG.name,
      createdAt: now,
      updatedAt: now,
      marketplaceItemId,
    },
    scene: {
      name: PVP_GAME_CONFIG.name,
      entities: [
        {
          id: `${projectId}_spawn_1`,
          name: 'Spawn Point 1',
          components: [
            {
              type: 'Transform',
              props: {
                position: [0, 0, 0],
                rotation: [0, 0, 0, 1],
                scale: [1, 1, 1],
              },
            },
            {
              type: 'SpawnPoint',
              props: {
                givePvPLoadout: true,
              },
            },
          ],
          transform: {
            position: [0, 0, 0],
            rotation: [0, 0, 0, 1],
            scale: [1, 1, 1],
          },
          children: [],
        },
      ],
    },
  };
}

export async function ensurePvpGame(): Promise<void> {
  let dbPool: Awaited<ReturnType<typeof createDbPool>> | null = null;

  try {
    // Initialize database connection
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL is not set. Cannot ensure PVP game without database.');
      process.exit(1);
    }

    dbPool = await createDbPool();
    console.log('Database connection established');

    const studioStorage = new StudioProjectsStorageDB(dbPool);
    const marketplaceStorage = new MarketplaceStorageDB(dbPool);
    const buildStorage = new BuildStorage(dbPool);

    await studioStorage.initialize();
    await marketplaceStorage.initialize();

    // Check if a PVP game project already exists
    const existingProjects = await studioStorage.listProjects(PVP_GAME_CONFIG.userId);
    let pvpProject = existingProjects.find(
      (p) => p.name.toLowerCase().includes('pvp') || p.tags?.some((tag) => tag.toLowerCase() === 'pvp')
    );

    let marketplaceItemId: string | undefined;

    if (pvpProject) {
      console.log(`Found existing PVP project: ${pvpProject.id} (${pvpProject.name})`);

      // Check if it has a marketplace item linked
      marketplaceItemId = pvpProject.projectData?.metadata?.marketplaceItemId;

      if (marketplaceItemId) {
        // Verify marketplace item exists
        const marketplaceItem = await marketplaceStorage.getItem(marketplaceItemId);
        if (!marketplaceItem) {
          console.log('Marketplace item not found, will create new one');
          marketplaceItemId = undefined;
        } else {
          console.log(`Linked marketplace item: ${marketplaceItemId}`);
        }
      }

      // Update project if needed
      if (!pvpProject.isPublished || !marketplaceItemId || !pvpProject.tags?.includes('pvp')) {
        console.log('Updating PVP project...');

        // Create marketplace item if missing
        if (!marketplaceItemId) {
          const newMarketplaceItem = await marketplaceStorage.createItem({
            type: 'build',
            title: PVP_GAME_CONFIG.name,
            description: PVP_GAME_CONFIG.description,
            authorId: PVP_GAME_CONFIG.userId,
            authorName: 'System',
            fileUrl: '', // Will be updated after creation
            tags: PVP_GAME_CONFIG.tags,
            public: true,
          });

          marketplaceItemId = newMarketplaceItem.id;
          console.log(`Created marketplace item: ${marketplaceItemId}`);

          // Update fileUrl with actual ID
          await marketplaceStorage.updateItem(marketplaceItemId, {
            fileUrl: `/api/marketplace/${marketplaceItemId}/build`,
          });
        }

        // Update project data with marketplace link
        const updatedProjectData = createPvpProjectData(pvpProject.id, marketplaceItemId);

        // Save build data
        await buildStorage.saveBuild(marketplaceItemId, updatedProjectData);

        // Update project
        await studioStorage.updateProject(PVP_GAME_CONFIG.userId, pvpProject.id, {
          name: PVP_GAME_CONFIG.name,
          description: PVP_GAME_CONFIG.description,
          tags: PVP_GAME_CONFIG.tags,
          isPublished: true,
          projectData: updatedProjectData,
        });

        console.log('✓ PVP project updated and published');
      } else {
        console.log('✓ PVP project is already published and configured correctly');
      }
    } else {
      // Create new PVP project
      console.log('Creating new PVP project...');

      // Create marketplace item first
      const marketplaceItem = await marketplaceStorage.createItem({
        type: 'build',
        title: PVP_GAME_CONFIG.name,
        description: PVP_GAME_CONFIG.description,
        authorId: PVP_GAME_CONFIG.userId,
        authorName: 'System',
        fileUrl: '', // Will be updated after creation
        tags: PVP_GAME_CONFIG.tags,
        public: true,
      });

      marketplaceItemId = marketplaceItem.id;
      console.log(`Created marketplace item: ${marketplaceItemId}`);

      // Update fileUrl with actual ID
      await marketplaceStorage.updateItem(marketplaceItemId, {
        fileUrl: `/api/marketplace/${marketplaceItemId}/build`,
      });

      // Generate thumbnail
      let thumbnailUrl: string | undefined;
      try {
        const thumbnailFilename = await generateAndSaveThumbnail(
          THUMBNAIL_DIR,
          marketplaceItemId,
          PVP_GAME_CONFIG.name,
          PVP_GAME_CONFIG.tags
        );
        thumbnailUrl = `/api/marketplace/thumbnails/${marketplaceItemId}`;
        console.log(`Generated thumbnail: ${thumbnailFilename}`);

        // Update marketplace item with thumbnail
        await marketplaceStorage.updateItem(marketplaceItemId, { thumbnailUrl });
      } catch (error) {
        console.warn('Failed to generate thumbnail:', error);
      }

      // Create project (ID will be generated by createProject)
      const tempProjectData = createPvpProjectData('temp', marketplaceItemId);
      
      const newProject = await studioStorage.createProject(PVP_GAME_CONFIG.userId, {
        name: PVP_GAME_CONFIG.name,
        description: PVP_GAME_CONFIG.description,
        tags: PVP_GAME_CONFIG.tags,
        projectData: tempProjectData,
        ...(thumbnailUrl && { thumbnailUrl }),
      });

      // Update project data with correct ID
      const finalProjectData = createPvpProjectData(newProject.id, marketplaceItemId);

      // Save build data
      await buildStorage.saveBuild(marketplaceItemId, finalProjectData);

      // Update project to be published
      await studioStorage.updateProject(PVP_GAME_CONFIG.userId, newProject.id, {
        isPublished: true,
        projectData: finalProjectData,
      });

      console.log(`✓ Created and published PVP project: ${newProject.id}`);
    }

    // Add some initial stats to make it visible
    const finalMarketplaceItem = await marketplaceStorage.getItem(marketplaceItemId!);
    if (finalMarketplaceItem && (finalMarketplaceItem.downloads === 0 || finalMarketplaceItem.likes === 0)) {
      await marketplaceStorage.updateItem(marketplaceItemId!, {
        downloads: 10,
        likes: 5,
      });
      console.log('✓ Added initial stats to marketplace item');
    }

    console.log('\n✅ PVP game is now published and should be visible on the homepage!');
    console.log(`   Project ID: ${pvpProject?.id || 'new'}`);
    console.log(`   Marketplace Item ID: ${marketplaceItemId}`);
  } catch (error) {
    console.error('Error ensuring PVP game:', error);
    throw error;
  } finally {
    if (dbPool) {
      await dbPool.$disconnect();
    }
  }
}

// Run if called directly
if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/') || '')) {
  void ensurePvpGame()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

