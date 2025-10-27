import type { FastifyInstance } from 'fastify';
import { TokenService } from '../services/tokenService.js';
import { UserServiceClient } from '../services/userServiceClient.js';

function serializeCoupon(coupon: any) {
  return {
    id: coupon.id,
    userId: coupon.userId,
    businessId: coupon.businessId,
    prizeId: coupon.prizeId,
    code: coupon.code,
    qrCode: coupon.code,
    isRedeemed: !!coupon.isRedeemed,
    createdAt: coupon.createdAt,
    expiredAt: coupon.expiredAt ?? null,
    redeemedAt: coupon.redeemedAt ?? null,
    prize: coupon.prize
      ? {
          id: coupon.prize.id,
          name: coupon.prize.name,
          pointsRequired: coupon.prize.pointsRequired,
        }
      : undefined,
  };
}

export function registerCouponsRoutes(app: FastifyInstance) {
  app.post('/api/v1/coupons', async (request: any) => {
    const { userId, businessId, prizeId, code } = request.body as { userId: string; businessId: string; prizeId: string; code: string };
    const coupon = await app.repository.createCoupon(userId, businessId, prizeId, code, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    return { coupon: serializeCoupon(coupon) };
  });

  app.patch('/api/v1/coupons/:id/redeem', async (request: any) => {
    const { id } = request.params as { id: string };
    const coupon = await app.repository.redeemCoupon(id);

    try {
      if (!process.env.KEYCLOAK_TOKEN_URL || !process.env.KEYCLOAK_CLIENT_ID || !process.env.KEYCLOAK_CLIENT_SECRET) {
        throw new Error('Missing Keycloak client credentials for coupon sync');
      }
      const tokenService = new TokenService({
        tokenUrl: process.env.KEYCLOAK_TOKEN_URL,
        clientId: process.env.KEYCLOAK_CLIENT_ID,
        clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
      });
      const userClient = new UserServiceClient({ baseUrl: process.env.USER_SERVICE_URL || 'http://user-server:3000', tokenService });
      const now = new Date();
      const remaining = (await app.repository.listCoupons(coupon.userId, coupon.businessId)).filter(
        (c: any) => !c.isRedeemed && (!c.expiredAt || new Date(c.expiredAt).getTime() > now.getTime())
      ).length;
      await userClient.updateMembershipCounters({
        userId: coupon.userId,
        businessId: coupon.businessId,
        validCoupons: remaining,
      });
    } catch (err) {
      app.log.error({ err, couponId: id }, '[business-service] failed to sync coupon counters after redeem');
    }

    return { coupon: serializeCoupon(coupon) };
  });

  app.get('/api/v1/coupons', async (request: any) => {
    const { userId, businessId } = request.query as { userId: string; businessId: string };
    const coupons = await app.repository.listCoupons(userId, businessId);
    return { coupons: coupons.map(serializeCoupon) };
  });
}
