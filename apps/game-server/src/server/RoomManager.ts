import { Room } from '../simulation/Room';
import type { IDisposable } from '@engine/core';

export class RoomManager implements IDisposable {
  private rooms = new Map<string, Room>();

  constructor() {}

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  getTotalPlayerCount(): number {
    let count = 0;
    for (const room of this.rooms.values()) {
      count += room.getClientCount();
    }
    return count;
  }

  async createRoom(roomId: string): Promise<Room> {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId)!;
    }

    const room = new Room({
      id: roomId,
      tickRate: 20 // 20Hz network tick rate
    });

    this.rooms.set(roomId, room);
    room.start();
    
    return room;
  }

  async joinRoom(roomId: string, clientId: string): Promise<Room> {
    let room = this.getRoom(roomId);
    if (!room) {
      // Auto-create for now (in prod this might require authorization)
      room = await this.createRoom(roomId);
    }

    room.addClient(clientId);
    return room;
  }

  leaveRoom(roomId: string, clientId: string): void {
    const room = this.getRoom(roomId);
    if (room) {
      room.removeClient(clientId);
      // Logic to close room if empty could go here
    }
  }

  dispose(): void {
    for (const room of this.rooms.values()) {
      room.dispose();
    }
    this.rooms.clear();
  }
}

