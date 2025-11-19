import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AntiP2WCompliance } from '../src/AntiP2WCompliance';
import { GameMode, ItemCategory, type ItemDefinition } from '../src/types';

describe('AntiP2WCompliance', () => {
  let compliance: AntiP2WCompliance;

  beforeEach(() => {
    compliance = new AntiP2WCompliance();
  });

  afterEach(() => {
    compliance.dispose();
  });

  describe('Game Registration', () => {
    it('should register game', () => {
      compliance.registerGame('game1', GameMode.CASUAL, 'creator1');
      const game = compliance.getGame('game1');
      expect(game).toBeTruthy();
      expect(game?.gameMode).toBe(GameMode.CASUAL);
      expect(game?.creatorId).toBe('creator1');
      expect(game?.verifiedFair).toBe(false);
    });

    it('should throw error for duplicate game', () => {
      compliance.registerGame('game1', GameMode.CASUAL, 'creator1');
      expect(() => {
        compliance.registerGame('game1', GameMode.COMPETITIVE, 'creator2');
      }).toThrow('already registered');
    });

    it('should get all registered games', () => {
      compliance.registerGame('game1', GameMode.CASUAL, 'creator1');
      compliance.registerGame('game2', GameMode.COMPETITIVE, 'creator2');
      
      const games = compliance.getAllGames();
      expect(games.length).toBe(2);
    });
  });

  describe('Verification', () => {
    it('should verify game', () => {
      compliance.registerGame('game1', GameMode.CASUAL, 'creator1');
      compliance.verifyGame('game1');
      
      expect(compliance.isVerifiedFair('game1')).toBe(true);
    });

    it('should revoke verification', () => {
      compliance.registerGame('game1', GameMode.CASUAL, 'creator1');
      compliance.verifyGame('game1');
      compliance.revokeVerification('game1');
      
      expect(compliance.isVerifiedFair('game1')).toBe(false);
    });

    it('should throw error when verifying non-existent game', () => {
      expect(() => {
        compliance.verifyGame('nonexistent');
      }).toThrow('not registered');
    });
  });

  describe('Item Compliance - Cosmetic Items', () => {
    beforeEach(() => {
      compliance.registerGame('casual1', GameMode.CASUAL, 'creator1');
      compliance.registerGame('comp1', GameMode.COMPETITIVE, 'creator2');
    });

    it('should allow cosmetic items in casual games', () => {
      const item: ItemDefinition = {
        itemId: 'skin1',
        category: ItemCategory.COSMETIC,
        name: 'Cool Skin',
      };

      const result = compliance.checkItemCompliance('casual1', item);
      expect(result.allowed).toBe(true);
    });

    it('should allow cosmetic items in competitive games', () => {
      const item: ItemDefinition = {
        itemId: 'skin1',
        category: ItemCategory.COSMETIC,
        name: 'Cool Skin',
      };

      const result = compliance.checkItemCompliance('comp1', item);
      expect(result.allowed).toBe(true);
    });
  });

  describe('Item Compliance - Progression Boosts', () => {
    beforeEach(() => {
      compliance.registerGame('casual1', GameMode.CASUAL, 'creator1');
      compliance.registerGame('comp1', GameMode.COMPETITIVE, 'creator2');
    });

    it('should allow progression boost in casual games', () => {
      const item: ItemDefinition = {
        itemId: 'boost1',
        category: ItemCategory.PROGRESSION_BOOST,
        name: 'XP Boost',
      };

      const result = compliance.checkItemCompliance('casual1', item);
      expect(result.allowed).toBe(true);
    });

    it('should reject progression boost in competitive games', () => {
      const item: ItemDefinition = {
        itemId: 'boost1',
        category: ItemCategory.PROGRESSION_BOOST,
        name: 'XP Boost',
      };

      const result = compliance.checkItemCompliance('comp1', item);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Competitive games only allow cosmetic');
    });

    it('should reject progression boost affecting competitive stats', () => {
      const item: ItemDefinition = {
        itemId: 'boost1',
        category: ItemCategory.PROGRESSION_BOOST,
        name: 'DPS Boost',
        affectsStats: {
          affectsDPS: true,
        },
      };

      const result = compliance.checkItemCompliance('casual1', item);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('DPS');
    });

    it('should warn for progression boost in casual games', () => {
      const item: ItemDefinition = {
        itemId: 'boost1',
        category: ItemCategory.PROGRESSION_BOOST,
        name: 'XP Boost',
      };

      const result = compliance.checkItemCompliance('casual1', item);
      expect(result.allowed).toBe(true);
      expect(result.warning).toBeTruthy();
    });
  });

  describe('Item Compliance - Competitive Advantage', () => {
    beforeEach(() => {
      compliance.registerGame('casual1', GameMode.CASUAL, 'creator1');
      compliance.registerGame('comp1', GameMode.COMPETITIVE, 'creator2');
    });

    it('should reject competitive advantage items in all games', () => {
      const item: ItemDefinition = {
        itemId: 'weapon1',
        category: ItemCategory.COMPETITIVE_ADVANTAGE,
        name: 'OP Weapon',
      };

      const casualResult = compliance.checkItemCompliance('casual1', item);
      const compResult = compliance.checkItemCompliance('comp1', item);

      expect(casualResult.allowed).toBe(false);
      expect(compResult.allowed).toBe(false);
      expect(casualResult.reason).toContain('forbidden');
    });
  });

  describe('Unregistered Game', () => {
    it('should reject items for unregistered game', () => {
      const item: ItemDefinition = {
        itemId: 'item1',
        category: ItemCategory.COSMETIC,
        name: 'Item',
      };

      const result = compliance.checkItemCompliance('nonexistent', item);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not registered');
    });
  });

  describe('Dispose', () => {
    it('should dispose compliance system', () => {
      compliance.registerGame('game1', GameMode.CASUAL, 'creator1');
      compliance.dispose();
      
      expect(compliance.isDisposed()).toBe(true);
    });

    it('should throw when accessing games after dispose', () => {
      compliance.registerGame('game1', GameMode.CASUAL, 'creator1');
      compliance.dispose();
      
      expect(() => compliance.getAllGames()).toThrow('disposed');
    });
  });
});
