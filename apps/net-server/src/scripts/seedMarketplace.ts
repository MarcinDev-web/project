/**
 * Seed script to add mock builds and avatars to marketplace
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

// Mock builds data - buildings and structures only
const mockBuilds = [
  {
    type: 'build' as const,
    title: 'Medieval Castle',
    description: 'Imposing castle with towers, gates, and a grand courtyard.',
    authorId: 'mock_user_1',
    authorName: 'BuilderMaster',
    fileUrl: '', // Will be set after creation
    tags: ['castle', 'medieval', 'building', 'defense'],
    public: true,
  },
  {
    type: 'build' as const,
    title: 'Modern House',
    description: 'Contemporary house with clean lines, large windows, and modern design.',
    authorId: 'mock_user_2',
    authorName: 'ArchitectPro',
    fileUrl: '',
    tags: ['house', 'modern', 'residential', 'home'],
    public: true,
  },
  {
    type: 'build' as const,
    title: 'Skyscraper Tower',
    description: 'Tall commercial tower with glass facade and multiple floors.',
    authorId: 'mock_user_3',
    authorName: 'CityBuilder',
    fileUrl: '',
    tags: ['tower', 'skyscraper', 'building', 'urban'],
    public: true,
  },
  {
    type: 'build' as const,
    title: 'Victorian Mansion',
    description: 'Elegant Victorian-era mansion with ornate details and gardens.',
    authorId: 'mock_user_4',
    authorName: 'ClassicDesign',
    fileUrl: '',
    tags: ['mansion', 'victorian', 'luxury', 'historic'],
    public: true,
  },
  {
    type: 'build' as const,
    title: 'Shopping Mall',
    description: 'Large shopping center with multiple stores and food court.',
    authorId: 'mock_user_5',
    authorName: 'MallBuilder',
    fileUrl: '',
    tags: ['mall', 'shopping', 'commercial', 'building'],
    public: true,
  },
  {
    type: 'build' as const,
    title: 'Apartment Complex',
    description: 'Multi-story apartment building with balconies and parking.',
    authorId: 'mock_user_1',
    authorName: 'BuilderMaster',
    fileUrl: '',
    tags: ['apartment', 'residential', 'building', 'multi-unit'],
    public: true,
  },
  {
    type: 'build' as const,
    title: 'Futuristic Office',
    description: 'High-tech office building with sleek design and modern amenities.',
    authorId: 'mock_user_6',
    authorName: 'FutureBuilds',
    fileUrl: '',
    tags: ['office', 'futuristic', 'commercial', 'modern'],
    public: true,
  },
  {
    type: 'build' as const,
    title: 'Log Cabin',
    description: 'Rustic log cabin nestled in the woods with a cozy fireplace.',
    authorId: 'mock_user_7',
    authorName: 'NatureBuilder',
    fileUrl: '',
    tags: ['cabin', 'rustic', 'wood', 'cottage'],
    public: true,
  },
  {
    type: 'build' as const,
    title: 'Warehouse',
    description: 'Industrial warehouse with loading docks and storage areas.',
    authorId: 'mock_user_8',
    authorName: 'IndustrialPro',
    fileUrl: '',
    tags: ['warehouse', 'industrial', 'commercial', 'storage'],
    public: true,
  },
  {
    type: 'build' as const,
    title: 'Town Square',
    description: 'Public square with fountain, benches, and surrounding shops.',
    authorId: 'mock_user_1',
    authorName: 'BuilderMaster',
    fileUrl: '',
    tags: ['square', 'public', 'community', 'town'],
    public: true,
  },
  {
    type: 'build' as const,
    title: 'Japanese Temple',
    description: 'Traditional Japanese temple with curved roof and serene gardens.',
    authorId: 'mock_user_9',
    authorName: 'ZenBuilder',
    fileUrl: '',
    tags: ['temple', 'japanese', 'traditional', 'cultural'],
    public: true,
  },
  {
    type: 'build' as const,
    title: 'Hospital',
    description: 'Modern hospital building with emergency entrance and helipad.',
    authorId: 'mock_user_10',
    authorName: 'PublicBuilds',
    fileUrl: '',
    tags: ['hospital', 'medical', 'public', 'building'],
    public: true,
  },
];

// Mock avatars data
const mockAvatars = [
  {
    type: 'avatar' as const,
    title: 'Knight Avatar',
    description: 'Medieval knight with armor, sword, and shield.',
    authorId: 'mock_user_11',
    authorName: 'AvatarCreator1',
    fileUrl: '', // Will be set after creation
    tags: ['knight', 'medieval', 'warrior', 'armor'],
    public: true,
  },
  {
    type: 'avatar' as const,
    title: 'Robot Avatar',
    description: 'Futuristic robot with metallic finish and LED eyes.',
    authorId: 'mock_user_12',
    authorName: 'TechAvatars',
    fileUrl: '',
    tags: ['robot', 'futuristic', 'mech', 'tech'],
    public: true,
  },
  {
    type: 'avatar' as const,
    title: 'Ninja Avatar',
    description: 'Stealthy ninja with dark outfit and mask.',
    authorId: 'mock_user_13',
    authorName: 'ShadowMakers',
    fileUrl: '',
    tags: ['ninja', 'stealth', 'warrior', 'assassin'],
    public: true,
  },
  {
    type: 'avatar' as const,
    title: 'Wizard Avatar',
    description: 'Powerful wizard with robes, staff, and magical accessories.',
    authorId: 'mock_user_14',
    authorName: 'MagicDesign',
    fileUrl: '',
    tags: ['wizard', 'magic', 'fantasy', 'mage'],
    public: true,
  },
  {
    type: 'avatar' as const,
    title: 'Pirate Avatar',
    description: 'Swashbuckling pirate with hat, eyepatch, and hook.',
    authorId: 'mock_user_15',
    authorName: 'SeaCreators',
    fileUrl: '',
    tags: ['pirate', 'sea', 'adventure', 'treasure'],
    public: true,
  },
  {
    type: 'avatar' as const,
    title: 'Astronaut Avatar',
    description: 'Space explorer in a detailed spacesuit with helmet.',
    authorId: 'mock_user_16',
    authorName: 'SpaceAvatars',
    fileUrl: '',
    tags: ['astronaut', 'space', 'sci-fi', 'explorer'],
    public: true,
  },
  {
    type: 'avatar' as const,
    title: 'Samurai Avatar',
    description: 'Honorable samurai with traditional armor and katana.',
    authorId: 'mock_user_17',
    authorName: 'WarriorMakers',
    fileUrl: '',
    tags: ['samurai', 'japanese', 'warrior', 'traditional'],
    public: true,
  },
  {
    type: 'avatar' as const,
    title: 'Cyborg Avatar',
    description: 'Human-robot hybrid with mechanical limbs and enhancements.',
    authorId: 'mock_user_18',
    authorName: 'CyberDesign',
    fileUrl: '',
    tags: ['cyborg', 'cyberpunk', 'tech', 'enhanced'],
    public: true,
  },
  {
    type: 'avatar' as const,
    title: 'Elf Avatar',
    description: 'Mystical elf with pointed ears, elegant robes, and bow.',
    authorId: 'mock_user_19',
    authorName: 'FantasyBuilders',
    fileUrl: '',
    tags: ['elf', 'fantasy', 'magical', 'nature'],
    public: true,
  },
  {
    type: 'avatar' as const,
    title: 'Viking Avatar',
    description: 'Fierce viking warrior with helmet, beard, and battle axe.',
    authorId: 'mock_user_20',
    authorName: 'NordicCreators',
    fileUrl: '',
    tags: ['viking', 'warrior', 'nordic', 'battle'],
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

    console.log('Seeding marketplace with mock builds and avatars...');

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

    // Combine all mock items
    const allMockItems = [...mockBuilds, ...mockAvatars];

    for (const mockItem of allMockItems) {
      // Create item first to get the ID
      const item = await storage.createItem(mockItem);
      console.log(`✓ Created: ${item.title} (${item.type})`);

      // Set fileUrl based on item type
      const fileUrl = item.type === 'build'
        ? `/api/marketplace/${item.id}/build`
        : `/api/marketplace/${item.id}/avatar`;

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

      // Simulate some players online only for builds (mock users playing)
      if (item.type === 'build') {
        const playersOnline = Math.floor(Math.random() * 20); // 0-19 players
        if (playersOnline > 0 && trackerToUse) {
          // Create mock user IDs and join them to the build
          for (let i = 0; i < playersOnline; i++) {
            const mockUserId = `mock_player_${item.id}_${i}`;
            trackerToUse.joinGame(item.id, mockUserId);
          }
          console.log(`  → ${playersOnline} mock players online`);
        }
      }
    }

    // Cleanup database pool if created
    if (dbPool) {
      await dbPool.end();
    }

    console.log(`✓ Successfully seeded ${mockBuilds.length} mock builds and ${mockAvatars.length} mock avatars!`);
  } catch (error) {
    console.error('Error seeding marketplace:', error);
    throw error;
  }
}

// Run if called directly (not imported)
if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/') || '')) {
  void seedMarketplace()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}
