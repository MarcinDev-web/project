import { beforeAll, describe, expect, it } from 'vitest';
import {
  app,
  authManager,
  marketplaceStorage,
  studioProjectsStorage,
  gameSessionTracker,
} from '../../server.js';
import {
  createTestUser,
  createTestBuild,
  createTestMarketplaceItem,
} from '../helpers/testHelpers.js';

interface CreatedGame {
  userId: string;
  projectId: string;
  itemId: string;
  playerIds: string[];
}

describe('GET /api/games', () => {
  beforeAll(async () => {
    await app.ready();
  });

  it('backfills missing marketplace linkage and returns published games', async () => {
    const { userId, email } = await createTestUser(authManager);

    const projectData = createTestBuild(`project_${Date.now()}`, 'Backfill Game');
    // Ensure metadata lacks marketplace reference so the route has to backfill it
    delete (projectData.metadata as { marketplaceItemId?: string }).marketplaceItemId;

    const project = await studioProjectsStorage.createProject(userId, {
      name: 'Backfill Game',
      description: 'Test project for backfill',
      projectData,
      tags: ['action'],
    });

    await studioProjectsStorage.updateProject(userId, project.id, {
      isPublished: true,
      projectData,
    });

    const marketplaceItem = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: userId,
      authorName: email,
      type: 'build',
      title: 'Backfill Game',
      tags: ['action'],
    });

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/games',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as { items: Array<{ id: string; projectId: string }> };

      const match = body.items.find((item) => item.id === marketplaceItem.id);
      expect(match, 'expected the backfilled marketplace item to appear in games feed').toBeTruthy();
      expect(match?.projectId).toBe(project.id);

      const updatedProject = await studioProjectsStorage.getProject(userId, project.id);
      expect(updatedProject?.projectData.metadata?.marketplaceItemId).toBe(marketplaceItem.id);
    } finally {
      await marketplaceStorage.deleteItem(marketplaceItem.id, userId);
      await studioProjectsStorage.deleteProject(userId, project.id);
    }
  });

  it('sorts games by trending signal (players first, then momentum)', async () => {
    const { userId } = await createTestUser(authManager);

    const createdGames: CreatedGame[] = [];

    async function createPublishedGame(options: {
      name: string;
      downloads?: number;
      likes?: number;
      playersOnline?: number;
    }): Promise<CreatedGame> {
      const projectData = createTestBuild(`${options.name}_${Date.now()}`, options.name);
      delete (projectData.metadata as { marketplaceItemId?: string }).marketplaceItemId;

      const project = await studioProjectsStorage.createProject(userId, {
        name: options.name,
        description: `${options.name} description`,
        projectData,
        tags: ['trending'],
      });

      await studioProjectsStorage.updateProject(userId, project.id, {
        isPublished: true,
        projectData,
      });

      const item = await createTestMarketplaceItem(marketplaceStorage, {
        authorId: userId,
        type: 'build',
        title: options.name,
        tags: ['trending'],
      });

      if (options.downloads !== undefined || options.likes !== undefined) {
        await marketplaceStorage.updateItem(item.id, {
          downloads: options.downloads ?? 0,
          likes: options.likes ?? 0,
        });
      }

      const playerIds: string[] = [];
      const players = options.playersOnline ?? 0;
      for (let i = 0; i < players; i++) {
        const playerId = `${item.id}_player_${i}_${Date.now()}`;
        playerIds.push(playerId);
        gameSessionTracker.joinGame(item.id, playerId);
      }

      const created: CreatedGame = {
        userId,
        projectId: project.id,
        itemId: item.id,
        playerIds,
      };
      createdGames.push(created);
      return created;
    }

    try {
      const lowPlayers = await createPublishedGame({
        name: 'Low Players',
        downloads: 50,
        likes: 25,
        playersOnline: 2,
      });

      const highPlayersLowMomentum = await createPublishedGame({
        name: 'High Players Low Momentum',
        downloads: 5,
        likes: 2,
        playersOnline: 5,
      });

      const highPlayersHighMomentum = await createPublishedGame({
        name: 'High Players High Momentum',
        downloads: 40,
        likes: 20,
        playersOnline: 5,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/games',
        query: { sortBy: 'trending' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as { items: Array<{ id: string }> };

      const orderedSubset = body.items
        .filter((item) =>
          [
            lowPlayers.itemId,
            highPlayersLowMomentum.itemId,
            highPlayersHighMomentum.itemId,
          ].includes(item.id)
        )
        .map((item) => item.id);

      expect(orderedSubset).toEqual([
        highPlayersHighMomentum.itemId,
        highPlayersLowMomentum.itemId,
        lowPlayers.itemId,
      ]);
    } finally {
      for (const created of createdGames) {
        for (const playerId of created.playerIds) {
          gameSessionTracker.leaveGame(created.itemId, playerId);
        }
        await marketplaceStorage.deleteItem(created.itemId, created.userId);
        await studioProjectsStorage.deleteProject(created.userId, created.projectId);
      }
    }
  });
});
