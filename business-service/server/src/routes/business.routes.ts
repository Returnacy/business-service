import type { FastifyInstance } from 'fastify';

export function registerBusinessRoutes(app: FastifyInstance) {
  app.get('/api/v1/business/by-domain/:domain', async (request: any) => {
    const { domain } = request.params as { domain: string };
    // Domain lookup is no longer supported directly by DB. This endpoint remains for compatibility but returns a not found message.
    const business = await app.repository.findBusinessByDomain(domain);
    return business ?? { message: 'Not found' };
  });

  app.get('/api/v1/business/:id', async (request: any) => {
    const { id } = request.params as { id: string };
    const business = await app.repository.findBusinessById(id);
    return business ?? { message: 'Not found' };
  });

  // Internal endpoint for available messages (capacity) driven by DB counters
  app.post('/internal/v1/business/:id/available-messages', async (request: any) => {
    const { id } = request.params as { id: string };
    const cap = await app.repository.getBusinessCapacity(id);
    if (!cap) return { email: 0, sms: 0, push: 0 };
    return { email: cap.email, sms: cap.sms, push: cap.push };
  });
}
