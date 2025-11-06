import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import {
  type CorsConfig,
  getCorsConfig,
  isOriginAllowed,
  describeAllowedOrigins,
  CORS_ALLOWED_HEADERS,
  CORS_ALLOWED_METHODS,
} from '@shared/config/cors';
import type { DirectoryService } from '../registry/DirectoryService.js';
import { ZoneTokenIssuer } from '../tokens/ZoneTokenIssuer.js';
import { tokenEndpointLimiter, healthEndpointLimiter } from '../middleware/RateLimiter.js';

export interface GatewayServerOptions {
  port: number;
  tokenSecret: Uint8Array;
  directory: DirectoryService;
  corsConfig?: CorsConfig;
}

export class GatewayServer {
  private app: Express;
  private server: ReturnType<Express['listen']> | null = null;

  constructor(private readonly options: GatewayServerOptions) {
    const tokenIssuer = new ZoneTokenIssuer(options.tokenSecret);
    this.app = express();
    const corsConfig = options.corsConfig ?? getCorsConfig();
    const allowedOriginsDescription = describeAllowedOrigins(corsConfig);
    this.app.use(
      cors({
        origin: (origin, callback) => {
          if (!origin) {
            return callback(null, true);
          }

          if (isOriginAllowed(origin, corsConfig)) {
            return callback(null, true);
          }

          console.warn(`Blocked CORS origin: ${origin}. Allowed: ${allowedOriginsDescription}`);
          return callback(new Error('Not allowed by CORS'));
        },
        credentials: true,
        allowedHeaders: CORS_ALLOWED_HEADERS,
        methods: CORS_ALLOWED_METHODS,
        maxAge: 86400,
        optionsSuccessStatus: 204,
      })
    );
    this.app.use(express.json());

    // Health check endpoint (with rate limiting)
    this.app.get('/health', healthEndpointLimiter.middleware(), (_req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: Date.now() });
    });

    // Zone token endpoint (with rate limiting)
    this.app.post(
      '/api/zones/:id/token',
      tokenEndpointLimiter.middleware(),
      (req: Request, res: Response) => {
        void (async () => {
          try {
            const zoneId = req.params.id;
            const { userId } = req.body as { userId?: string };

            if (!userId || !zoneId) {
              return res.status(400).json({ error: 'userId and zoneId required' });
            }

            // Check if zone exists and is healthy
            const zone = this.options.directory.getZone(zoneId);
            if (!zone || !zone.healthy) {
              return res.status(404).json({ error: 'Zone not found or unavailable' });
            }

            // Issue token (15 minutes TTL)
            const token = await tokenIssuer.issue(userId, zoneId, 15 * 60);

            res.json({
              token,
              zoneId,
              endpoint: zone.endpoint,
              expiresAt: Date.now() + 15 * 60 * 1000,
            });
          } catch (err) {
            console.error('Token issuance error:', err);
            res.status(500).json({ error: 'Internal server error' });
          }
        })();
      }
    );

    // List available zones
    this.app.get('/api/zones', (req: Request, res: Response) => {
      const healthyOnly = req.query.healthy === 'true';
      const zones = this.options.directory.listZones(healthyOnly);
      res.json({ zones });
    });

    // Zone health endpoint (for zone servers to report health)
    this.app.post('/api/zones/:id/health', (req: Request, res: Response) => {
      const zoneId = req.params.id;
      const { healthy, load } = req.body as { healthy?: boolean; load?: number };

      if (!zoneId) {
        return res.status(400).json({ error: 'zoneId required' });
      }

      this.options.directory.updateHealth(
        zoneId,
        healthy ?? true,
        load !== undefined ? load : undefined
      );

      res.json({ status: 'ok' });
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.options.port, () => {
        console.warn(`Gateway server listening on port ${this.options.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
        this.server = null;
      } else {
        resolve();
      }
    });
  }
}
