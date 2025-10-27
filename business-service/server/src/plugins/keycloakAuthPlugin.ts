// @ts-nocheck
import fp from 'fastify-plugin';
import { createRemoteJWKSet, jwtVerify, decodeJwt } from 'jose';
import type { JWTVerifyOptions } from 'jose';

export default fp(async (fastify) => {
  const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL;
  const REALM = process.env.KEYCLOAK_REALM;
  if (!KEYCLOAK_BASE_URL || !REALM) {
    fastify.log.error('Missing KEYCLOAK_BASE_URL or KEYCLOAK_REALM env vars');
    throw new Error('Keycloak configuration missing');
  }

  const jwksUrl = `${KEYCLOAK_BASE_URL}/realms/${REALM}/protocol/openid-connect/certs`;
  fastify.log.info({ jwksUrl }, '[business-service] Keycloak JWKS URL');

  const JWKS = createRemoteJWKSet(new URL(jwksUrl));

  const configuredIssuersEnv = process.env.KEYCLOAK_ISSUER;
  const validIssuers: string[] = configuredIssuersEnv
    ? configuredIssuersEnv.split(',').map((s) => s.trim()).filter(Boolean)
    : [
        `${KEYCLOAK_BASE_URL}/realms/${REALM}`,
        `http://localhost:8080/realms/${REALM}`,
        `http://keycloak:8080/realms/${REALM}`,
      ];

  const audienceEnv = process.env.KEYCLOAK_AUDIENCE || process.env.KEYCLOAK_ALLOWED_AUDIENCES || '';
  const allowedAudiences = audienceEnv.split(',').map((s) => s.trim()).filter(Boolean);

  const CLOCK_TOLERANCE_SECONDS = Number(process.env.KEYCLOAK_CLOCK_TOLERANCE_SECONDS || 60);

  fastify.decorateRequest('auth', null as any);

  fastify.addHook('preHandler', async (request, reply) => {
    try {
      const authHeader = request.headers['authorization'];
      if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Missing or invalid Authorization header' });
      }
      const token = authHeader.substring(7).trim();
      if (!token) return reply.status(401).send({ error: 'Missing token' });

      if (process.env.NODE_ENV !== 'production') {
        try {
          const decoded = decodeJwt(token);
          fastify.log.debug({
            iss: decoded.iss,
            azp: (decoded as any).azp,
            aud: decoded.aud,
            exp: decoded.exp,
            sub: decoded.sub,
          }, '[business-service] decoded token payload (debug)');
        } catch (err) {
          fastify.log.debug({ err }, '[business-service] failed to decode token payload');
        }
      }

      const verifyOptions: JWTVerifyOptions = {
        issuer: validIssuers,
        clockTolerance: CLOCK_TOLERANCE_SECONDS,
      };

      const { payload } = await jwtVerify(token, JWKS, verifyOptions);

      if (allowedAudiences.length > 0) {
        const audClaim = payload.aud;
        const azpClaim = (payload as any).azp;
        const audList: string[] = Array.isArray(audClaim) ? audClaim : typeof audClaim === 'string' ? [audClaim] : [];
        const azpList: string[] = typeof azpClaim === 'string' ? [azpClaim] : Array.isArray(azpClaim) ? azpClaim : [];
        const combined = [...audList, ...azpList];
        const match = combined.some((value) => allowedAudiences.includes(value));
        if (!match) {
          return reply.status(401).send({ error: 'Invalid audience' });
        }
      }

      request.auth = payload;
      return;
    } catch (err) {
      fastify.log.debug({ err }, '[business-service] JWT verification failed');
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }
  });
});
