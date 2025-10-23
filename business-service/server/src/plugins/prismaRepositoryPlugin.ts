// @ts-nocheck
import fp from 'fastify-plugin';
// Load the DB package directly from its built dist (works both locally in Docker and in runtime)
const { RepositoryPrisma: RepositoryCtor } = await import('file:///app/db/dist/src/index.js');

export default fp(async (fastify: any) => {
  const repository = new RepositoryCtor();
  fastify.decorate('repository', repository);
});
