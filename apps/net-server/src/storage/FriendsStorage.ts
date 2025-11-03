/**
 * Friends Storage - manages friend relationships and requests
 */

import { promises as fs } from 'fs';
import path from 'path';

export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
}

export interface FriendRelation {
  userId1: string;
  userId2: string;
  since: number;
}

export class FriendsStorage {
  private readonly dataDir: string;
  private readonly requestsFile: string;
  private readonly relationsFile: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.requestsFile = path.join(dataDir, 'friend_requests.json');
    this.relationsFile = path.join(dataDir, 'friends.json');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });

    try {
      await fs.access(this.requestsFile);
    } catch {
      await fs.writeFile(this.requestsFile, JSON.stringify([], null, 2));
    }

    try {
      await fs.access(this.relationsFile);
    } catch {
      await fs.writeFile(this.relationsFile, JSON.stringify([], null, 2));
    }
  }

  private async readRequests(): Promise<FriendRequest[]> {
    try {
      const data = await fs.readFile(this.requestsFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private async writeRequests(requests: FriendRequest[]): Promise<void> {
    await fs.writeFile(this.requestsFile, JSON.stringify(requests, null, 2));
  }

  private async readRelations(): Promise<FriendRelation[]> {
    try {
      const data = await fs.readFile(this.relationsFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private async writeRelations(relations: FriendRelation[]): Promise<void> {
    await fs.writeFile(this.relationsFile, JSON.stringify(relations, null, 2));
  }

  async createRequest(fromUserId: string, toUserId: string): Promise<FriendRequest> {
    if (fromUserId === toUserId) {
      throw new Error('Cannot send friend request to yourself');
    }

    const requests = await this.readRequests();

    // Check if request already exists
    const existing = requests.find(
      (r) => r.fromUserId === fromUserId && r.toUserId === toUserId && r.status === 'pending'
    );

    if (existing) {
      throw new Error('Friend request already sent');
    }

    // Check if already friends
    const relations = await this.readRelations();
    const isFriend = relations.some(
      (r) =>
        (r.userId1 === fromUserId && r.userId2 === toUserId) ||
        (r.userId1 === toUserId && r.userId2 === fromUserId)
    );

    if (isFriend) {
      throw new Error('Already friends');
    }

    const request: FriendRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      fromUserId,
      toUserId,
      status: 'pending',
      createdAt: Date.now(),
    };

    requests.push(request);
    await this.writeRequests(requests);

    return request;
  }

  async getRequests(userId: string): Promise<FriendRequest[]> {
    const requests = await this.readRequests();
    return requests.filter((r) => r.fromUserId === userId || r.toUserId === userId);
  }

  async getPendingRequests(userId: string): Promise<FriendRequest[]> {
    const requests = await this.readRequests();
    return requests.filter((r) => r.toUserId === userId && r.status === 'pending');
  }

  async acceptRequest(requestId: string, userId: string): Promise<boolean> {
    const requests = await this.readRequests();
    const request = requests.find(
      (r) => r.id === requestId && r.toUserId === userId && r.status === 'pending'
    );

    if (!request) {
      return false;
    }

    request.status = 'accepted';
    await this.writeRequests(requests);

    // Create friend relation
    const relations = await this.readRelations();
    const relation: FriendRelation = {
      userId1: request.fromUserId,
      userId2: request.toUserId,
      since: Date.now(),
    };
    relations.push(relation);
    await this.writeRelations(relations);

    return true;
  }

  async declineRequest(requestId: string, userId: string): Promise<boolean> {
    const requests = await this.readRequests();
    const request = requests.find(
      (r) => r.id === requestId && r.toUserId === userId && r.status === 'pending'
    );

    if (!request) {
      return false;
    }

    request.status = 'declined';
    await this.writeRequests(requests);

    return true;
  }

  async getFriends(userId: string): Promise<string[]> {
    const relations = await this.readRelations();
    return relations
      .filter((r) => r.userId1 === userId || r.userId2 === userId)
      .map((r) => (r.userId1 === userId ? r.userId2 : r.userId1));
  }

  async removeFriend(userId1: string, userId2: string): Promise<boolean> {
    const relations = await this.readRelations();
    const index = relations.findIndex(
      (r) =>
        (r.userId1 === userId1 && r.userId2 === userId2) ||
        (r.userId1 === userId2 && r.userId2 === userId1)
    );

    if (index === -1) {
      return false;
    }

    relations.splice(index, 1);
    await this.writeRelations(relations);

    return true;
  }
}
