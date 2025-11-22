import type { ResaleListing } from '../storage/ResaleStorage.js';

/**
 * Resale Storage - manages secondary resale listings for marketplace items
 */

import { PrismaClient } from '@engine/database';
import type { Decimal } from '@prisma/client/runtime/library';
import type { CurrencyAmount } from '@engine/economy';

export type { ResaleListing };

export class ResaleStorage {
  constructor(private readonly prisma: PrismaClient) {}

  async initialize(): Promise<void> {
    // Schema is managed by Prisma migrations
    // No additional initialization needed
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
    const listing = await this.prisma.marketplaceResaleListing.upsert({
      where: {
        marketplaceId_sellerId: {
          marketplaceId,
          sellerId,
        },
      },
      create: {
        marketplaceId,
        sellerId,
        priceCurrency: price.currency,
        priceAmount: price.amount,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      update: {
        priceCurrency: price.currency,
        priceAmount: price.amount,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    return this.mapPrismaToListing(listing);
  }

  /**
   * Get a specific listing by marketplaceId and sellerId
   */
  async getListing(marketplaceId: string, sellerId: string): Promise<ResaleListing | null> {
    const listing = await this.prisma.marketplaceResaleListing.findUnique({
      where: {
        marketplaceId_sellerId: {
          marketplaceId,
          sellerId,
        },
      },
    });

    if (!listing) {
      return null;
    }

    // Check if expired
    if (listing.expiresAt && listing.expiresAt < new Date()) {
      return null;
    }

    return this.mapPrismaToListing(listing);
  }

  /**
   * Get all listings for a marketplace item
   */
  async getListings(marketplaceId: string): Promise<ResaleListing[]> {
    const listings = await this.prisma.marketplaceResaleListing.findMany({
      where: {
        marketplaceId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return listings.map((listing: {
      id: string;
      marketplaceId: string;
      sellerId: string;
      priceCurrency: string;
      priceAmount: Decimal | number | null;
      createdAt: Date;
      expiresAt: Date | null;
    }) => this.mapPrismaToListing(listing));
  }

  /**
   * Delete a listing
   */
  async deleteListing(marketplaceId: string, sellerId: string): Promise<boolean> {
    try {
      const result = await this.prisma.marketplaceResaleListing.deleteMany({
        where: {
          marketplaceId,
          sellerId,
        },
      });
      return result.count > 0;
    } catch {
      return false;
    }
  }

  /**
   * Delete all listings for a marketplace item
   */
  async deleteListings(marketplaceId: string): Promise<number> {
    const result = await this.prisma.marketplaceResaleListing.deleteMany({
      where: {
        marketplaceId,
      },
    });
    return result.count;
  }

  /**
   * Cleanup expired listings
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.prisma.marketplaceResaleListing.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    return result.count;
  }

  /**
   * Maps Prisma MarketplaceResaleListing to ResaleListing interface
   */
  private mapPrismaToListing(listing: {
    id: string;
    marketplaceId: string;
    sellerId: string;
    priceCurrency: string;
    priceAmount: Decimal | number | null;
    createdAt: Date;
    expiresAt: Date | null;
  }): ResaleListing {
    const mapped: ResaleListing = {
      id: listing.id,
      marketplaceId: listing.marketplaceId,
      sellerId: listing.sellerId,
      price: {
        currency: listing.priceCurrency,
        amount: Number(listing.priceAmount),
      },
      createdAt: listing.createdAt.getTime(),
    };

    if (listing.expiresAt) {
      mapped.expiresAt = listing.expiresAt.getTime();
    }

    return mapped;
  }
}
