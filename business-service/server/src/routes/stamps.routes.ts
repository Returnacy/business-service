import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'node:crypto';
import { TokenService } from '../services/tokenService.js';
import { UserServiceClient } from '../services/userServiceClient.js';

export function registerStampsRoutes(app: FastifyInstance) {
  app.post('/api/v1/stamps', async (request: any) => {
    // Backward-compatible single-stamp endpoint (deprecated by batch below)
    const { userId, businessId } = request.body as { userId: string; businessId: string };
    const stamp = await app.repository.addStamp(userId, businessId);
    return { stamp };
  });

  app.patch('/api/v1/stamps/:id/redeem', async (request: any) => {
    const { id } = request.params as { id: string };
    const stamp = await app.repository.redeemStamp(id);
    return { stamp };
  });

  app.get('/api/v1/stamps/count', async (request: any) => {
    const { userId, businessId } = request.query as { userId: string; businessId: string };
    const count = await app.repository.countValidStamps(userId, businessId);
    return { count };
  });

  // New: batch stamps apply with coupon evaluation and user-service sync
  app.post('/api/v1/stamps/apply', async (request: any, reply: any) => {
    const schema = z.object({
      userId: z.string().min(1),
      businessId: z.string().min(1),
      stamps: z.number().int().min(1).max(200),
    });
    const input = schema.parse(request.body ?? {});

    // Basic guard against accidental invalid identifiers propagated from UI
    const badIds = new Set(['NaN', 'undefined', 'null']);
    if (badIds.has(input.userId.trim())) {
      return reply.code(400).send({ message: 'Invalid userId' });
    }

    // 1) Add N stamps in business DB
    for (let i = 0; i < input.stamps; i++) {
      await app.repository.addStamp(input.userId, input.businessId);
    }

    // 2) Compute valid stamps and determine if coupon(s) should be created based on entitlements
    const validStamps = await app.repository.countValidStamps(input.userId, input.businessId);
    const prizes = await app.repository.listPrizes({ businessId: input.businessId });
    const baseRequired = prizes.length > 0 ? Math.min(...prizes.map((p: any) => Number(p.pointsRequired) || 15)) : 15;

    // Total coupons ever created for this user/business (redeemed or not)
    const existingAll = await app.repository.listCoupons(input.userId, input.businessId);
    const entitled = Math.floor(validStamps / baseRequired);
    const toCreate = Math.max(0, entitled - existingAll.length);

    const prize = prizes.find((p: any) => Number(p.pointsRequired) === baseRequired) || prizes[0] || null;
    let createdCoupon: any = null;
    if (toCreate > 0 && prize) {
      for (let i = 0; i < toCreate; i++) {
        const code = crypto.randomUUID();
        const newC = await app.repository.createCoupon(input.userId, input.businessId, prize.id, code);
        // Preserve first created in response
        if (!createdCoupon) createdCoupon = newC;
      }
    }

    // 3) Sync counters to user-service via internal service-auth endpoint
    const tokenService = new TokenService({
      tokenUrl: process.env.KEYCLOAK_TOKEN_URL!,
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
    });
    const userClient = new UserServiceClient({ baseUrl: process.env.USER_SERVICE_URL || 'http://user-server:3000', tokenService });

    const now = new Date();
    const unredeemedCount = (await app.repository.listCoupons(input.userId, input.businessId)).filter((c: any) => !c.isRedeemed && (!c.expiredAt || new Date(c.expiredAt).getTime() > now.getTime())).length;
    await userClient.updateMembershipCounters({
      userId: input.userId,
      businessId: input.businessId,
      validStamps,
      validCoupons: unredeemedCount,
      totalStampsDelta: input.stamps,
      totalCouponsDelta: toCreate,
    });

    return reply.code(200).send({
      message: 'Stamps applied',
      data: {
        validStamps,
        createdCoupon: createdCoupon ? { id: createdCoupon.id, code: createdCoupon.code } : null,
      },
    });
  });
}
