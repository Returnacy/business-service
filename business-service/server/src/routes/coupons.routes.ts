import type { FastifyInstance } from 'fastify';

export function registerCouponsRoutes(app: FastifyInstance) {
  app.post('/api/v1/coupons', async (request: any) => {
    const { userId, businessId, prizeId, code } = request.body as { userId: string; businessId: string; prizeId: string; code: string };
    const coupon = await app.repository.createCoupon(userId, businessId, prizeId, code, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)); // Expires in 30 days
    return { coupon };
  });

  app.patch('/api/v1/coupons/:id/redeem', async (request: any) => {
    const { id } = request.params as { id: string };
    const coupon = await app.repository.redeemCoupon(id);
    return { coupon };
  });

  app.get('/api/v1/coupons', async (request: any) => {
    const { userId, businessId } = request.query as { userId: string; businessId: string };
    const coupons = await app.repository.listCoupons(userId, businessId);
    return { coupons };
  });
}
