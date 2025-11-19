/**
 * Simple script to add PVP game to marketplace and publish it
 * This ensures the PVP game is always available on the homepage
 */

import { MarketplaceStorageDB } from '../storage/MarketplaceStorageDB.js';
import { MarketplaceStorage } from '../storage/MarketplaceStorage.js';
import { StudioProjectsStorageDB, StudioProjectsStorage } from '../storage/StudioProjectsStorage.js';
import { BuildStorage } from '../storage/BuildStorage.js';
import { generateAndSaveThumbnail } from '../utils/thumbnailGenerator.js';
import { createDbPool } from '../lib/db.js';
import type { ProjectData } from '../types.js';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const THUMBNAIL_DIR = path.join(DATA_DIR, 'thumbnails');

const PVP_GAME = {
  title: 'Competitive PvP Arena',
  description: 'High-intensity PvP combat arena with weapons, spawn points, and respawn system. Battle other players in this competitive multiplayer experience.',
  authorId: 'mock_user_pvp',
  authorName: 'System',
  tags: ['pvp', 'arena', 'battle', 'combat', 'shooter', 'multiplayer'],
};

async function addPvpGame() {
  let dbPool: Awaited<ReturnType<typeof createDbPool>> | null = null;

  try {
    console.log('Starting PVP game setup...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set (using JSON storage)');
    
    // Use database if available, otherwise use JSON storage
    if (process.env.DATABASE_URL) {
      console.log('Connecting to database...');
      dbPool = await createDbPool();
      console.log('✓ Database connection established');
    } else {
      console.log('Using JSON file storage (no database)');
    }

    const marketplaceStorage = dbPool
      ? new MarketplaceStorageDB(dbPool)
      : new MarketplaceStorage(DATA_DIR);
    const studioStorage = dbPool
      ? new StudioProjectsStorageDB(dbPool)
      : new StudioProjectsStorage(DATA_DIR);
    const buildStorage = dbPool ? new BuildStorage(dbPool) : null;

    await marketplaceStorage.initialize();
    await studioStorage.initialize();

    // Check if PVP game already exists in marketplace
    const existingPvpGames = await marketplaceStorage.getItems({
      tags: ['pvp'],
      type: 'build',
      public: true,
    });

    let marketplaceItem;
    if (existingPvpGames.length > 0) {
      marketplaceItem = existingPvpGames[0]!;
      console.log(`✓ PVP game already exists in marketplace: ${marketplaceItem.id}`);
    } else {
      // Create marketplace item
      marketplaceItem = await marketplaceStorage.createItem({
        type: 'build',
        title: PVP_GAME.title,
        description: PVP_GAME.description,
        authorId: PVP_GAME.authorId,
        authorName: PVP_GAME.authorName,
        fileUrl: '',
        tags: PVP_GAME.tags,
        public: true,
      });

      // Update fileUrl
      await marketplaceStorage.updateItem(marketplaceItem.id, {
        fileUrl: `/api/marketplace/${marketplaceItem.id}/build`,
        downloads: 100,
        likes: 50,
      });

      console.log(`✓ Created marketplace item: ${marketplaceItem.id}`);

      // Generate thumbnail
      try {
        await generateAndSaveThumbnail(
          THUMBNAIL_DIR,
          marketplaceItem.id,
          PVP_GAME.title,
          PVP_GAME.tags
        );
        await marketplaceStorage.updateItem(marketplaceItem.id, {
          thumbnailUrl: `/api/marketplace/thumbnails/${marketplaceItem.id}`,
        });
        console.log('✓ Generated thumbnail');
      } catch (error) {
        console.warn('⚠ Failed to generate thumbnail:', error);
      }
    }

    // Create project data
    const projectData: ProjectData = {
      metadata: {
        id: marketplaceItem.id,
        name: PVP_GAME.title,
        createdAt: marketplaceItem.createdAt,
        updatedAt: marketplaceItem.updatedAt,
        marketplaceItemId: marketplaceItem.id,
        ...(marketplaceItem.thumbnailUrl && { thumbnail: marketplaceItem.thumbnailUrl }),
      },
      scene: {
        name: PVP_GAME.title,
        entities: [
          {
            id: `${marketplaceItem.id}_spawn_1`,
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

    // Save build data (only if buildStorage is available)
    if (buildStorage) {
      await buildStorage.saveBuild(marketplaceItem.id, projectData);
      console.log('✓ Saved build data');
    } else {
      console.log('⚠ Build storage not available (JSON mode), skipping build data save');
    }

    // Check if published project already exists
    const existingProjects = await studioStorage.listProjects(PVP_GAME.authorId);
    const existingPvpProject = existingProjects.find(
      (p) => p.projectData?.metadata?.marketplaceItemId === marketplaceItem.id
    );

    if (existingPvpProject) {
      if (!existingPvpProject.isPublished) {
        await studioStorage.updateProject(PVP_GAME.authorId, existingPvpProject.id, {
          isPublished: true,
        });
        console.log(`✓ Published existing project: ${existingPvpProject.id}`);
      } else {
        console.log(`✓ Project already published: ${existingPvpProject.id}`);
      }
    } else {
      // Create and publish project
      const project = await studioStorage.createProject(PVP_GAME.authorId, {
        name: PVP_GAME.title,
        description: PVP_GAME.description,
        tags: PVP_GAME.tags,
        projectData,
        ...(marketplaceItem.thumbnailUrl && { thumbnailUrl: marketplaceItem.thumbnailUrl }),
      });

      await studioStorage.updateProject(PVP_GAME.authorId, project.id, {
        isPublished: true,
      });

      console.log(`✓ Created and published project: ${project.id}`);
    }

    console.log('\n✅ PVP game is now available on the homepage!');
    console.log(`   Marketplace Item ID: ${marketplaceItem.id}`);
  } catch (error) {
    console.error('❌ Error adding PVP game:', error);
    throw error;
  } finally {
    if (dbPool) {
      await dbPool.$disconnect();
    }
  }
}

// Run the script
void addPvpGame()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

