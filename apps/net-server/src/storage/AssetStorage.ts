/**
 * Asset Storage - manages editor assets (materials, models, textures, scripts)
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { CurrencyAmount } from '@engine/economy';

export interface AssetMetadata {
  version?: string;
  compatibility?: string[];
  tags?: string[];
  [key: string]: unknown;
}

export interface Asset {
  id: string;
  name: string;
  description?: string;
  type: 'material' | 'model' | 'texture' | 'script';
  category?: string;
  price: CurrencyAmount;
  previewUrl?: string;
  fileUrl: string;
  metadata: AssetMetadata;
  authorId: string;
  available: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AssetFilter {
  type?: Asset['type'];
  category?: string;
  authorId?: string;
  available?: boolean;
  limit?: number;
  offset?: number;
  search?: string;
}

export class AssetStorage {
  private readonly dataDir: string;
  private readonly assetsFile: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.assetsFile = path.join(dataDir, 'assets.json');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });

    try {
      await fs.access(this.assetsFile);
    } catch {
      await fs.writeFile(this.assetsFile, JSON.stringify({}, null, 2));
    }
  }

  private async readAssets(): Promise<Record<string, Asset>> {
    try {
      const data = await fs.readFile(this.assetsFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  private async writeAssets(assets: Record<string, Asset>): Promise<void> {
    await fs.writeFile(this.assetsFile, JSON.stringify(assets, null, 2));
  }

  async createAsset(asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>): Promise<Asset> {
    const assets = await this.readAssets();

    const id = `asset_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = Date.now();
    const newAsset: Asset = {
      ...asset,
      id,
      createdAt: now,
      updatedAt: now,
    };

    assets[id] = newAsset;
    await this.writeAssets(assets);

    return newAsset;
  }

  async getAsset(id: string): Promise<Asset | null> {
    const assets = await this.readAssets();
    return assets[id] ?? null;
  }

  async getAssets(filter: AssetFilter = {}): Promise<Asset[]> {
    const assets = await this.readAssets();
    let filtered = Object.values(assets);

    if (filter.type) {
      filtered = filtered.filter((asset) => asset.type === filter.type);
    }

    if (filter.category) {
      filtered = filtered.filter((asset) => asset.category === filter.category);
    }

    if (filter.authorId) {
      filtered = filtered.filter((asset) => asset.authorId === filter.authorId);
    }

    if (filter.available !== undefined) {
      filtered = filtered.filter((asset) => asset.available === filter.available);
    } else {
      // By default, only show available assets
      filtered = filtered.filter((asset) => asset.available);
    }

    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      filtered = filtered.filter(
        (asset) =>
          asset.name.toLowerCase().includes(searchLower) ||
          asset.description?.toLowerCase().includes(searchLower) ||
          asset.metadata.tags?.some((tag) => tag.toLowerCase().includes(searchLower))
      );
    }

    // Sort by createdAt (newest first)
    filtered.sort((a, b) => b.createdAt - a.createdAt);

    // Apply pagination
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 50;

    return filtered.slice(offset, offset + limit);
  }

  async updateAsset(
    id: string,
    updates: Partial<Omit<Asset, 'id' | 'createdAt'>>
  ): Promise<Asset | null> {
    const assets = await this.readAssets();
    const asset = assets[id];

    if (!asset) {
      return null;
    }

    const updatedAsset: Asset = {
      ...asset,
      ...updates,
      updatedAt: Date.now(),
    };

    assets[id] = updatedAsset;
    await this.writeAssets(assets);

    return updatedAsset;
  }

  async deleteAsset(id: string): Promise<boolean> {
    const assets = await this.readAssets();

    if (!assets[id]) {
      return false;
    }

    delete assets[id];
    await this.writeAssets(assets);

    return true;
  }

  async getAssetsCount(filter: AssetFilter = {}): Promise<number> {
    const countFilter: AssetFilter = { ...filter };
    // Remove limit and offset for count query
    delete countFilter.limit;
    delete countFilter.offset;
    const assets = await this.getAssets(countFilter);
    return assets.length;
  }
}
