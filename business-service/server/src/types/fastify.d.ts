import 'fastify';
import type { RepositoryPrisma } from '@business-service/db';

declare module 'fastify' {
  interface FastifyInstance {
    repository: RepositoryPrisma;
  }
}
