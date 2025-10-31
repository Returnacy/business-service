// @ts-nocheck
import Fastify from 'fastify';
import cors from '@fastify/cors';
import prismaRepositoryPlugin from './plugins/prismaRepositoryPlugin.js';
import keycloakAuthPlugin from './plugins/keycloakAuthPlugin.js';
import userAuthPlugin from './plugins/userAuthPlugin.js';
import { registerBusinessRoutes } from './routes/business.routes.js';
import { registerPrizesRoutes } from './routes/prizes.routes.js';
import { registerStampsRoutes } from './routes/stamps.routes.js';
import { registerCouponsRoutes } from './routes/coupons.routes.js';
import { registerUsersRoutes } from './routes/users.routes.js';
import { registerAnalyticsRoutes } from './routes/analytics.routes.js';
import { registerWalletRoutes } from './routes/wallet.routes.js';

export async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  await app.register(keycloakAuthPlugin);
  await app.register(userAuthPlugin);
  await app.register(prismaRepositoryPlugin);

  app.get('/health', async () => ({ status: 'ok' }));

  const baseAllowedRoles = new Set(['admin', 'brand_manager', 'manager', 'owner', 'staff']);
  const allowedServices = new Set(
    (process.env.KEYCLOAK_SERVICE_AUDIENCE || 'campaign-service,messaging-service,user-service,business-service')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  );
  app.addHook('preHandler', async (request, reply) => {
    if (request.method === 'OPTIONS') return;
    const path = request.routerPath || (request.raw?.url ? request.raw.url.split('?')[0] : undefined);
    if (path === '/health') return;
  const auth = (request as any).auth;
  const routeConfig = (request as any).routeConfig ?? request.routeOptions?.config ?? {};
  const allowUserAccess = routeConfig && routeConfig.allowUserAccess === true;
  const allowedRoles = new Set(baseAllowedRoles);
  if (allowUserAccess) allowedRoles.add('user');
    if (auth) {
      const azp = typeof auth.azp === 'string' ? auth.azp : undefined;
      const audClaim = auth.aud;
      const audList = Array.isArray(audClaim)
        ? audClaim
        : typeof audClaim === 'string'
          ? [audClaim]
          : [];
      const serviceAllowed = (azp && allowedServices.has(azp)) || audList.some((aud) => allowedServices.has(String(aud)));
      if (serviceAllowed) return;
    }
    const memberships = (request as any).userMemberships ?? [];
    const hasAccess = memberships.some((membership: any) =>
      Array.isArray(membership?.roles) && membership.roles.some((role: any) => allowedRoles.has(String(role).toLowerCase()))
    );
    if (!hasAccess) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Requires staff or higher role' });
    }
  });

  registerBusinessRoutes(app);
  registerPrizesRoutes(app);
  registerStampsRoutes(app);
  registerCouponsRoutes(app);
  registerUsersRoutes(app);
  registerAnalyticsRoutes(app);
  registerWalletRoutes(app);

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
