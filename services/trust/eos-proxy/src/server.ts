import Fastify from 'fastify';
import { z } from 'zod';
import { fileURLToPath } from 'node:url';
import { SanctionService, type EosEvent, type IntentTelemetry } from './SanctionService.js';

const eosEventSchema = z.object({
  ticketId: z.string().min(1),
  playerId: z.string().min(1),
  severity: z.enum(['info', 'warn', 'ban']),
  reasons: z.array(z.string().min(1)).nonempty(),
  metadata: z.record(z.unknown()).optional(),
});

const reportSchema = z.object({
  playerId: z.string().min(1),
  reporterId: z.string().min(1),
  reason: z.string().min(3),
});

const intentSchema = z.object({
  playerId: z.string().min(1),
  inputsPerSecond: z.number().positive(),
  aimVariance: z.number().nonnegative(),
  reportCount: z.number().int().nonnegative().optional(),
});

const normalizeEosEvent = (payload: z.infer<typeof eosEventSchema>): EosEvent => {
  const { metadata, ...rest } = payload;
  return metadata === undefined ? rest : { ...rest, metadata };
};

const normalizeIntentTelemetry = (payload: z.infer<typeof intentSchema>): IntentTelemetry => {
  const { reportCount, ...rest } = payload;
  return reportCount === undefined ? rest : { ...rest, reportCount };
};

export interface ServerOptions {
  logger?: boolean;
  sanctionService?: SanctionService;
}

export function createServer(options?: ServerOptions) {
  const server = Fastify({
    logger: options?.logger ?? true,
  });

  const sanctionService = options?.sanctionService ?? new SanctionService();

  server.get('/health', async () => ({ status: 'ok' }));

  server.post('/eos/events', async (request, reply) => {
    const payload = normalizeEosEvent(eosEventSchema.parse(request.body));
    const decision = sanctionService.receiveEosEvent(payload);
    reply.code(decision.action === 'ban' ? 202 : 200);
    return { decision };
  });

  server.post('/reports/player', async (request) => {
    const payload = reportSchema.parse(request.body);
    const decision = sanctionService.fileReport(payload);
    return { decision };
  });

  server.post('/telemetry/intent', async (request) => {
    const payload = normalizeIntentTelemetry(intentSchema.parse(request.body));
    const decision = sanctionService.receiveIntentStats(payload);
    return { decision };
  });

  return server;
}

async function start(): Promise<void> {
  const server = createServer({ logger: true });
  const port = Number(process.env.PORT) || 4100;
  const host = process.env.HOST || '0.0.0.0';
  await server.listen({ host, port });
  // eslint-disable-next-line no-console
  console.log(`[EOS Proxy] listening on ${host}:${port}`);
}

const isEntry = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isEntry && process.env.NODE_ENV !== 'test') {
  start().catch((error) => {
    console.error('[EOS Proxy] failed to start server', error);
    process.exit(1);
  });
}

