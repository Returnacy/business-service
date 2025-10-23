import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

export function registerPrizesRoutes(app: FastifyInstance) {
  app.get('/api/v1/prizes', async (request: any) => {
    const { businessId, brandId } = request.query as { businessId?: string; brandId?: string };
    const prizes = await app.repository.listPrizes({ businessId, brandId });
    return { prizes };
  });

  app.post('/api/v1/prizes', async (request: any) => {
    const body = request.body as { name: string; pointsRequired: number; isPromotional?: boolean; businessId?: string | null; brandId?: string | null };
    const prize = await app.repository.createPrize(body);
    return { prize };
  });

  // Compute progression boundaries (last and next prize thresholds) given a user's current stamps
  // Input: { businessId: string, stamps: number }
  // Output: { stampsLastPrize: number, stampsNextPrize: number, lastPrizeName?: string, nextPrizeName?: string }
  app.post('/api/v1/prizes/progression', async (request: any, reply: any) => {
    const schema = z.object({
      businessId: z.string().min(1),
      stamps: z.number().int().min(0),
    });
    const input = schema.parse(request.body ?? {});

    const prizes = await app.repository.listPrizes({ businessId: input.businessId });
    const thresholds = prizes
      .map((p: any) => Number(p.pointsRequired))
      .filter((n: any) => Number.isFinite(n) && n > 0);

    thresholds.sort((a: number, b: number) => a - b);

    let stampsLastPrize = 0;
    let stampsNextPrize = 15; // default fallback
    let lastPrizeName: string | undefined;
    let nextPrizeName: string | undefined;

    if (thresholds.length === 0) {
      // No prizes configured: default 15-cycle progression
      const base = 15;
      stampsLastPrize = Math.floor(input.stamps / base) * base;
      stampsNextPrize = stampsLastPrize + base;
    } else if (thresholds.length === 1) {
      const base = thresholds[0];
      stampsLastPrize = Math.floor(input.stamps / base) * base;
      stampsNextPrize = stampsLastPrize + base;
      const prize = prizes.find((p: any) => Number(p.pointsRequired) === base);
      lastPrizeName = prize?.name;
      nextPrizeName = prize?.name;
    } else {
      // Discrete ascending thresholds: find last <= stamps and next > stamps
      const lastConfig = thresholds.filter((t: number) => t <= input.stamps).pop();
      const nextConfig = thresholds.find((t: number) => t > input.stamps);
      const maxConfig = thresholds[thresholds.length - 1];
      const baseStep = thresholds[0];

      if (input.stamps <= maxConfig) {
        stampsLastPrize = lastConfig ?? 0;
        stampsNextPrize = nextConfig ?? (stampsLastPrize + baseStep);
      } else {
        // Beyond highest configured threshold: restart counting from the first prize in cycles of baseStep
        stampsLastPrize = Math.floor(input.stamps / baseStep) * baseStep;
        stampsNextPrize = stampsLastPrize + baseStep;
      }

      const lastPrize = prizes.find((p: any) => Number(p.pointsRequired) === stampsLastPrize);
      const nextPrize = prizes.find((p: any) => Number(p.pointsRequired) === stampsNextPrize) || prizes.find((p: any) => Number(p.pointsRequired) === baseStep);
      lastPrizeName = lastPrize?.name;
      nextPrizeName = nextPrize?.name;
    }

    return reply.send({
      stampsLastPrize,
      stampsNextPrize,
      lastPrizeName,
      nextPrizeName,
    });
  });
}
