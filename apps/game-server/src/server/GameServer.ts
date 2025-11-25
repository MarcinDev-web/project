import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { RoomManager } from './RoomManager';
import { SocketHandler } from '../network/SocketHandler';
import { DiscoveryService } from '../service/DiscoveryService';

export class GameServer {
  private app: ReturnType<typeof Fastify>;
  private roomManager: RoomManager;
  private socketHandler: SocketHandler;
  private discoveryService: DiscoveryService;

  constructor() {
    this.app = Fastify({ logger: true });
    this.roomManager = new RoomManager();
    this.socketHandler = new SocketHandler(this.roomManager);
    
    // Configuration
    const PORT = process.env.PORT ? parseInt(process.env.PORT) : 6000;
    const HOST = process.env.HOST || '0.0.0.0';
    const PUBLIC_HOST = process.env.PUBLIC_HOST || 'localhost';
    const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

    this.discoveryService = new DiscoveryService({
      redisUrl: REDIS_URL,
      publicHost: PUBLIC_HOST,
      publicPort: PORT,
      maxCapacity: 1000
    });

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.register(cors, {
      origin: '*', // Secure this in production
      methods: ['GET', 'POST']
    });
    this.app.register(websocket);
  }

  private setupRoutes() {
    this.app.get('/health', async () => {
      return {
        status: 'ok',
        rooms: this.roomManager.getRoomCount(),
        players: this.roomManager.getTotalPlayerCount()
      };
    });

    this.app.register(async (fastify) => {
      fastify.get('/ws', { websocket: true }, (connection, req) => {
        this.socketHandler.handleConnection(connection.socket, req);
      });
    });
  }

  async start() {
    const PORT = process.env.PORT ? parseInt(process.env.PORT) : 6000;
    const HOST = process.env.HOST || '0.0.0.0';

    try {
      await this.app.listen({ port: PORT, host: HOST });
      await this.discoveryService.register();
      console.log(`Game Server listening on ${HOST}:${PORT}`);
    } catch (err) {
      this.app.log.error(err);
      process.exit(1);
    }
  }

  async stop() {
    await this.discoveryService.dispose();
    this.roomManager.dispose();
    await this.app.close();
  }
}

