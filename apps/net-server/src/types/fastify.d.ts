import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    params: Record<string, any>;
    body: any;
    query: Record<string, any>;
  }
}
