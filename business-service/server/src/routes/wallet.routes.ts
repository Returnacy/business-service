// @ts-nocheck
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createLoyaltySaveJwt } from '../utils/googleWallet.js';
import { TokenService } from '../services/tokenService.js';
import { UserServiceClient } from '../services/userServiceClient.js';

const requestSchema = z.object({
  businessId: z.string().min(1, 'businessId is required'),
  qrCode: z.string().min(1).optional(),
});

const querySchema = z.object({
  businessId: z.string().min(1, 'businessId is required').optional(),
});

function collectOrigins(request: any): string[] {
  const origins: string[] = [];
  const originHeader = request.headers?.origin;
  if (typeof originHeader === 'string' && originHeader.trim()) {
    origins.push(originHeader.trim());
  }

  const referer = request.headers?.referer;
  if (typeof referer === 'string' && referer.trim()) {
    const match = referer.trim().match(/^https?:\/\/[^/]+/i);
    if (match) {
      origins.push(match[0]);
    }
  }

  return origins;
}

function createUserServiceClient(): UserServiceClient {
  const tokenUrl = process.env.KEYCLOAK_TOKEN_URL;
  const clientId = process.env.KEYCLOAK_CLIENT_ID;
  const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET;
  if (!tokenUrl || !clientId || !clientSecret) {
    throw new Error('MISSING_SERVICE_AUTH_CONFIG');
  }
  const tokenService = new TokenService({ tokenUrl, clientId, clientSecret });
  const baseUrl = process.env.USER_SERVICE_URL || 'http://user-server:3000';
  return new UserServiceClient({ baseUrl, tokenService });
}

async function fetchProfile(request: any): Promise<any> {
  const userServiceUrl = process.env.USER_SERVICE_URL || 'http://user-server:3000';
  const authHeader = request.headers?.authorization;
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    const error = new Error('UNAUTHENTICATED');
    (error as any).statusCode = 401;
    throw error;
  }

  const fetchFn = (globalThis as any).fetch;
  if (typeof fetchFn !== 'function') {
    const error = new Error('FETCH_NOT_AVAILABLE');
    (error as any).statusCode = 500;
    throw error;
  }

  const res = await fetchFn(`${userServiceUrl.replace(/\/$/, '')}/api/v1/me`, {
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
    },
  });

  if (res.status === 401) {
    const error = new Error('UNAUTHENTICATED');
    (error as any).statusCode = 401;
    throw error;
  }

  if (!res.ok) {
    const text = await res.text();
    const error = new Error(`USER_SERVICE_ERROR: ${text || res.statusText}`);
    (error as any).statusCode = 502;
    throw error;
  }

  return res.json();
}

export function registerWalletRoutes(app: FastifyInstance) {
  app.get('/api/v1/wallet/google', {
    config: { allowUserAccess: true },
    handler: async (request: any, reply: any) => {
      try {
        const parsedQuery = querySchema.safeParse(request.query ?? {});
        if (!parsedQuery.success || !parsedQuery.data.businessId) {
          return reply.status(400).send({ error: 'INVALID_QUERY', message: 'businessId is required' });
        }

        const profile = await fetchProfile(request);
        if (!profile || typeof profile !== 'object' || !profile.id) {
          return reply.status(401).send({ error: 'UNAUTHENTICATED' });
        }

        const businessId = parsedQuery.data.businessId;
        const memberships = Array.isArray(profile.memberships) ? profile.memberships : [];
        const membership = memberships.find((m: any) => m && m.businessId === businessId);
        if (!membership) {
          return reply.status(403).send({ error: 'FORBIDDEN', message: 'Membership for business not found' });
        }

        try {
          const userClient = createUserServiceClient();
          const status = await userClient.getWalletPass(profile.id, businessId);
          return reply.send({ linked: !!status?.linked, objectId: status?.objectId ?? null });
        } catch (error: any) {
          if (request?.server?.log?.error) {
            request.server.log.error({ err: error }, 'Failed to query wallet status from user-service');
          }
          return reply.status(502).send({ error: 'UPSTREAM_UNAVAILABLE', message: 'Unable to query wallet status' });
        }
      } catch (error: any) {
        const status = error?.statusCode ?? 500;
        if (request?.server?.log?.error) {
          request.server.log.error({ err: error }, 'Failed to query Google Wallet status');
        }
        return reply.status(status).send({
          error: status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' : 'GOOGLE_WALLET_ERROR',
          message: error?.message ?? 'Failed to retrieve wallet status',
        });
      }
    },
  });

  app.post('/api/v1/wallet/google', {
    config: { allowUserAccess: true },
    handler: async (request: any, reply: any) => {
      try {
        const parseResult = requestSchema.safeParse(request.body ?? {});
        if (!parseResult.success) {
          return reply.status(400).send({
            error: 'INVALID_PAYLOAD',
            details: parseResult.error.flatten(),
          });
        }

        const { businessId, qrCode } = parseResult.data;
        const profile = await fetchProfile(request);

        if (!profile || typeof profile !== 'object' || !profile.id) {
          return reply.status(401).send({ error: 'UNAUTHENTICATED' });
        }

        const memberships = Array.isArray(profile.memberships) ? profile.memberships : [];
        const membership = memberships.find((m: any) => m && m.businessId === businessId);
        if (!membership) {
          return reply.status(403).send({ error: 'FORBIDDEN', message: 'Membership for business not found' });
        }

        const repository = (request.server as any).repository;
        if (!repository || typeof repository.countValidStamps !== 'function') {
          return reply.status(500).send({ error: 'SERVER_MISCONFIGURED' });
        }
        let userClient: UserServiceClient;
        try {
          userClient = createUserServiceClient();
        } catch (error: any) {
          if (request?.server?.log?.error) {
            request.server.log.error({ err: error }, 'Wallet pass issuance failed: missing service auth config');
          }
          return reply.status(500).send({ error: 'SERVICE_AUTH_MISCONFIGURED' });
        }

  let existingPass: { linked?: boolean; objectId?: string | null } | null = null;
        try {
          existingPass = await userClient.getWalletPass(profile.id, businessId);
        } catch (error: any) {
          if (request?.server?.log?.warn) {
            request.server.log.warn({ err: error }, 'Failed to read wallet status before issuing pass');
          }
        }

        const validStamps = await repository.countValidStamps(profile.id, businessId);
        const accountName = [profile.name, profile.surname].filter((part: unknown): part is string => typeof part === 'string' && part.trim().length > 0).join(' ');
        const cardName = accountName || profile.email || `User ${profile.id}`;
        const qrValue = qrCode || profile.id;

        const pass = await createLoyaltySaveJwt({
          userId: profile.id,
          accountName: cardName,
          accountEmail: typeof profile.email === 'string' ? profile.email : undefined,
          businessId,
          qrValue,
          validStamps,
          origins: collectOrigins(request),
        });

        try {
          await userClient.upsertWalletPass(profile.id, businessId, { objectId: pass.objectId });
        } catch (error: any) {
          if (request?.server?.log?.error) {
            request.server.log.error({ err: error }, 'Failed to persist wallet linkage in user-service');
          }
          return reply.status(502).send({
            error: 'WALLET_LINK_PERSISTENCE_FAILED',
            message: error?.message ?? 'Unable to record wallet linkage',
          });
        }

  return reply.send({ ...pass, linked: true, previouslyLinked: !!(existingPass?.linked) });
      } catch (error: any) {
        const status = error?.statusCode ?? 500;
        if (request?.server?.log?.error) {
          request.server.log.error({ err: error }, 'Failed to issue Google Wallet pass');
        }
        return reply.status(status).send({
          error: status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' : 'GOOGLE_WALLET_ERROR',
          message: error?.message ?? 'Failed to generate pass',
        });
      }
    },
  });
}
