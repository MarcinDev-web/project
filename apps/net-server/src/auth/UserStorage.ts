import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { User } from '../types/auth.js';

/**
 * JSON file-based storage for user accounts.
 * Stores users in a simple key-value format: { [email]: User }
 */
export class UserStorage {
  private readonly dataDir: string;
  private readonly dataFile: string;
  private storage: Map<string, User> = new Map();
  private idIndex: Map<string, string> = new Map(); // userId -> email lookup
  private usernameIndex: Map<string, string> = new Map(); // username -> email lookup
  private initialized = false;

  constructor(dataDir = './data') {
    this.dataDir = dataDir;
    this.dataFile = path.join(dataDir, 'users.json');
  }

  /**
   * Initialize storage - create data directory and load existing data.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Create data directory if it doesn't exist
    if (!existsSync(this.dataDir)) {
      await mkdir(this.dataDir, { recursive: true });
    }

    // Load existing data if file exists
    if (existsSync(this.dataFile)) {
      try {
        const data = await readFile(this.dataFile, 'utf-8');
        const parsed = JSON.parse(data) as Record<string, User>;
        this.storage = new Map(Object.entries(parsed));

        // Build ID index and username index, migrate roles
        let needsMigration = false;
        for (const [email, user] of this.storage.entries()) {
          this.idIndex.set(user.id, email);
          if (user.username) {
            this.usernameIndex.set(user.username.toLowerCase(), email);
          }
          // Migrate: set default role if missing
          if (!user.role) {
            user.role = 'user';
            this.storage.set(email, user);
            needsMigration = true;
          }
        }

        // Persist migrations if any
        if (needsMigration) {
          await this.persist();
        }
      } catch (error) {
        console.error('Failed to load users file:', error);
        this.storage = new Map();
        this.idIndex = new Map();
      }
    }

    this.initialized = true;
  }

  /**
   * Generate a unique user ID.
   */
  private generateUserId(): string {
    const bytes = randomBytes(16);
    return bytes.toString('hex');
  }

  /**
   * Save a user account.
   */
  async saveUser(email: string, username: string, passwordHash: string): Promise<User> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Check if email already exists
    if (this.storage.has(email.toLowerCase())) {
      throw new Error('User with this email already exists');
    }

    // Check if username already exists
    if (this.usernameIndex.has(username.toLowerCase())) {
      throw new Error('Username is already taken');
    }

    const now = Date.now();
    const user: User = {
      id: this.generateUserId(),
      email: email.toLowerCase(),
      username,
      passwordHash,
      createdAt: now,
      updatedAt: now,
      role: 'user', // Default role
      active: true, // Default active status
    };

    this.storage.set(user.email, user);
    this.idIndex.set(user.id, user.email);
    this.usernameIndex.set(username.toLowerCase(), user.email);
    await this.persist();

    return user;
  }

  /**
   * Find user by email.
   */
  async findUserByEmail(email: string): Promise<User | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.storage.get(email.toLowerCase()) ?? null;
  }

  /**
   * Find user by ID.
   */
  async findUserById(userId: string): Promise<User | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const email = this.idIndex.get(userId);
    if (!email) {
      return null;
    }

    return this.storage.get(email) ?? null;
  }

  /**
   * Update user data by email.
   */
  async updateUser(
    email: string,
    updates: Partial<Omit<User, 'id' | 'email' | 'createdAt'>>
  ): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const user = this.storage.get(email.toLowerCase());
    if (!user) {
      throw new Error('User not found');
    }

    const updated: User = {
      ...user,
      ...updates,
      updatedAt: Date.now(),
    };

    this.storage.set(email.toLowerCase(), updated);
    await this.persist();
  }

  /**
   * Update user data by ID.
   */
  async updateUserById(
    userId: string,
    updates: Partial<Omit<User, 'id' | 'email' | 'createdAt'>>
  ): Promise<User> {
    if (!this.initialized) {
      await this.initialize();
    }

    const email = this.idIndex.get(userId);
    if (!email) {
      throw new Error('User not found');
    }

    const user = this.storage.get(email);
    if (!user) {
      throw new Error('User not found');
    }

    const updated: User = {
      ...user,
      ...updates,
      updatedAt: Date.now(),
    };

    this.storage.set(email, updated);
    await this.persist();

    return updated;
  }

  /**
   * Get all users (for admin purposes).
   */
  async getAllUsers(): Promise<User[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    return Array.from(this.storage.values());
  }

  /**
   * Check if email is already registered.
   */
  async emailExists(email: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.storage.has(email.toLowerCase());
  }

  /**
   * Check if username is already taken.
   */
  async usernameExists(username: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.usernameIndex.has(username.toLowerCase());
  }

  /**
   * Persist storage to disk.
   */
  private async persist(): Promise<void> {
    const data = Object.fromEntries(this.storage.entries());
    const json = JSON.stringify(data, null, 2);
    await writeFile(this.dataFile, json, 'utf-8');
  }
}

