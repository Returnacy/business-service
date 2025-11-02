import type { FastifyInstance } from 'fastify';
import { TokenService } from '../services/tokenService.js';
import { UserServiceClient } from '../services/userServiceClient.js';

export function registerAnalyticsRoutes(app: FastifyInstance) {
  // GET /api/v1/analytics - core metrics
  app.get('/api/v1/analytics', async (request: any, reply: any) => {
    try {
  const businessId = (request.query?.businessId as string) || (request.headers['x-business-id'] as string) || process.env.DEFAULT_BUSINESS_ID || 'af941888-ec4c-458e-b905-21673241af3e';

      // Basic metrics using business-service data we own (stamps/coupons)
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);
      const startOfMonth = new Date(now);
      startOfMonth.setDate(now.getDate() - 30);

      // Total customers from user-service: count users with membership for this business
      const userServiceUrl = process.env.USER_SERVICE_URL || 'http://user-server:3000';
      const tokenUrl = process.env.KEYCLOAK_TOKEN_URL;
      const clientId = process.env.KEYCLOAK_CLIENT_ID;
      const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET;
      if (!tokenUrl || !clientId || !clientSecret) {
        throw new Error('Missing KEYCLOAK_TOKEN_URL, KEYCLOAK_CLIENT_ID or KEYCLOAK_CLIENT_SECRET for business-service');
      }
      const tokenService = new TokenService({ tokenUrl, clientId, clientSecret });
      const userClient = new UserServiceClient({ baseUrl: userServiceUrl, tokenService });
      const totalCustomers = await userClient.countUsersByBusiness(businessId);

      const [weekTotalStamps, monthTotalStamps, monthTotalCouponsRedeemed, weekNewUsers, totalCouponsRedeemed, weekTotalCouponsRedeemed, averageUserFrequency, returnacyRate] = await Promise.all([
        app.repository.countStampsInRange(businessId, startOfWeek, now),
        app.repository.countStampsInRange(businessId, startOfMonth, now),
        app.repository.countRedeemedCouponsInRange(businessId, startOfMonth, now),
        userClient.countNewUsersSince(businessId, startOfWeek),
        app.repository.countTotalCouponsRedeemed(businessId),
        app.repository.countRedeemedCouponsInRange(businessId, startOfWeek, now),
        app.repository.calculateAverageUserFrequency(businessId, 30),
        app.repository.calculateReturnacyRate(businessId, 30),
      ]);

      const payload = {
        totalUsers: totalCustomers,
        returnacyRate, // count of returning users; frontend maps to percentage
        totalCouponsRedeemed,
        weekTotalCouponsRedeemed,
        weekTotalStamps,
        weekNewUsers,
        monthTotalStamps,
        monthTotalCouponsRedeemed,
        averageUserFrequency,
      };

      return reply.send({ message: 'ok', data: payload });
    } catch (e: any) {
      app.log.error(e);
      return reply.code(500).send({ message: 'Failed to fetch analytics' });
    }
  });

  // GET /api/v1/analytics/daily-transactions?days=N
  app.get('/api/v1/analytics/daily-transactions', async (request: any, reply: any) => {
    try {
      const q = request.query || {};
      const days = Math.min(90, Math.max(1, Number(q.days || 30)));
  const businessId = (q.businessId as string) || (request.headers['x-business-id'] as string) || process.env.DEFAULT_BUSINESS_ID || 'af941888-ec4c-458e-b905-21673241af3e';

      // Align to UTC midnight and compute start date (inclusive)
      const now = new Date();
      const currentMidnight = new Date(now);
      currentMidnight.setHours(0, 0, 0, 0);
      const startDate = new Date(currentMidnight.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

      const [dailyTransactions, dailyStamps] = await Promise.all([
        app.repository.getDailyTransactionsSessions(businessId, startDate, currentMidnight),
        app.repository.getDailyStamps(businessId, startDate, currentMidnight),
      ]);

      return reply.send({ message: 'ok', data: { dailyTransactions, dailyStamps } });
    } catch (e: any) {
      app.log.error(e);
      return reply.code(500).send({ message: 'Failed to fetch daily transactions' });
    }
  });
}
