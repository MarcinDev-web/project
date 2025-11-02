/**
 * Seed script to add mock games to marketplace
 */

import { MarketplaceStorage } from '../storage/MarketplaceStorage';
import { GameSessionTracker } from '../websocket/GameSessionTracker';
import { generateAndSaveThumbnail } from '../utils/thumbnailGenerator';
import { createDbPool } from '../lib/db';
import { BuildStorage } from '../storage/BuildStorage';
import type { ProjectData } from '../types';
import type { Pool } from 'pg';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const THUMBNAIL_DIR = path.join(DATA_DIR, 'thumbnails');
const storage = new MarketplaceStorage(DATA_DIR);
const gameSessionTracker = new GameSessionTracker();

// Mock builds data - Kogama style: short, simple names describing the build
// In Kogama, builds are models (like "House", "Car", "Castle") - simple 3D structures
const mockGames = [
  {
    type: 'build' as const,
    title: 'Dungeon Build',
    description: 'A detailed dungeon with traps, treasure rooms, and multiple floors.',
    authorId: 'mock_user_1',
    authorName: 'GameMaster42',
    fileUrl: '', // Will be set after creation
    tags: ['dungeon', 'building', 'fantasy'],
    public: true,
  },
  {
    type: 'build' as const,
    title: 'Race Car',
    description: 'Fast racing car model with detailed wheels and spoiler.',
    authorId: 'mock_user_2',
    authorName: 'SpeedRacer99',
    fileUrl: '',
    tags: ['car', 'vehicle', 'racing'],
    public: true,
  },
  {
    type: 'build' as const,
    title: 'Space Station',
    description: 'Modular space station with docking ports and solar panels.',
    authorId: 'mock_user_3',
    authorName: 'SpaceArchitect',
    fileUrl: '',
    tags: ['space', 'station', 'sci-fi'],
    public: true,
  },
  {
    type: 'build' as const,
    title: 'Puzzle Block',
    description: 'Interactive puzzle block set for brain teasers.',
    authorId: 'mock_user_4',
    authorName: 'PuzzleMaster',
    fileUrl: '',
    tags: ['puzzle', 'block', 'game'],
    public: true,
  },
  {
    type: 'build' as const,
    title: 'Zombie Arena',
    description: 'Arena with walls, obstacles, and spawn points for zombie battles.',
    authorId: 'mock_user_5',
    authorName: 'ZombieSlayer',
    fileUrl: '',
    tags: ['arena', 'zombie', 'combat'],
    public: true,
  },
  {
    type: 'build' as const,
    title: 'Castle',
    description: 'Medieval castle with towers, gates, and a courtyard.',
    authorId: 'mock_user_1',
    authorName: 'GameMaster42',
    fileUrl: '',
    tags: ['castle', 'medieval', 'building'],
    public: true,
  },
  {
    type: 'build' as const,
    title: 'Cyber City Block',
    description: 'Futuristic city block with neon signs and flying vehicles.',
    authorId: 'mock_user_6',
    authorName: 'CyberExplorer',
    fileUrl: '',
    tags: ['city', 'cyberpunk', 'building'],
    public: true,
  },
  {
    type: 'build' as const,
    title: 'Ocean Base',
    description: 'Underwater base with glass corridors and sea life viewing areas.',
    authorId: 'mock_user_7',
    authorName: 'DeepSeaDiver',
    fileUrl: '',
    tags: ['ocean', 'base', 'underwater'],
    public: true,
  },
  {
    type: 'build' as const,
    title: 'Modern House',
    description: 'Contemporary house with clean lines and modern design.',
    authorId: 'mock_user_8',
    authorName: 'BuilderPro',
    fileUrl: '',
    tags: ['house', 'modern', 'residential'],
    public: true,
  },
  {
    type: 'build' as const,
    title: 'Medieval Village',
    description: 'Small village with houses, a market, and a central square.',
    authorId: 'mock_user_1',
    authorName: 'GameMaster42',
    fileUrl: '',
    tags: ['village', 'medieval', 'town'],
    public: true,
  },
];

export async function seedMarketplace(tracker?: GameSessionTracker): Promise<void> {
  try {
    await storage.initialize();
    
    // Check if marketplace already has items
    const existing = await storage.getItems({ limit: 1 });
    if (existing.length > 0) {
      console.log('Marketplace already has items. Skipping seed.');
      return;
    }

    console.log('Seeding marketplace with mock games...');
    
    // Initialize build storage if database is available
    let buildStorage: BuildStorage | null = null;
    let dbPool: Pool | null = null;
    if (process.env.DATABASE_URL) {
      try {
        dbPool = createDbPool();
        buildStorage = new BuildStorage(dbPool);
        console.log('Build storage initialized');
      } catch (error) {
        console.warn('Failed to initialize build storage:', error);
      }
    }
    
    // Use provided tracker or create a new one
    const trackerToUse = tracker ?? gameSessionTracker;
    
    for (const game of mockGames) {
      // Create item first to get the ID
      const item = await storage.createItem(game);
      console.log(`✓ Created: ${item.title}`);
      
      // In Kogama style: builds are accessed via their marketplace ID
      // Replace placeholder {id} with actual item ID
      const fileUrl = `/api/marketplace/${item.id}/build`;
      
      // Generate thumbnail (with error handling)
      let thumbnailUrl: string | undefined;
      try {
        const thumbnailFilename = await generateAndSaveThumbnail(
          THUMBNAIL_DIR,
          item.id,
          item.title,
          item.tags
        );
        thumbnailUrl = `/api/marketplace/thumbnails/${item.id}`;
        console.log(`  → Generated thumbnail: ${thumbnailFilename}`);
      } catch (error) {
        console.warn(`  → Failed to generate thumbnail for ${item.title}:`, error);
        // Continue without thumbnail - will be generated later if needed
      }
      
      // Simulate some downloads and likes for variety
      const downloads = Math.floor(Math.random() * 1000) + 10;
      const likes = Math.floor(Math.random() * 500) + 5;
      
      // Update with correct fileUrl, simulated stats and thumbnail
      await storage.updateItem(item.id, {
        fileUrl, // Set proper fileUrl with actual ID
        downloads,
        likes,
        ...(thumbnailUrl && { thumbnailUrl }), // Only add thumbnailUrl if it was generated
      });
      
      // Save build data if storage is available and item is a build
      if (item.type === 'build' && buildStorage) {
        try {
          const projectData: ProjectData = {
            metadata: {
              id: item.id,
              name: item.title,
              createdAt: item.createdAt,
              updatedAt: item.updatedAt,
              ...(thumbnailUrl !== undefined && { thumbnail: thumbnailUrl }),
            },
            scene: {
              name: item.title,
              entities: [
                // Add a few mock entities for variety
                {
                  id: `${item.id}_entity_1`,
                  name: 'Entity 1',
                  components: [
                    {
                      type: 'Transform',
                      props: {
                        position: [0, 0, 0],
                        rotation: [0, 0, 0, 1],
                        scale: [1, 1, 1],
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
                {
                  id: `${item.id}_entity_2`,
                  name: 'Entity 2',
                  components: [
                    {
                      type: 'Transform',
                      props: {
                        position: [5, 0, 5],
                        rotation: [0, Math.PI / 4, 0, 1],
                        scale: [1, 1, 1],
                      },
                    },
                  ],
                  transform: {
                    position: [5, 0, 5],
                    rotation: [0, Math.PI / 4, 0, 1],
                    scale: [1, 1, 1],
                  },
                  children: [],
                },
              ],
            },
          };
          await buildStorage.saveBuild(item.id, projectData);
          console.log(`  → Saved build data`);
        } catch (error) {
          console.warn(`  → Failed to save build data:`, error);
        }
      }

      // Simulate some players online (mock users playing)
      const playersOnline = Math.floor(Math.random() * 20); // 0-19 players
      if (playersOnline > 0 && trackerToUse) {
        // Create mock user IDs and join them to the game
        for (let i = 0; i < playersOnline; i++) {
          const mockUserId = `mock_player_${item.id}_${i}`;
          trackerToUse.joinGame(item.id, mockUserId);
        }
        console.log(`  → ${playersOnline} mock players online`);
      }
    }

    // Cleanup database pool if created
    if (dbPool) {
      await dbPool.end();
    }

    console.log(`✓ Successfully seeded ${mockGames.length} mock games!`);
  } catch (error) {
    console.error('Error seeding marketplace:', error);
    throw error;
  }
}

// Run if called directly (not imported)
if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/') || '')) {
  void seedMarketplace().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
}

