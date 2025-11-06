/**
 * Purchase Storage DB - PostgreSQL implementation using Prisma
 */

import type { PrismaClient as PrismaClientType } from '../../node_modules/.prisma/net-client/index.js';
import { Prisma } from '../../node_modules/.prisma/net-client/index.js';
import type { Purchase, PurchaseFilter, PurchaseItemType, PurchaseStatus } from './PurchaseStorage.js';

export class PurchaseStorageDB {
  constructor(private readonly prisma: PrismaClientType) {}

  async initialize(): Promise<void> {
    // Schema is managed by Prisma migrations
    // No additional initialization needed
  }

  async createPurchase(purchase: Omit<Purchase, 'id' | 'createdAt'>): Promise<Purchase> {
    const id = `purchase_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = new Date();

    return this.prisma.$transaction(
      async (tx: Parameters<Parameters<PrismaClientType['$transaction']>[0]>[0]) => {
        // Insert purchase
        await tx.purchase.create({
          data: {
            id,
            userId: purchase.userId,
            totalCurrency: purchase.totalCost.currency,
            totalAmount: purchase.totalCost.amount,
            status: purchase.status,
            items: {
              create: purchase.items.map((item: Purchase['items'][0]) => ({
                itemId: item.itemId,
                itemType: item.type,
                name: item.name,
                priceCurrency: item.price.currency,
                priceAmount: item.price.amount,
              })),
            },
          },
        });

        // Update owned items (upsert to handle conflicts)
        for (const item of purchase.items) {
          await tx.userOwnedItem.upsert({
            where: {
              userId_itemId_itemType: {
                userId: purchase.userId,
                itemId: item.itemId,
                itemType: item.type,
              },
            },
            update: {},
            create: {
              userId: purchase.userId,
              itemId: item.itemId,
              itemType: item.type,
              purchasedAt: now,
            },
          });
        }

        return {
          ...purchase,
          id,
          createdAt: now.getTime(),
        };
      }
    );
  }

  async getPurchase(id: string): Promise<Purchase | null> {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!purchase) {
      return null;
    }

    return this.mapPrismaToPurchase(purchase);
  }

  async getPurchases(filter: PurchaseFilter = {}): Promise<Purchase[]> {
    const where: Prisma.PurchaseWhereInput = {};

    if (filter.userId) {
      where.userId = filter.userId;
    }

    if (filter.status) {
      where.status = filter.status;
    }

    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    const purchases = await this.prisma.purchase.findMany({
      where,
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return purchases.map((p: Parameters<typeof this.mapPrismaToPurchase>[0]) =>
      this.mapPrismaToPurchase(p)
    );
  }

  async updatePurchaseStatus(id: string, status: PurchaseStatus): Promise<Purchase | null> {
    try {
      const updated = await this.prisma.purchase.update({
        where: { id },
        data: { status },
        include: {
          items: true,
        },
      });

      return this.mapPrismaToPurchase(updated);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          return null;
        }
      }
      throw error;
    }
  }

  async isOwned(userId: string, itemId: string, itemType: PurchaseItemType): Promise<boolean> {
    const count = await this.prisma.userOwnedItem.count({
      where: {
        userId,
        itemId,
        itemType,
      },
    });

    return count > 0;
  }

  async getOwnedItems(
    userId: string
  ): Promise<Array<{ itemId: string; itemType: PurchaseItemType; purchasedAt: number }>> {
    const owned = await this.prisma.userOwnedItem.findMany({
      where: { userId },
      select: {
        itemId: true,
        itemType: true,
        purchasedAt: true,
      },
    });

    return owned.map((item: { itemId: string; itemType: string; purchasedAt: Date }) => ({
      itemId: item.itemId,
      itemType: item.itemType as PurchaseItemType,
      purchasedAt: item.purchasedAt.getTime(),
    }));
  }

  /**
   * Transfer ownership of an item from one user to another (secondary sale).
   * Uses a transaction to ensure atomicity.
   */
  async transferOwnership(
    itemId: string,
    itemType: PurchaseItemType,
    fromUserId: string,
    toUserId: string
  ): Promise<boolean> {
    return this.prisma.$transaction(
      async (tx: Parameters<Parameters<PrismaClientType['$transaction']>[0]>[0]) => {
        // Verify source owns the item
        const count = await tx.userOwnedItem.count({
          where: {
            userId: fromUserId,
            itemId,
            itemType,
          },
        });

        if (count === 0) {
          return false;
        }

        // Remove from seller
        await tx.userOwnedItem.delete({
          where: {
            userId_itemId_itemType: {
              userId: fromUserId,
              itemId,
              itemType,
            },
          },
        });

        // Add to buyer (upsert to handle conflicts)
        await tx.userOwnedItem.upsert({
          where: {
            userId_itemId_itemType: {
              userId: toUserId,
              itemId,
              itemType,
            },
          },
          update: {},
          create: {
            userId: toUserId,
            itemId,
            itemType,
            purchasedAt: new Date(),
          },
        });

        return true;
      }
    );
  }

  private mapPrismaToPurchase(purchase: {
    id: string;
    userId: string;
    totalCurrency: string;
    totalAmount: Prisma.Decimal;
    status: string;
    createdAt: Date;
    items: Array<{
      itemId: string;
      itemType: string;
      name: string;
      priceCurrency: string;
      priceAmount: Prisma.Decimal;
    }>;
  }): Purchase {
    return {
      id: purchase.id,
      userId: purchase.userId,
      items: purchase.items.map(
        (item: {
          itemId: string;
          itemType: string;
          name: string;
          priceCurrency: string;
          priceAmount: Prisma.Decimal;
        }) => ({
          itemId: item.itemId,
          type: item.itemType as PurchaseItemType,
          name: item.name,
          price: {
            currency: item.priceCurrency,
            amount: Number(item.priceAmount),
          },
        })
      ),
      totalCost: {
        currency: purchase.totalCurrency,
        amount: Number(purchase.totalAmount),
      },
      status: purchase.status as PurchaseStatus,
      createdAt: purchase.createdAt.getTime(),
    };
  }
}


