import 'fastify';
import type { RepositoryPrisma } from '@business-service/db';

declare module 'fastify' {
  interface FastifyInstance {
    repository: RepositoryPrisma;
  }

  interface FastifyRequest {
    auth?: any;
    userMemberships?: Array<{ brandId: string | null; businessId: string | null; roles: string[] }>;
  }
}
