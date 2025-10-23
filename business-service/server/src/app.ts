import Fastify from 'fastify';
import cors from '@fastify/cors';
import prismaRepositoryPlugin from './plugins/prismaRepositoryPlugin.js';
import { registerBusinessRoutes } from './routes/business.routes.js';
import { registerPrizesRoutes } from './routes/prizes.routes.js';
import { registerStampsRoutes } from './routes/stamps.routes.js';
import { registerCouponsRoutes } from './routes/coupons.routes.js';
import { registerUsersRoutes } from './routes/users.routes.js';
import { registerAnalyticsRoutes } from './routes/analytics.routes.js';

export async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  await app.register(prismaRepositoryPlugin);

  app.get('/health', async () => ({ status: 'ok' }));

  registerBusinessRoutes(app);
  registerPrizesRoutes(app);
  registerStampsRoutes(app);
  registerCouponsRoutes(app);
  registerUsersRoutes(app);
  registerAnalyticsRoutes(app);

  return app;
}

// Start if invoked directly (not during tests)
// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  const isTest = process.env.NODE_ENV === 'test';
  if (isTest) return;
  const app = await buildApp();
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen({ port, host });
})();
