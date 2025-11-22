/**
 * Redis Resale Storage - manages secondary resale listings using Redis
 */

import { redis, getResaleKey } from '../lib/redis.js';
import type { CurrencyAmount } from '@engine/economy';

export interface ResaleListing {
  id: string; // composite key: `${marketplaceId}:${sellerId}`
  marketplaceId: string;
  sellerId: string;
  price: CurrencyAmount;
  createdAt: number;
  expiresAt?: number;
}

export class RedisResaleStorage {
  
  async initialize(): Promise<void> {
    // No initialization needed for Redis
  }

  /**
   * Create or update a resale listing
   */
  async createListing(
    marketplaceId: string,
    sellerId: string,
    price: CurrencyAmount,
    expiresAt?: number
  ): Promise<ResaleListing> {
    const key = getResaleKey(marketplaceId);
    const listing: ResaleListing = {
      id: `${marketplaceId}:${sellerId}`,
      marketplaceId,
      sellerId,
      price,
      createdAt: Date.now(),
      ...(expiresAt && { expiresAt }),
    };

    // Store in a Hash map for the item: field=sellerId, value=JSON(listing)
    await redis.hset(key, sellerId, JSON.stringify(listing));
    
    // If expiresAt is set, we might want to set a TTL on the key?
    // Problem: A hash key can have multiple listings (sellers). 
    // TTL on the whole key deletes all listings.
    // For MVP, we won't use Redis TTL for individual hash fields (not supported natively).
    // We'll filter expired items on read or use a separate sorted set for expiration if needed.
    // For now, assuming manual cleanup or application-level check.

    return listing;
  }

  /**
   * Get a specific listing by marketplaceId and sellerId
   */
  async getListing(marketplaceId: string, sellerId: string): Promise<ResaleListing | null> {
    const key = getResaleKey(marketplaceId);
    const data = await redis.hget(key, sellerId);
    
    if (!data) return null;

    const listing = JSON.parse(data) as ResaleListing;

    // Check expiration
    if (listing.expiresAt && listing.expiresAt < Date.now()) {
      // Lazily delete expired
      await this.deleteListing(marketplaceId, sellerId);
      return null;
    }

    return listing;
  }

  /**
   * Get all listings for a marketplace item
   */
  async getListings(marketplaceId: string): Promise<ResaleListing[]> {
    const key = getResaleKey(marketplaceId);
    const data = await redis.hgetall(key);
    
    const listings: ResaleListing[] = [];
    const now = Date.now();

    for (const [sellerId, json] of Object.entries(data)) {
        try {
            const listing = JSON.parse(json) as ResaleListing;
            if (listing.expiresAt && listing.expiresAt < now) {
                // Lazily delete
                await this.deleteListing(marketplaceId, sellerId);
            } else {
                listings.push(listing);
            }
        } catch (e) {
            console.error(`Failed to parse listing for ${marketplaceId}:${sellerId}`, e);
        }
    }

    return listings.sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * Delete a listing
   */
  async deleteListing(marketplaceId: string, sellerId: string): Promise<boolean> {
    const key = getResaleKey(marketplaceId);
    const result = await redis.hdel(key, sellerId);
    return result > 0;
  }

  /**
   * Delete all listings for a marketplace item
   */
  async deleteListings(marketplaceId: string): Promise<number> {
    const key = getResaleKey(marketplaceId);
    const result = await redis.del(key);
    return result; // Returns 1 if key existed, 0 otherwise
  }
}

