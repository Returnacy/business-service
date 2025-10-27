import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { UserServiceClient, type BasicUser } from '../services/userServiceClient.js';
import { TokenService } from '../services/tokenService.js';

// Simplified Users input schema similar to monolith
const usersSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(200).default(20),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'stamp', 'coupon', 'lastVisit']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  filter: z.object({
    hasCoupon: z.boolean().optional(),
    hasVisited: z.number().min(1).optional(),
    minStamp: z.number().min(0).optional(),
  }).optional(),
  businessId: z.string().optional(),
});

export function registerUsersRoutes(app: FastifyInstance) {
  // POST /api/v1/users - list CRM users with enrichment
  app.post('/api/v1/users', async (request: any, reply: any) => {
    try {
      const input = usersSchema.parse(request.body ?? {});
      const businessId = input.businessId || (request.query?.businessId as string | undefined);
      if (!businessId) return reply.code(400).send({ message: 'businessId required' });

      // Integrate with user-service (or mock-user-service) to fetch base users
      const userServiceUrl = process.env.USER_SERVICE_URL || 'http://user-server:3000';
      const tokenUrl = process.env.KEYCLOAK_TOKEN_URL;
      const clientId = process.env.KEYCLOAK_CLIENT_ID;
      const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET;

      if (!tokenUrl || !clientId || !clientSecret) {
        throw new Error('Missing KEYCLOAK_TOKEN_URL, KEYCLOAK_CLIENT_ID or KEYCLOAK_CLIENT_SECRET for business-service');
      }
      const tokenService = new TokenService({ tokenUrl, clientId, clientSecret });
      const userClient = new UserServiceClient({ baseUrl: userServiceUrl, tokenService });

      const queried = await userClient.queryUsers({
        page: input.page,
        limit: input.limit,
        search: input.search,
        businessId,
        // map filters that the internal endpoint can support in the future
        minStamp: input.filter?.minStamp,
      });
      const baseUsers = queried;

      // Preload prizes once to compute progression for each user without extra queries
      const prizes = await app.repository.listPrizes({ businessId });
      const thresholds = prizes
        .map((p: any) => Number(p.pointsRequired))
        .filter((n: any) => Number.isFinite(n) && n > 0)
        .sort((a: number, b: number) => a - b);

      function computeProgression(stamps: number) {
        let stampsLastPrize = 0;
        let stampsNextPrize = 15;
        let nextPrizeName: string | undefined;
        if (thresholds.length === 0) {
          const base = 15;
          stampsLastPrize = Math.floor(stamps / base) * base;
          stampsNextPrize = stampsLastPrize + base;
        } else if (thresholds.length === 1) {
          const base = thresholds[0];
          stampsLastPrize = Math.floor(stamps / base) * base;
          stampsNextPrize = stampsLastPrize + base;
          const prize = prizes.find((p: any) => Number(p.pointsRequired) === base);
          nextPrizeName = prize?.name;
        } else {
          const lastConfig = thresholds.filter((t: number) => t <= stamps).pop();
          const nextConfig = thresholds.find((t: number) => t > stamps);
          const maxConfig = thresholds[thresholds.length - 1];
          const baseStep = thresholds[0];
          if (stamps <= maxConfig) {
            stampsLastPrize = lastConfig ?? 0;
            stampsNextPrize = nextConfig ?? (stampsLastPrize + baseStep);
          } else {
            stampsLastPrize = Math.floor(stamps / baseStep) * baseStep;
            stampsNextPrize = stampsLastPrize + baseStep;
          }
          const nextPrize = prizes.find((p: any) => Number(p.pointsRequired) === stampsNextPrize) || prizes.find((p: any) => Number(p.pointsRequired) === baseStep);
          nextPrizeName = nextPrize?.name;
        }
        return { stampsLastPrize, stampsNextPrize, nextPrizeName };
      }

      const data = await Promise.all(baseUsers.map(async (u: BasicUser) => {
        const stats = await app.repository.getUserStatsForBusiness(u.id, businessId);
        const prog = computeProgression(stats.validStamps || 0);
        return {
          id: u.id,
          email: u.email,
          phone: u.phone,
          name: (u as any).name,
          surname: (u as any).surname,
          birthday: u.birthday ?? null,
          validStamps: stats.validStamps,
          couponsCount: stats.couponsCount, // unredeemed & not expired
          totalCoupons: stats.totalCoupons, // total earned (redeemed + unredeemed)
          lastVisit: stats.lastVisit ? new Date(stats.lastVisit).toISOString() : null,
          stampsLastPrize: prog.stampsLastPrize,
          stampsNextPrize: prog.stampsNextPrize,
          nextPrizeName: prog.nextPrizeName,
        };
      }));

      // Apply filters (minStamp, hasCoupon, hasVisited in last N days)
      const filtered = data.filter((row) => {
        let ok = true;
        if (input.filter?.minStamp && input.filter.minStamp > 0) {
          ok = ok && ((row.validStamps ?? 0) >= input.filter.minStamp);
        }
        if (input.filter?.hasCoupon) {
          ok = ok && ((row.couponsCount ?? 0) > 0);
        }
        if (input.filter?.hasVisited && input.filter.hasVisited > 0) {
          const cutoff = Date.now() - (input.filter.hasVisited * 24 * 60 * 60 * 1000);
          const lastTs = row.lastVisit ? Date.parse(row.lastVisit) : 0;
          ok = ok && (lastTs >= cutoff);
        }
        return ok;
      });

      // Apply sorting based on input.sortBy and input.sortOrder
      const order = input.sortOrder === 'desc' ? -1 : 1;
      const sorted = [...filtered].sort((a, b) => {
        switch (input.sortBy) {
          case 'stamp': {
            const av = a.validStamps ?? 0; const bv = b.validStamps ?? 0; return (av - bv) * order;
          }
          case 'coupon': {
            const av = a.couponsCount ?? 0; const bv = b.couponsCount ?? 0; return (av - bv) * order;
          }
          case 'lastVisit': {
            const av = a.lastVisit ? Date.parse(a.lastVisit) : 0;
            const bv = b.lastVisit ? Date.parse(b.lastVisit) : 0;
            return (av - bv) * order;
          }
          case 'name':
          default: {
            const an = `${a.name ?? ''} ${a.surname ?? ''}`.trim().toLowerCase();
            const bn = `${b.name ?? ''} ${b.surname ?? ''}`.trim().toLowerCase();
            return an.localeCompare(bn) * order;
          }
        }
      });

      // Apply pagination on sorted list (1-based page)
      const start = Math.max(0, (input.page - 1) * input.limit);
      const end = start + input.limit;
      const paged = sorted.slice(start, end);

      return reply.code(200).send({ message: 'Users retrieved successfully', data: paged });
    } catch (e: any) {
      app.log.error(e);
      return reply.code(400).send({ message: e?.message ?? 'Invalid payload' });
    }
  });
}
