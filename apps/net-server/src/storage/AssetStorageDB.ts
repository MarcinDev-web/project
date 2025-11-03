/**
 * Asset Storage DB - PostgreSQL implementation using Prisma
 */

// @ts-expect-error - Prisma client is generated at build time
import type { PrismaClient as PrismaClientType } from '../../node_modules/.prisma/net-client';
// @ts-expect-error - Prisma client is generated at build time
import { Prisma } from '../../node_modules/.prisma/net-client';
import type { Asset, AssetFilter, AssetMetadata } from './AssetStorage';

export class AssetStorageDB {
  constructor(private readonly prisma: PrismaClientType) {}

  async initialize(): Promise<void> {
    // Schema is managed by Prisma migrations
    // No additional initialization needed
  }

  async createAsset(asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>): Promise<Asset> {
    const id = `asset_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const created = await this.prisma.shopAsset.create({
      data: {
        id,
        name: asset.name,
        description: asset.description ?? null,
        type: asset.type,
        category: asset.category ?? null,
        priceCurrency: asset.price.currency,
        priceAmount: asset.price.amount,
        previewUrl: asset.previewUrl ?? null,
        fileUrl: asset.fileUrl,
        metadata: asset.metadata as Prisma.InputJsonValue,
        authorId: asset.authorId,
        available: asset.available,
      },
    });

    return this.mapPrismaToAsset(created);
  }

  async getAsset(id: string): Promise<Asset | null> {
    const asset = await this.prisma.shopAsset.findUnique({
      where: { id },
    });

    if (!asset) {
      return null;
    }

    return this.mapPrismaToAsset(asset);
  }

  async getAssets(filter: AssetFilter = {}): Promise<Asset[]> {
    const where: Prisma.ShopAssetWhereInput = {};

    if (filter.type) {
      where.type = filter.type;
    }

    if (filter.category) {
      where.category = filter.category;
    }

    if (filter.authorId) {
      where.authorId = filter.authorId;
    }

    if (filter.available !== undefined) {
      where.available = filter.available;
    } else {
      where.available = true;
    }

    if (filter.search) {
      const searchTerm = filter.search.toLowerCase();
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    const assets = await this.prisma.shopAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return assets.map((asset) => this.mapPrismaToAsset(asset));
  }

  async updateAsset(id: string, updates: Partial<Omit<Asset, 'id' | 'createdAt'>>): Promise<Asset | null> {
    const updateData: Prisma.ShopAssetUpdateInput = {};

    if (updates.name !== undefined) {
      updateData.name = updates.name;
    }

    if (updates.description !== undefined) {
      updateData.description = updates.description ?? null;
    }

    if (updates.type !== undefined) {
      updateData.type = updates.type;
    }

    if (updates.category !== undefined) {
      updateData.category = updates.category ?? null;
    }

    if (updates.price !== undefined) {
      updateData.priceCurrency = updates.price.currency;
      updateData.priceAmount = updates.price.amount;
    }

    if (updates.previewUrl !== undefined) {
      updateData.previewUrl = updates.previewUrl ?? null;
    }

    if (updates.fileUrl !== undefined) {
      updateData.fileUrl = updates.fileUrl;
    }

    if (updates.metadata !== undefined) {
      updateData.metadata = updates.metadata as Prisma.InputJsonValue;
    }

    if (updates.available !== undefined) {
      updateData.available = updates.available;
    }

    // updatedAt is handled automatically by Prisma @updatedAt

    if (Object.keys(updateData).length === 0) {
      return this.getAsset(id);
    }

    try {
      const updated = await this.prisma.shopAsset.update({
        where: { id },
        data: updateData,
      });

      return this.mapPrismaToAsset(updated);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null;
      }
      throw error;
    }
  }

  async deleteAsset(id: string): Promise<boolean> {
    try {
      await this.prisma.shopAsset.delete({
        where: { id },
      });
      return true;
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return false;
      }
      throw error;
    }
  }

  async getAssetsCount(filter: AssetFilter = {}): Promise<number> {
    const where: Prisma.ShopAssetWhereInput = {};

    if (filter.type) {
      where.type = filter.type;
    }

    if (filter.category) {
      where.category = filter.category;
    }

    if (filter.authorId) {
      where.authorId = filter.authorId;
    }

    if (filter.available !== undefined) {
      where.available = filter.available;
    } else {
      where.available = true;
    }

    if (filter.search) {
      const searchTerm = filter.search.toLowerCase();
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    return this.prisma.shopAsset.count({ where });
  }

  private mapPrismaToAsset(item: {
    id: string;
    name: string;
    description: string | null;
    type: string;
    category: string | null;
    priceCurrency: string;
    priceAmount: Prisma.Decimal;
    previewUrl: string | null;
    fileUrl: string;
    metadata: Prisma.JsonValue;
    authorId: string;
    available: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Asset {
    const metadata = item.metadata as AssetMetadata;
    const asset: Asset = {
      id: item.id,
      name: item.name,
      type: item.type as Asset['type'],
      price: {
        currency: item.priceCurrency,
        amount: Number(item.priceAmount),
      },
      fileUrl: item.fileUrl,
      metadata,
      authorId: item.authorId,
      available: item.available,
      createdAt: item.createdAt.getTime(),
      updatedAt: item.updatedAt.getTime(),
    };
    if (item.description) asset.description = item.description;
    if (item.category) asset.category = item.category;
    if (item.previewUrl) asset.previewUrl = item.previewUrl;
    return asset;
  }
}
