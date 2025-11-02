import { prisma } from './prismaClient.js';

export class RepositoryPrisma {
  // Ensure brand and business exist (minimal cascade)
  async ensureBusiness(businessId: string) {
  const SEED_BUSINESS_ID = 'af941888-ec4c-458e-b905-21673241af3e';
  const SEED_BRAND_ID = '385d4ebb-4c4b-46e9-8701-0d71bfd7ce47';

    const existing = await prisma.business.findUnique({ where: { id: businessId } });
    if (existing) {
      // If the seeded business exists but is not linked to the seeded brand, fix the link.
      if (businessId === SEED_BUSINESS_ID && existing.brandId !== SEED_BRAND_ID) {
        // Ensure seeded brand exists
        const seedBrand = await prisma.brand.upsert({
          where: { id: SEED_BRAND_ID },
          update: {},
          create: {
            id: SEED_BRAND_ID,
            name: 'Seed Brand',
            email: '385d4ebb-4c4b-46e9-8701-0d71bfd7ce47@brand.local',
            phone: '+10000000001',
            address: 'N/A',
          },
        });
        await prisma.business.update({
          where: { id: existing.id },
          data: { brandId: seedBrand.id },
        });
        return prisma.business.findUnique({ where: { id: businessId } });
      }
      return existing;
    }

    // Create seeded brand+business with stable IDs if requested
    if (businessId === SEED_BUSINESS_ID) {
      const seedBrand = await prisma.brand.upsert({
        where: { id: SEED_BRAND_ID },
        update: {},
        create: {
          id: SEED_BRAND_ID,
          name: 'Seed Brand',
          email: '385d4ebb-4c4b-46e9-8701-0d71bfd7ce47@brand.local',
          phone: '+10000000001',
          address: 'N/A',
        },
      });
      const biz = await prisma.business.create({
        data: {
          id: SEED_BUSINESS_ID,
          brandId: seedBrand.id,
          name: 'Seed Business',
          email: 'af941888-ec4c-458e-b905-21673241af3e@business.local',
          phone: '+10000000002',
          address: 'N/A',
        },
      });
      return biz;
    }

    // Default path: create a minimal brand and a business with the provided id
    const brand = await prisma.brand.create({
      data: {
        name: `Brand ${businessId.slice(0, 8)}`,
        email: `${businessId}@brand.local`,
        phone: `+${Math.floor(Math.random() * 9e9 + 1e9)}`,
        address: 'N/A',
      },
    });
    const biz = await prisma.business.create({
      data: {
        id: businessId,
        brandId: brand.id,
        name: `Business ${businessId.slice(0, 8)}`,
        email: `${businessId}@business.local`,
        phone: `+${Math.floor(Math.random() * 9e9 + 1e9)}`,
        address: 'N/A',
      },
    });
    return biz;
  }
  // Business
  async upsertBusiness(b: { id?: string; brandId: string; name: string; email: string; phone: string; address: string; totalSms?: number; totalEmail?: number; totalPush?: number; availableSms?: number; availableEmail?: number; availablePush?: number; }) {
    const data = {
      brandId: b.brandId,
      name: b.name,
      email: b.email,
      phone: b.phone,
      address: b.address,
      totalSms: b.totalSms ?? undefined,
      totalEmail: b.totalEmail ?? undefined,
      totalPush: b.totalPush ?? undefined,
      availableSms: b.availableSms ?? undefined,
      availableEmail: b.availableEmail ?? undefined,
      availablePush: b.availablePush ?? undefined,
    } as const;
    if (b.id) {
      return prisma.business.update({ where: { id: b.id }, data });
    }
    return prisma.business.create({ data });
  }
  async findBusinessById(id: string) {
    return prisma.business.findUnique({ where: { id } });
  }
  async findBusinessByDomain(domain: string) {
    // fastifyDomain was removed from the schema; domain resolution should be handled at the server layer via a mapping.
    // For backward compatibility, return null here.
    return null;
  }

  // Prizes
  async listPrizes(scope: { businessId?: string; brandId?: string }) {
    return prisma.prize.findMany({ where: { businessId: scope.businessId ?? undefined, brandId: scope.brandId ?? undefined } });
  }
  async createPrize(p: { name: string; pointsRequired: number; isPromotional?: boolean; businessId?: string | null; brandId?: string | null }) {
    return prisma.prize.create({ data: { ...p, isPromotional: p.isPromotional ?? false } });
  }

  // Stamps
  async addStamp(userId: string, businessId: string) {
    await this.ensureBusiness(businessId);
    return prisma.stamp.create({ data: { userId, businessId } });
  }
  async redeemStamp(stampId: string) {
    return prisma.stamp.update({ where: { id: stampId }, data: { isRedeemed: true } });
  }
  async countValidStamps(userId: string, businessId: string) {
    return prisma.stamp.count({ where: { userId, businessId, isRedeemed: false } });
  }

  // Coupons
  async createCoupon(userId: string, businessId: string, prizeId: string, code: string, expiredAt?: Date | null) {
    const defaultExpiry = expiredAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return prisma.coupon.create({ data: { userId, businessId, prizeId, code, expiredAt: defaultExpiry }, include: { prize: true } });
  }
  async findCouponByCode(code: string, businessId: string) {
    return prisma.coupon.findFirst({ where: { code, businessId }, include: { prize: true } });
  }
  async redeemCoupon(couponId: string) {
    return prisma.coupon.update({
      where: { id: couponId },
      data: { isRedeemed: true, redeemedAt: new Date() },
      include: { prize: true },
    });
  }
  async listCoupons(userId: string, businessId: string) {
    return prisma.coupon.findMany({ where: { userId, businessId }, include: { prize: true } });
  }

  // Capacity (available messages)
  async getBusinessCapacity(businessId: string) {
    const biz = await prisma.business.findUnique({ where: { id: businessId } });
    if (!biz) return null;
    return {
      email: biz.availableEmail,
      sms: biz.availableSms,
      push: biz.availablePush,
    };
  }

  // Analytics helpers
  async countStampsInRange(businessId: string, from: Date, to: Date) {
    return prisma.stamp.count({ where: { businessId, createdAt: { gte: from, lt: to } } });
  }

  async countRedeemedCouponsInRange(businessId: string, from: Date, to: Date) {
    return prisma.coupon.count({ where: { businessId, isRedeemed: true, redeemedAt: { gte: from, lt: to } } });
  }

  async countTotalCouponsRedeemed(businessId: string) {
    return prisma.coupon.count({ where: { businessId, isRedeemed: true } });
  }

  async distinctUsersForBusiness(businessId: string) {
  const rows: Array<{ userId: string }> = await prisma.stamp.findMany({ where: { businessId }, select: { userId: true }, distinct: ['userId'] });
  const coup: Array<{ userId: string }> = await prisma.coupon.findMany({ where: { businessId }, select: { userId: true }, distinct: ['userId'] });
  const set = new Set<string>();
  rows.forEach((r: { userId: string }) => set.add(r.userId));
  coup.forEach((r: { userId: string }) => set.add(r.userId));
    return set.size;
  }

  async countNewUsersSince(businessId: string, since: Date) {
    // Approximation: count distinct users who got any stamp since the date
    const rows: Array<{ userId: string }> = await prisma.stamp.findMany({
      where: { businessId, createdAt: { gte: since } },
      select: { userId: true },
      distinct: ['userId']
    });
    return rows.length;
  }

  // Daily analytics (UTC-based)
  private getDateRange(startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = [];
    const start = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
    const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      dates.push(new Date(d));
    }
    return dates;
  }

  async getDailyStamps(businessId: string, startDate: Date, endDate: Date = new Date()) {
    // Group stamps per UTC date between startDate..endDate inclusive
    const result: Array<{ date: string; count: number }> = await prisma.$queryRaw`\
      SELECT TO_CHAR(("createdAt" AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS date,\
             COUNT(*)::int AS count\
      FROM "Stamp"\
      WHERE "businessId" = ${businessId}\
        AND "createdAt" >= ${startDate}\
        AND "createdAt" < ${new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate() + 1))}\
      GROUP BY 1\
      ORDER BY 1\
    `;
    const map = new Map(result.map(r => [r.date, Number(r.count)]));
    const days = this.getDateRange(startDate, endDate);
    return days.map(d => map.get(d.toISOString().slice(0, 10)) || 0);
  }

  async getDailyTransactionsSessions(businessId: string, startDate: Date, endDate: Date = new Date()) {
    // Count "sessions" per user per day (>=10 minutes gap starts a new session)
    const endExclusive = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate() + 1));
    const result: Array<{ date: string; count: number }> = await prisma.$queryRaw`\
      WITH stamps AS (\
        SELECT\
          ("createdAt" AT TIME ZONE 'UTC')              AS created_at_utc,\
          ("createdAt" AT TIME ZONE 'UTC')::date        AS day_utc,\
          "userId"\
        FROM "Stamp"\
        WHERE "businessId" = ${businessId}\
          AND "userId" IS NOT NULL\
          AND "createdAt" >= ${startDate}\
          AND "createdAt" < ${endExclusive}\
      ), gaps AS (\
        SELECT\
          day_utc,\
          "userId",\
          created_at_utc,\
          CASE\
            WHEN LAG(created_at_utc) OVER (PARTITION BY day_utc, "userId" ORDER BY created_at_utc) IS NULL THEN 1\
            WHEN EXTRACT(EPOCH FROM (created_at_utc - LAG(created_at_utc) OVER (PARTITION BY day_utc, "userId" ORDER BY created_at_utc))) >= 600 THEN 1\
            ELSE 0\
          END AS session_increment\
        FROM stamps\
      )\
      SELECT TO_CHAR(day_utc, 'YYYY-MM-DD') AS date,\
             SUM(session_increment)::int     AS count\
      FROM gaps\
      GROUP BY day_utc\
      ORDER BY day_utc\
    `;
    const map = new Map(result.map(r => [r.date, Number(r.count)]));
    const days = this.getDateRange(startDate, endDate);
    return days.map(d => map.get(d.toISOString().slice(0, 10)) || 0);
  }

  // Advanced metrics inspired by brand backend
  async calculateReturnacyRate(businessId: string, days: number = 30) {
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * days);
    const prevWindowStart = new Date(since.getTime() - 1000 * 60 * 60 * 24 * 30);
    const rows: Array<{ c: number }> = await prisma.$queryRaw`\
      WITH purchases AS (\
        SELECT DISTINCT "userId", "businessId", date_trunc('second', "createdAt") AS ts\
        FROM "Stamp"\
        WHERE "businessId" = ${businessId}\
          AND "createdAt" >= ${prevWindowStart}\
      )\
      SELECT COUNT(DISTINCT a."userId")::int AS c\
      FROM purchases a\
      JOIN purchases b\
        ON b."userId" = a."userId"\
       AND b."businessId" = a."businessId"\
       AND b.ts < a.ts\
       AND b.ts >= a.ts - INTERVAL '30 days'\
      WHERE a.ts >= ${since}\
    `;
    return rows[0]?.c ?? 0;
  }

  async calculateAverageUserFrequency(businessId: string, days: number = 30) {
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * days);
    const result: Array<{ avg_days: number | null }> = await prisma.$queryRaw`\
      WITH recent_stamps AS (\
        SELECT "userId", DATE("createdAt") AS day\
        FROM "Stamp"\
        WHERE "businessId" = ${businessId}\
          AND "createdAt" >= ${since}\
        GROUP BY "userId", DATE("createdAt")\
      ),\
      eligible_users AS (\
        SELECT "userId"\
        FROM recent_stamps\
        GROUP BY "userId"\
        HAVING COUNT(*) >= 2\
      ),\
      user_days AS (\
        SELECT rs."userId", rs.day\
        FROM recent_stamps rs\
        JOIN eligible_users eu ON eu."userId" = rs."userId"\
      ),\
      user_day_diffs AS (\
        SELECT "userId",\
               (day - LAG(day) OVER (PARTITION BY "userId" ORDER BY day))::int AS diff_days\
        FROM user_days\
      ),\
      per_user_avg AS (\
        SELECT "userId", AVG(diff_days)::float AS avg_days\
        FROM user_day_diffs\
        WHERE diff_days IS NOT NULL\
        GROUP BY "userId"\
      )\
      SELECT AVG(avg_days)::float AS avg_days\
      FROM per_user_avg\
    `;
    const avgDays = result[0]?.avg_days ?? 0;
    return Math.round(avgDays);
  }

  // CRM Users list - this relies on an external user-service normally. For now, return an empty list placeholder.
  // Extend later if a local mirror exists. Here we only provide stamp/coupon counts enrichment API.
  async getUserStatsForBusiness(userId: string, businessId: string) {
    const now = new Date();
    const [totalStamps, validStamps, unredeemedActiveCount, totalCoupons, lastStamp, lastCoupon] = await Promise.all([
      prisma.stamp.count({ where: { userId, businessId } }),
      prisma.stamp.count({ where: { userId, businessId, isRedeemed: false } }),
      prisma.coupon.count({
        where: {
          userId,
          businessId,
          isRedeemed: false,
          OR: [
            { expiredAt: null },
            { expiredAt: { gt: now } },
          ],
        },
      }),
      prisma.coupon.count({ where: { userId, businessId } }),
      prisma.stamp.findFirst({ where: { userId, businessId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      prisma.coupon.findFirst({ where: { userId, businessId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ]);
    const lastVisitDate = [lastStamp?.createdAt ?? null, lastCoupon?.createdAt ?? null]
      .filter((d): d is Date => d instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0] || null;
    return { totalStamps, validStamps, couponsCount: unredeemedActiveCount, totalCoupons, lastVisit: lastVisitDate };
  }
}
